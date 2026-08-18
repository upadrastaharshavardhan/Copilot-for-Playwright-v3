/**
 * ---------------------------------------------------------------------------
 * Multi-language code generation core.
 * ---------------------------------------------------------------------------
 * Two consumers:
 *   1. Single-requirement generation (Generate Tests tab) — one feature file
 *      + one spec, in Python (pytest-playwright) or TypeScript (@playwright/test).
 *   2. Bulk, data-driven generation (Test Pack tab) — ONE compact function per
 *      module that iterates a data array, so thousands of test cases stay in
 *      a handful of readable files instead of thousands of near-duplicate
 *      functions.
 * ---------------------------------------------------------------------------
 */

export function slugify(str) {
  return (
    String(str || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'generated_test'
  );
}

export function fileExt(language) {
  return language === 'python' ? 'py' : 'ts';
}

export function specFilename(slug, language) {
  return language === 'python' ? `test_${slug}.py` : `${slug}.spec.ts`;
}

/* ------------------------------------------------------------------ *
 * Single-requirement generation (mirrors the previous template mode,
 * now available in both languages).
 * ------------------------------------------------------------------ */

export function buildSingleSpec({ feature, slug, steps, requirement, language }) {
  return language === 'python'
    ? buildSinglePython({ feature, slug, steps, requirement })
    : buildSingleTypeScript({ feature, slug, steps, requirement });
}

function buildSinglePython({ feature, steps, requirement }) {
  const trimmedReq = requirement.length > 90 ? `${requirement.slice(0, 90)}…` : requirement;
  const testFns = steps
    .map((s, i) => {
      const fnName = `test_scenario_${i + 1}_${slugify(s.when).slice(0, 40)}`;
      return `def ${fnName}(page: Page):
    """${s.when}"""
    # Given: ${s.given}
    page.goto(os.environ.get("BASE_URL", "https://example.com"))

    # When: ${s.when}
    # TODO: replace with real selectors once the page under test is wired up
    # page.get_by_label("Email").fill("user@example.com")
    # page.get_by_role("button", name=re.compile("submit|log in", re.I)).click()

    # Then: ${s.then}
    expect(page).to_have_url(re.compile(r".+"))
`;
    })
    .join('\n\n');

  return `import os
import re
import pytest
from playwright.sync_api import Page, expect

# Auto-generated from requirement: "${trimmedReq}"
# Generator: AI Co-Pilot for Playwright QA (Smart Template mode)
# Feature: ${feature}


${testFns}`;
}

function buildSingleTypeScript({ feature, steps, requirement }) {
  const trimmedReq = requirement.length > 90 ? `${requirement.slice(0, 90)}…` : requirement;
  const body = steps
    .map(
      (s, i) => `  test('scenario ${i + 1}: ${s.when}', async ({ page }) => {
    // Given: ${s.given}
    await page.goto(process.env.BASE_URL ?? 'https://example.com');

    // When: ${s.when}
    // TODO: replace with real selectors once the page under test is wired up
    // await page.getByLabel('Email').fill('user@example.com');
    // await page.getByRole('button', { name: /submit|log in/i }).click();

    // Then: ${s.then}
    await expect(page).toHaveURL(/.+/);
  });`
    )
    .join('\n\n');

  return `import { test, expect } from '@playwright/test';

// Auto-generated from requirement: "${trimmedReq}"
// Generator: AI Co-Pilot for Playwright QA (Smart Template mode)

test.describe('${feature}', () => {
${body}
});
`;
}

/* ------------------------------------------------------------------ *
 * Bulk / data-driven generation
 * ------------------------------------------------------------------ */

// Compiles {{data.fieldName}}, {{expected}}, {{title}}, {{id}}, {{precondition}},
// {{url}} tokens found in a template's step code into the correct runtime
// expression for the target language. This is what lets ONE template body
// drive thousands of parametrized cases.
export function compileTokens(stepCode, language) {
  if (!stepCode) return '';
  return stepCode.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, path) => {
    const parts = path.split('.');
    if (parts[0] === 'data' && parts[1]) {
      const field = parts[1];
      return language === 'python' ? `case["data"].get(${JSON.stringify(field)}, "")` : `c.data[${JSON.stringify(field)}]`;
    }
    const known = ['expected', 'title', 'id', 'precondition', 'url'];
    if (known.includes(parts[0])) {
      return language === 'python' ? `case["${parts[0]}"]` : `c.${parts[0]}`;
    }
    return language === 'python' ? `case.get(${JSON.stringify(path)}, "")` : `(c as any)[${JSON.stringify(path)}]`;
  });
}

function indent(code, spaces) {
  const pad = ' '.repeat(spaces);
  return code
    .split('\n')
    .map((l) => (l.trim() ? pad + l : ''))
    .join('\n');
}

