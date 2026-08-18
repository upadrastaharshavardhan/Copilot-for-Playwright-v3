import ExcelJS from 'exceljs';
import { Readable } from 'stream';

/**
 * ---------------------------------------------------------------------------
 * Test Pack Understanding Engine
 * ---------------------------------------------------------------------------
 * Reads an uploaded Excel/CSV "test pack" and turns loosely-structured QA
 * spreadsheets into normalized TestCase objects, WITHOUT requiring the sheet
 * to follow any fixed template. It does this by:
 *
 *   1. Fuzzy-matching column headers against known synonyms (Module, Steps,
 *      Expected Result, Priority, Type, Preconditions, Test Case ID...).
 *   2. Treating every other column as raw "test data" for the case.
 *   3. Detecting repeated/grouped data columns (e.g. Username_1, Username_2)
 *      OR delimited multi-value cells (e.g. "alice|bob|carol") as DATA SETS,
 *      and expanding a single spreadsheet row into many concrete test cases
 *      — this is what lets a modest test pack balloon into thousands of
 *      well-formed, individually addressable test cases.
 * ---------------------------------------------------------------------------
 */

const HEADER_SYNONYMS = {
  id: ['testcaseid', 'tcid', 'id', 'caseid', 'testid', 'scenarioid'],
  module: ['module', 'feature', 'component', 'area', 'testsuite', 'suite', 'application', 'screen'],
  title: ['title', 'testcase', 'testscenario', 'scenario', 'testtitle', 'summary', 'name'],
  steps: ['steps', 'teststeps', 'actionsteps', 'testprocedure', 'procedure', 'description'],
  expected: ['expectedresult', 'expected', 'expectedoutput', 'expectedoutcome', 'expectedbehavior'],
  priority: ['priority', 'severity'],
  type: ['type', 'testtype', 'category', 'testcasetype'],
  precondition: ['precondition', 'preconditions', 'prerequisite', 'prerequisites', 'setup'],
  url: ['url', 'pageurl', 'link', 'endpoint'],
};

const PRIORITY_VALUES = ['critical', 'high', 'medium', 'low', 'p1', 'p2', 'p3', 'p4'];
const TYPE_VALUES = ['positive', 'negative', 'boundary', 'smoke', 'regression', 'edge', 'functional', 'negativetest'];

export const DEFAULT_LIMITS = {
  maxCasesTotal: 12000,
  maxVariantsPerRow: 200,
};

