import archiver from 'archiver';
import fs from 'fs';

function csvEscape(val) {
  const s = String(val ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function casesToCsv(cases) {
  const header = ['id', 'module', 'title', 'type', 'priority', 'status', 'expected', 'precondition', 'steps', 'data', 'sourceSheet', 'sourceRow'];
  const lines = [header.join(',')];
  for (const c of cases) {
    lines.push(
      [
        c.id,
        c.module,
        c.title,
        c.type,
        c.priority,
        c.status,
        c.expected,
        c.precondition,
        (c.steps || []).join(' | '),
        JSON.stringify(c.data || {}),
        c.sourceSheet,
        c.sourceRow,
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  return lines.join('\n');
}

function traceabilityCsv(cases, files) {
  const caseToFile = new Map();
  for (const f of files) {
    for (const id of f.caseIds || []) caseToFile.set(id, f.path);
  }
  const header = ['testCaseId', 'module', 'generatedFile', 'sourceSheet', 'sourceRow', 'variant'];
  const lines = [header.join(',')];
  for (const c of cases) {
    lines.push(
      [c.id, c.module, caseToFile.get(c.id) || '', c.sourceSheet, c.sourceRow, `${c.variantIndex}/${c.variantTotal}`]
        .map(csvEscape)
        .join(',')
    );
  }
  return lines.join('\n');
}

function readmeText({ language, summary }) {
  const runCmd =
    language === 'python'
      ? `pip install -r requirements.txt
playwright install
pytest -v`
      : `npm install
npx playwright install
npx playwright test`;

  return `# Generated Test Suite — AI Co-Pilot for Playwright QA

Source: ${summary.sourceLabel}
Generated: ${summary.createdAt}
Language: ${language === 'python' ? 'Python (pytest-playwright)' : 'TypeScript (@playwright/test)'}
Total test cases: ${summary.totalCases}
Modules: ${summary.moduleSummary.length}

## What's in here

- \`tests/\` — one or more spec files per module. Each file holds a single,
  compact data-driven test function/loop backed by a \`TEST_DATA\` /
  \`testData\` array, so large test packs stay readable instead of exploding
  into thousands of near-duplicate functions.
- \`features/\` — one \`.feature\` (Gherkin) file per module, matching the
  chunking of \`tests/\`. Rows in the spreadsheet's Steps column that already
  read as Given/When/Then/And/But are kept as-is; plain-English rows are
  automatically classified into Given (setup), When (action), and
  Then (expected outcome) — no special formatting is required in Excel.
- \`test_case_bank.csv\` — every generated test case (ID, module, steps,
  data, expected result, priority, type, status) in one flat file for
  reporting/traceability.
- \`traceability_matrix.csv\` — maps each test case ID back to its source
  spreadsheet row and the generated file it lives in.

## Run it

\`\`\`bash
${runCmd}
\`\`\`

Set \`BASE_URL\` (env var) to point the suite at your environment before running.

## Wiring up real selectors

Every generated test currently uses either your custom Template's step code
(if one matched the module) or TODO placeholders. Search for \`TODO\` across
\`tests/\` to find spots that still need real Playwright locators.
`;
}

/**
 * Streams a deployable zip (test files + reports) to `outPath`.
 * Resolves with { zipPath, bytes }.
 */
export function buildZip({ outPath, language, files, cases, summary }) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve({ zipPath: outPath, bytes: archive.pointer() }));
    archive.on('error', reject);
    archive.pipe(output);

    for (const f of files) {
      archive.append(f.code, { name: f.path });
    }

    archive.append(casesToCsv(cases), { name: 'test_case_bank.csv' });
    archive.append(traceabilityCsv(cases, files), { name: 'traceability_matrix.csv' });
    archive.append(readmeText({ language, summary }), { name: 'README.md' });

    if (language === 'python') {
      archive.append(
        `pytest-playwright>=0.5.2\nplaywright>=1.45.0\nrequests>=2.32.0\n`,
        { name: 'requirements.txt' }
      );
      archive.append(
        `[pytest]\naddopts = -ra\ntestpaths = tests\n`,
        { name: 'pytest.ini' }
      );
      archive.append(
        `import os\nimport pytest\n\n\n@pytest.fixture(scope="session")\ndef base_url():\n    return os.environ.get("BASE_URL", "https://example.com")\n`,
        { name: 'conftest.py' }
      );
    } else {
      archive.append(
        JSON.stringify(
          {
            name: 'generated-test-suite',
            private: true,
            scripts: { test: 'playwright test' },
            devDependencies: { '@playwright/test': '^1.46.0' },
          },
          null,
          2
        ),
        { name: 'package.json' }
      );
      archive.append(
        `import { defineConfig } from '@playwright/test';\n\nexport default defineConfig({\n  testDir: './tests',\n  fullyParallel: true,\n  reporter: [['list'], ['html', { open: 'never' }]],\n  use: {\n    baseURL: process.env.BASE_URL ?? 'https://example.com',\n    trace: 'on-first-retry',\n  },\n});\n`,
        { name: 'playwright.config.ts' }
      );
    }

    archive.finalize();
  });
}
