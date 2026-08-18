import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'data', 'templates.json');

// Built-in templates ship every time (re-seeded if missing) so the product
// is useful before anyone writes a custom template. `pythonSteps` /
// `typescriptSteps` use {{data.field}} / {{expected}} / {{title}} tokens —
// see services/codeGen.js#compileTokens for how those get compiled.
const BUILTIN_TEMPLATES = [
  {
    id: 'builtin-generic',
    name: 'Generic Data-Driven',
    description: 'Safe fallback used for any module that has no more specific template. Lists available data as TODOs.',
    category: 'generic',
    keywords: [],
    builtin: true,
    pythonSteps: null,
    typescriptSteps: null,
  },
  {
    id: 'builtin-login',
    name: 'Login Flow',
    description: 'Fills a username/password form and checks the expected outcome text.',
    category: 'login',
    keywords: ['login', 'signin', 'sign-in', 'sign in', 'auth', 'authentication', 'logon'],
    builtin: true,
    pythonSteps: `page.goto(BASE_URL + "/login")
page.get_by_label("Username").fill(str({{data.username}}))
page.get_by_label("Password").fill(str({{data.password}}))
page.get_by_role("button", name="Log in").click()
expect(page.get_by_text(str({{expected}}))).to_be_visible()`,
    typescriptSteps: `await page.goto(BASE_URL + '/login');
await page.getByLabel('Username').fill(String({{data.username}}));
await page.getByLabel('Password').fill(String({{data.password}}));
await page.getByRole('button', { name: 'Log in' }).click();
await expect(page.getByText(String({{expected}}))).toBeVisible();`,
  },
  {
    id: 'builtin-form',
    name: 'Form Submission',
    description: 'Fills a generic multi-field form from the data row and submits it.',
    category: 'form',
    keywords: ['form', 'checkout', 'register', 'signup', 'sign up', 'onboarding', 'application'],
    builtin: true,
    pythonSteps: `page.goto(BASE_URL + "/form")
for field_name, field_value in case["data"].items():
    page.get_by_label(field_name).fill(str(field_value))
page.get_by_role("button", name="Submit").click()
expect(page.get_by_text(str({{expected}}))).to_be_visible()`,
    typescriptSteps: `await page.goto(BASE_URL + '/form');
for (const [fieldName, fieldValue] of Object.entries(c.data)) {
  await page.getByLabel(fieldName).fill(String(fieldValue));
}
await page.getByRole('button', { name: 'Submit' }).click();
await expect(page.getByText(String({{expected}}))).toBeVisible();`,
  },
  {
    id: 'builtin-search',
    name: 'Search & Filter',
    description: 'Types a search term and asserts on the results/empty state.',
    category: 'search',
    keywords: ['search', 'filter', 'query', 'lookup'],
    builtin: true,
    pythonSteps: `page.goto(BASE_URL + "/search")
page.get_by_placeholder("Search").fill(str({{data.query}}))
page.keyboard.press("Enter")
expect(page.get_by_text(str({{expected}}))).to_be_visible()`,
    typescriptSteps: `await page.goto(BASE_URL + '/search');
await page.getByPlaceholder('Search').fill(String({{data.query}}));
await page.keyboard.press('Enter');
await expect(page.getByText(String({{expected}}))).toBeVisible();`,
  },
  {
    id: 'builtin-api',
    name: 'REST API Validation',
    description: 'Calls a REST endpoint directly (no browser) and asserts on the response — for API/service modules.',
    category: 'api',
    keywords: ['api', 'service', 'endpoint', 'rest', 'backend', 'microservice'],
    builtin: true,
    pythonSteps: `import requests
resp = requests.request(
    method=str(case["data"].get("method", "GET")),
    url=BASE_URL + str(case["data"].get("path", "/")),
    json=case["data"].get("body"),
    timeout=15,
)
assert resp.status_code == int(case["data"].get("expected_status", 200))
assert str({{expected}}) == "" or str({{expected}}) in resp.text`,
    typescriptSteps: `const method = String(c.data.method ?? 'GET');
const resp = await page.request.fetch(BASE_URL + String(c.data.path ?? '/'), {
  method,
  data: c.data.body,
});
expect(resp.status()).toBe(Number(c.data.expected_status ?? 200));
const body = await resp.text();
if (String({{expected}})) expect(body).toContain(String({{expected}}));`,
  },
];

function seedIfMissing() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(BUILTIN_TEMPLATES, null, 2));
  }
}

function readAll() {
  seedIfMissing();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    // Ensure builtins are always present even if the file predates a new one
    const existingIds = new Set(parsed.map((t) => t.id));
    const missingBuiltins = BUILTIN_TEMPLATES.filter((t) => !existingIds.has(t.id));
    if (missingBuiltins.length) {
      const merged = [...missingBuiltins, ...parsed];
      fs.writeFileSync(DATA_FILE, JSON.stringify(merged, null, 2));
      return merged;
    }
    return parsed;
  } catch {
    return [...BUILTIN_TEMPLATES];
  }
}

function writeAll(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

export function listTemplates() {
  return readAll();
}

export function getTemplate(id) {
  return readAll().find((t) => t.id === id) || null;
}

export function createTemplate(input) {
  const all = readAll();
  const now = new Date().toISOString();
  const template = {
    id: 'tpl-' + crypto.randomBytes(6).toString('hex'),
    name: input.name?.trim() || 'Untitled template',
    description: input.description?.trim() || '',
    category: input.category?.trim() || 'custom',
    keywords: Array.isArray(input.keywords) ? input.keywords.filter(Boolean) : [],
    builtin: false,
    pythonSteps: input.pythonSteps || '',
    typescriptSteps: input.typescriptSteps || '',
    createdAt: now,
    updatedAt: now,
  };
  all.unshift(template);
  writeAll(all);
  return template;
}

export function updateTemplate(id, input) {
  const all = readAll();
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  if (all[idx].builtin) throw new Error('BUILTIN_READONLY');
  const updated = {
    ...all[idx],
    name: input.name?.trim() ?? all[idx].name,
    description: input.description?.trim() ?? all[idx].description,
    category: input.category?.trim() ?? all[idx].category,
    keywords: Array.isArray(input.keywords) ? input.keywords.filter(Boolean) : all[idx].keywords,
    pythonSteps: input.pythonSteps ?? all[idx].pythonSteps,
    typescriptSteps: input.typescriptSteps ?? all[idx].typescriptSteps,
    updatedAt: new Date().toISOString(),
  };
  all[idx] = updated;
  writeAll(all);
  return updated;
}

export function deleteTemplate(id) {
  const all = readAll();
  const target = all.find((t) => t.id === id);
  if (!target) return false;
  if (target.builtin) throw new Error('BUILTIN_READONLY');
  writeAll(all.filter((t) => t.id !== id));
  return true;
}

/**
 * Picks the best template for a module: explicit override -> keyword match
 * against module name -> generic fallback (null = use built-in defaults).
 */
export function resolveTemplateForModule(moduleName, language, overrideId, allTemplates) {
  const templates = allTemplates || readAll();
  if (overrideId) {
    const t = templates.find((x) => x.id === overrideId);
    if (t) return t;
  }
  const lowerModule = String(moduleName || '').toLowerCase();
  const candidates = templates.filter((t) => t.id !== 'builtin-generic');
  for (const t of candidates) {
    if ((t.keywords || []).some((k) => k && lowerModule.includes(k.toLowerCase()))) {
      return t;
    }
  }
  return templates.find((t) => t.id === 'builtin-generic') || null;
}