function defaultStepBlockPython() {
  return `    # No custom template matched this module — showing available data.
    # Wire up real selectors, then reference case["data"]["<field>"] and case["expected"].
    for field_name, field_value in case["data"].items():
        pass  # e.g. page.get_by_label(field_name).fill(str(field_value))
    assert case is not None  # TODO: replace with a real assertion`;
}

function defaultStepBlockTs() {
  return `    // No custom template matched this module — showing available data.
    // Wire up real selectors, then reference c.data['<field>'] and c.expected.
    for (const [fieldName, fieldValue] of Object.entries(c.data)) {
      void fieldName; void fieldValue; // e.g. await page.getByLabel(fieldName).fill(String(fieldValue));
    }
    expect(c).toBeTruthy(); // TODO: replace with a real assertion`;
}

// Extracts the {{data.fieldName}} tokens a template's step code references,
// e.g. "Login Flow" -> ['username', 'password']. Used both to warn the user
// when a module's spreadsheet columns don't match what the template expects,
// and to drive the field-mapping picker in the UI.
export function extractTemplateDataFields(stepCode) {
  if (!stepCode) return [];
  const fields = new Set();
  const re = /\{\{\s*data\.([a-zA-Z0-9_.]+)\s*\}\}/g;
  let m;
  while ((m = re.exec(stepCode))) fields.add(m[1]);
  return [...fields];
}

function lightCasePayload(c, fieldMap) {
  let data = c.data;
  if (fieldMap && Object.keys(fieldMap).length) {
    data = { ...c.data };
    for (const [templateField, sourceField] of Object.entries(fieldMap)) {
      if (!sourceField) continue;
      data[templateField] = c.data[sourceField] ?? data[templateField] ?? '';
    }
  }
  return {
    id: c.id,
    title: c.title,
    steps: c.steps,
    data,
    expected: c.expected,
    precondition: c.precondition,
    url: c.url,
    priority: c.priority,
    type: c.type,
  };
}

/**
 * Renders one module/chunk file. `cases` should already be the slice
 * belonging to this file (post-chunking). `fieldMap` (optional) aliases
 * template token names (e.g. "username") to the actual spreadsheet field
 * key detected for this module (e.g. "login_id"), for cases where header
 * wording doesn't match the template's expected token 1:1.
 */
export function renderBulkModuleFile({ language, moduleName, moduleSlug, cases, template, sourceLabel, partIndex, partTotal, fieldMap }) {
  const dataJson = JSON.stringify(cases.map((c) => lightCasePayload(c, fieldMap)), null, 2);
  const partSuffix = partTotal > 1 ? ` (part ${partIndex}/${partTotal})` : '';
  const rawStepCode = template ? (language === 'python' ? template.pythonSteps : template.typescriptSteps) : null;
  const compiledSteps = rawStepCode
    ? compileTokens(rawStepCode, language)
    : language === 'python'
    ? defaultStepBlockPython()
    : defaultStepBlockTs();

  if (language === 'python') {
    const stepBlock = rawStepCode ? indent(compiledSteps, 4) : compiledSteps;
    return `import os
import pytest
from playwright.sync_api import Page, expect

# Module: ${moduleName}${partSuffix}
# Template: ${template ? template.name : 'Generic Data-Driven (built-in fallback)'}
# Source: ${sourceLabel}
# Cases in this file: ${cases.length}
#
# Auto-generated by AI Co-Pilot for Playwright QA — Test Pack Engine.
# Every entry in TEST_DATA below is one fully traceable test case from the
# uploaded test pack (see id / title for cross-reference to the test case bank).

BASE_URL = os.environ.get("BASE_URL", "https://example.com")

TEST_DATA = ${dataJson}


@pytest.mark.parametrize("case", TEST_DATA, ids=[c["id"] for c in TEST_DATA])
def test_${moduleSlug}(page: Page, case):
    """${moduleName} — data-driven case from the uploaded test pack."""
${stepBlock}
`;
  }

  const stepBlock = rawStepCode ? indent(compiledSteps, 4) : compiledSteps;
  return `import { test, expect } from '@playwright/test';

// Module: ${moduleName}${partSuffix}
// Template: ${template ? template.name : 'Generic Data-Driven (built-in fallback)'}
// Source: ${sourceLabel}
// Cases in this file: ${cases.length}
//
// Auto-generated by AI Co-Pilot for Playwright QA — Test Pack Engine.
// Every entry in testData below is one fully traceable test case from the
// uploaded test pack (see id / title for cross-reference to the test case bank).

const BASE_URL = process.env.BASE_URL ?? 'https://example.com';

const testData = ${dataJson} as const;

for (const c of testData) {
  test(\`${moduleName} — \${c.id}: \${c.title}\`, async ({ page }) => {
${stepBlock}
  });
}
`;
}