function normalizeHeader(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Data dict keys are normalized to lower_snake_case so that a spreadsheet
// column labelled "Username" (or "User Name", "USERNAME"...) reliably
// resolves against a template token written as {{data.username}}. The
// original header text is preserved separately for the UI (field mapping
// picker, column preview) via `standalone[].name` / `grouped[].label`.
export function normalizeKey(str) {
  return (
    String(str || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'field'
  );
}

function matchMeta(headerNorm) {
  for (const [key, synonyms] of Object.entries(HEADER_SYNONYMS)) {
    if (synonyms.includes(headerNorm)) return key;
  }
  return null;
}

// Detects trailing-number grouping, e.g. "Username_1" -> { base: "username", index: 1 }
function splitSuffix(headerRaw) {
  const m = String(headerRaw).trim().match(/^(.*?)[\s_\-#]*([0-9]+)\s*$/);
  if (!m) return null;
  const base = m[1].trim();
  if (!base) return null;
  return { base, index: parseInt(m[2], 10) };
}

function splitDelimited(value) {
  if (value == null) return [''];
  const str = String(value).trim();
  if (!str) return [''];
  const parts = str
    .split(/\r?\n|\s*\|\s*|\s*;\s*(?=\S+=)|(?<!,)\s*;\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length ? parts : [str];
}

function splitSteps(value) {
  if (value == null) return [];
  const str = String(value).trim();
  if (!str) return [];
  // Handles "1. do this\n2. do that", newline-separated, or ';' separated steps
  return str
    .split(/\r?\n|(?:\s*;\s*)/)
    .map((s) => s.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean);
}

/**
 * Parses raw workbook bytes into { sheetName -> { headerRow, rows } } shape.
 */
export async function parseWorkbook(buffer, filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const workbook = new ExcelJS.Workbook();

  if (ext === 'csv') {
    await workbook.csv.read(Readable.from(buffer));
  } else {
    await workbook.xlsx.load(buffer);
  }

  const sheets = [];
  workbook.eachSheet((worksheet) => {
    let headerRow = null;
    const rows = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const raw = row.values;
      const values = Array.isArray(raw) ? raw.slice(1) : [];
      const normalizedVals = values.map((v) => {
        if (v == null) return '';
        if (typeof v === 'object' && v.text != null) return v.text; // rich text
        if (typeof v === 'object' && v.result != null) return v.result; // formula result
        return v;
      });
      if (rowNumber === 1) {
        headerRow = normalizedVals.map((v) => String(v || '').trim());
      } else {
        if (normalizedVals.every((v) => String(v).trim() === '')) return;
        rows.push({ rowNumber, values: normalizedVals });
      }
    });
    if (headerRow && headerRow.some(Boolean)) {
      sheets.push({ name: worksheet.name, headerRow, rows });
    }
  });

  return sheets;
}

/**
 * Classifies header columns into meta columns, grouped (suffixed) data
 * columns, and standalone data columns.
 */
export function detectColumns(headerRow) {
  const meta = {}; // metaKey -> column index
  const grouped = new Map(); // baseName -> [{ index, colIndex }]
  const standalone = []; // { name, colIndex }
  const usedIdx = new Set();

  headerRow.forEach((h, colIndex) => {
    const norm = normalizeHeader(h);
    if (!norm) return;
    const metaKey = matchMeta(norm);
    if (metaKey && meta[metaKey] === undefined) {
      meta[metaKey] = colIndex;
      usedIdx.add(colIndex);
    }
  });

  headerRow.forEach((h, colIndex) => {
    if (usedIdx.has(colIndex) || !String(h || '').trim()) return;
    const suf = splitSuffix(h);
    if (suf) {
      const key = normalizeHeader(suf.base) || suf.base.toLowerCase();
      if (!grouped.has(key)) grouped.set(key, { label: suf.base, cols: [] });
      grouped.get(key).cols.push({ index: suf.index, colIndex });
    } else {
      standalone.push({ name: String(h).trim(), colIndex });
    }
  });

  // A "group" only counts as a group if it has 2+ suffixed columns
  const groupedFinal = [];
  const demoted = [];
  for (const [, g] of grouped) {
    if (g.cols.length >= 2) {
      g.cols.sort((a, b) => a.index - b.index);
      groupedFinal.push(g);
    } else {
      demoted.push(...g.cols.map((c) => ({ ...c, label: g.label })));
    }
  }
  for (const d of demoted) {
    standalone.push({ name: `${d.label}${d.index}`, colIndex: d.colIndex });
  }

  return { meta, grouped: groupedFinal, standalone };
}

function classifyPriority(text) {
  const lower = text.toLowerCase();
  if (/(critical|security|payment|checkout|money|auth)/.test(lower)) return 'High';
  if (/(cosmetic|ui polish|typo|label)/.test(lower)) return 'Low';
  return 'Medium';
}

function classifyType(text) {
  const lower = text.toLowerCase();
  if (/(invalid|error|fail|negative|wrong|unauthor|denied|reject)/.test(lower)) return 'Negative';
  if (/(boundary|edge|limit|max|min|empty|null|zero)/.test(lower)) return 'Boundary';
  return 'Positive';
}

function normalizePriority(raw, fallbackText) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return classifyPriority(fallbackText);
  if (/^p1$|critical|highest/.test(v)) return 'High';
  if (/^p2$|high/.test(v)) return 'High';
  if (/^p3$|medium|moderate/.test(v)) return 'Medium';
  if (/^p4$|low/.test(v)) return 'Low';
  return raw.trim();
}

function normalizeType(raw, fallbackText) {
  const v = String(raw || '').trim();
  if (!v) return classifyType(fallbackText);
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

function slugModule(name) {
  return String(name || 'module')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'module';
}

/**
 * Expands one raw spreadsheet row into N normalized TestCase objects
 * (N = number of detected data-set variations for that row).
 */
function buildCasesForRow(sheetName, row, columns, options, moduleCounters) {
  const { meta, grouped, standalone } = columns;
  const v = (idx) => (idx == null ? '' : row.values[idx]);

  const module = String(v(meta.module) || sheetName || 'General').trim();
  const titleRaw = String(v(meta.title) || '').trim();
  const stepsRaw = v(meta.steps);
  const expectedRaw = String(v(meta.expected) || '').trim();
  const preconditionRaw = String(v(meta.precondition) || '').trim();
  const urlRaw = String(v(meta.url) || '').trim();
  const idRaw = String(v(meta.id) || '').trim();

  // Build per-variant data maps
  const groupedVariants = grouped.map((g) => ({
    label: g.label,
    values: g.cols.map((c) => v(c.colIndex)),
  }));
  const standaloneVariants = standalone.map((s) => ({
    label: s.name,
    values: splitDelimited(v(s.colIndex)),
  }));

  let variantCount = 1;
  for (const g of groupedVariants) variantCount = Math.max(variantCount, g.values.length);
  for (const s of standaloneVariants) variantCount = Math.max(variantCount, s.values.length);
  variantCount = Math.min(variantCount, options.maxVariantsPerRow || DEFAULT_LIMITS.maxVariantsPerRow);

  const steps = splitSteps(stepsRaw);
  const titleBase = titleRaw || `${module} — scenario at row ${row.rowNumber}`;
  const typeBase = normalizeType(v(meta.type), `${titleBase} ${stepsRaw || ''}`);
  const priorityBase = normalizePriority(v(meta.priority), `${titleBase} ${stepsRaw || ''}`);

  const modSlug = slugModule(module).toUpperCase().slice(0, 10);
  moduleCounters[modSlug] = moduleCounters[modSlug] || 0;

  const cases = [];
  for (let i = 0; i < variantCount; i++) {
    const data = {};
    for (const g of groupedVariants) {
      const val = g.values[i] ?? g.values[g.values.length - 1] ?? '';
      data[normalizeKey(g.label)] = val;
    }
    for (const s of standaloneVariants) {
      const val = s.values[i] ?? s.values[s.values.length - 1] ?? s.values[0] ?? '';
      data[normalizeKey(s.label)] = val;
    }

    moduleCounters[modSlug] += 1;
    const seq = String(moduleCounters[modSlug]).padStart(4, '0');
    const baseId = idRaw ? (variantCount > 1 ? `${idRaw}-V${i + 1}` : idRaw) : `TC-${modSlug}-${seq}`;

    cases.push({
      id: baseId,
      module,
      title: variantCount > 1 ? `${titleBase} (data set ${i + 1}/${variantCount})` : titleBase,
      steps,
      data,
      expected: expectedRaw,
      precondition: preconditionRaw,
      url: urlRaw,
      priority: priorityBase,
      type: typeBase,
      status: 'Not Run',
      sourceSheet: sheetName,
      sourceRow: row.rowNumber,
      variantIndex: i + 1,
      variantTotal: variantCount,
    });
  }
  return cases;
}

/**
 * Full pipeline: parsed sheets -> normalized, expanded test case bank.
 */
export function buildTestCaseBank(sheets, userOptions = {}) {
  const options = { ...DEFAULT_LIMITS, ...userOptions };
  const cases = [];
  const warnings = [];
  const sheetSummaries = [];
  const moduleCounters = {};

  outer: for (const sheet of sheets) {
    const columns = detectColumns(sheet.headerRow);
    const missingMeta = ['title', 'steps'].filter((k) => columns.meta[k] === undefined);
    if (missingMeta.length) {
      warnings.push(
        `Sheet "${sheet.name}": no column detected for ${missingMeta.join(
          ' / '
        )} — falling back to auto-generated values for those fields.`
      );
    }
    let sheetCaseCount = 0;
    for (const row of sheet.rows) {
      const built = buildCasesForRow(sheet.name, row, columns, options, moduleCounters);
      for (const c of built) {
        if (cases.length >= options.maxCasesTotal) {
          warnings.push(
            `Reached the safety cap of ${options.maxCasesTotal} generated test cases — remaining rows were skipped. Raise the cap in Advanced Options if you need more.`
          );
          sheetSummaries.push({ name: sheet.name, rows: sheet.rows.length, casesGenerated: sheetCaseCount });
          break outer;
        }
        cases.push(c);
        sheetCaseCount++;
      }
    }
    sheetSummaries.push({ name: sheet.name, rows: sheet.rows.length, casesGenerated: sheetCaseCount });
  }

  return { cases, warnings, sheetSummaries };
}

export function summarizeColumns(sheet) {
  const columns = detectColumns(sheet.headerRow);
  return {
    name: sheet.name,
    rowCount: sheet.rows.length,
    detected: {
      meta: Object.fromEntries(Object.entries(columns.meta).map(([k, idx]) => [k, sheet.headerRow[idx]])),
      groupedDataFields: columns.grouped.map((g) => ({ field: g.label, key: normalizeKey(g.label), variants: g.cols.length })),
      standaloneDataFields: columns.standalone.map((s) => ({ field: s.name, key: normalizeKey(s.name) })),
    },
    // Flat list of data field keys available for this sheet — used to build
    // the field-mapping picker when a template's tokens don't match 1:1.
    availableDataKeys: [
      ...columns.grouped.map((g) => ({ label: g.label, key: normalizeKey(g.label) })),
      ...columns.standalone.map((s) => ({ label: s.name, key: normalizeKey(s.name) })),
    ],
  };
}
