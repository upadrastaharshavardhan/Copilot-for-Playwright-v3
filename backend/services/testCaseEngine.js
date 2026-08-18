import { slugify, specFilename, renderBulkModuleFile, extractTemplateDataFields } from './codeGen.js';
import { resolveTemplateForModule, listTemplates } from './templateStore.js';
import { renderFeatureFile } from './gherkinGen.js';

const DEFAULT_ROWS_PER_FILE = 300;

export function groupByModule(cases) {
  const map = new Map();
  for (const c of cases) {
    if (!map.has(c.module)) map.set(c.module, []);
    map.get(c.module).push(c);
  }
  return map;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Turns a flat case list into a set of generated source files, grouped by
 * module and chunked so no single file balloons past `rowsPerFile` cases —
 * this is the mechanism that keeps 5,000-10,000 test cases manageable:
 * a handful of compact, data-driven files instead of thousands of specs.
 */
/**
 * Resolves, per module, which template will be used and whether its
 * expected {{data.field}} tokens are actually present in the parsed data
 * — without rendering any code. Used both for the Test Pack upload preview
 * (so the user can fix template/field-mapping choices before generating)
 * and internally by generateSuiteFiles.
 */
export function analyzeModules(cases, language, moduleTemplateMap = {}, moduleFieldMap = {}) {
  const templates = listTemplates();
  const byModule = groupByModule(cases);
  const result = [];

  for (const [moduleName, moduleCases] of byModule) {
    const template = resolveTemplateForModule(moduleName, language, moduleTemplateMap[moduleName], templates);
    const activeTemplate = template && template.id !== 'builtin-generic' ? template : null;
    const stepCode = activeTemplate ? (language === 'python' ? activeTemplate.pythonSteps : activeTemplate.typescriptSteps) : null;
    const expectedFields = extractTemplateDataFields(stepCode);
    const fieldMap = moduleFieldMap[moduleName] || {};
    const availableKeys = [...new Set(moduleCases.flatMap((c) => Object.keys(c.data || {})))];
    const unresolvedFields = expectedFields.filter((f) => !availableKeys.includes(f) && !fieldMap[f]);

    result.push({
      module: moduleName,
      totalCases: moduleCases.length,
      templateId: template ? template.id : 'builtin-generic',
      templateUsed: template ? template.name : 'Generic Data-Driven',
      byType: countBy(moduleCases, 'type'),
      byPriority: countBy(moduleCases, 'priority'),
      expectedFields,
      availableKeys,
      unresolvedFields,
    });
  }
  return result;
}

export function generateSuiteFiles({ cases, language, moduleTemplateMap = {}, moduleFieldMap = {}, rowsPerFile = DEFAULT_ROWS_PER_FILE, sourceLabel, includeFeatureFiles = true }) {
  const templates = listTemplates();
  const byModule = groupByModule(cases);
  const files = [];
  const moduleSummary = analyzeModules(cases, language, moduleTemplateMap, moduleFieldMap);
  const summaryByModule = new Map(moduleSummary.map((m) => [m.module, m]));

  for (const [moduleName, moduleCases] of byModule) {
    const info = summaryByModule.get(moduleName);
    const template = templates.find((t) => t.id === info.templateId) || null;
    const moduleSlug = slugify(moduleName);
    const parts = chunk(moduleCases, rowsPerFile);
    const activeTemplate = template && template.id !== 'builtin-generic' ? template : null;
    const fieldMap = moduleFieldMap[moduleName] || {};

    parts.forEach((partCases, i) => {
      const filename = parts.length > 1 ? specFilename(`${moduleSlug}_part${i + 1}`, language) : specFilename(moduleSlug, language);
      const code = renderBulkModuleFile({
        language,
        moduleName,
        moduleSlug,
        cases: partCases,
        template: activeTemplate,
        sourceLabel,
        partIndex: i + 1,
        partTotal: parts.length,
        fieldMap,
      });
      files.push({
        path: `tests/${moduleSlug}/${filename}`,
        module: moduleName,
        language,
        kind: 'spec',
        templateUsed: info.templateUsed,
        caseCount: partCases.length,
        caseIds: partCases.map((c) => c.id),
        code,
      });

      // One matching .feature file per spec chunk — same module, same case
      // set, so every generated spec has a readable Gherkin counterpart.
      // Works whether the sheet's Steps column already used Given/When/Then
      // or was written as plain English (see gherkinGen.js).
      if (includeFeatureFiles) {
        const featureFilename =
          parts.length > 1 ? `${moduleSlug}_part${i + 1}.feature` : `${moduleSlug}.feature`;
        const featureCode = renderFeatureFile({
          moduleName,
          cases: partCases,
          sourceLabel,
          partIndex: i + 1,
          partTotal: parts.length,
        });
        files.push({
          path: `features/${moduleSlug}/${featureFilename}`,
          module: moduleName,
          language: 'gherkin',
          kind: 'feature',
          templateUsed: info.templateUsed,
          caseCount: partCases.length,
          caseIds: partCases.map((c) => c.id),
          code: featureCode,
        });
      }
    });
  }

  const fileCountByModule = {};
  for (const f of files) fileCountByModule[f.module] = (fileCountByModule[f.module] || 0) + 1;
  for (const m of moduleSummary) m.files = fileCountByModule[m.module] || 0;

  return { files, moduleSummary };
}

function countBy(list, key) {
  return list.reduce((acc, item) => {
    const k = item[key] || 'Unspecified';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

export function overallStats(cases) {
  return {
    total: cases.length,
    byType: countBy(cases, 'type'),
    byPriority: countBy(cases, 'priority'),
    byStatus: countBy(cases, 'status'),
    modules: groupByModule(cases).size,
  };
}
