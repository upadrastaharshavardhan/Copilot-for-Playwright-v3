import 'dotenv/config';
import { slugify as coreSlugify, buildSingleSpec, specFilename } from './codeGen.js';

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
const API_URL = 'https://api.anthropic.com/v1/messages';

export const aiMode = API_KEY ? 'live' : 'template';

/**
 * Calls Claude if a key is configured, otherwise throws so callers
 * fall back to deterministic template generation. This keeps the demo
 * working with zero setup, and upgrades automatically once a key is added.
 */
async function callClaude(systemPrompt, userPrompt) {
  if (!API_KEY) {
    throw new Error('NO_API_KEY');
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const textBlock = data.content?.find((b) => b.type === 'text');
  return textBlock ? textBlock.text : '';
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 6)
    .join('_');
}

/**
 * Extremely lightweight heuristic parser that turns a plain-English
 * requirement into Gherkin steps + a matching Playwright spec.
 * This is the offline "Smart Template" engine used when no AI key is set.
 * Supports both Python (pytest-playwright) and TypeScript (@playwright/test)
 * output — `language` defaults to 'python'.
 */
function templateGenerateTests(requirement, language = 'python') {
  const feature = requirement.split(/[.\n]/)[0].trim() || 'Feature under test';
  const slug = slugify(feature) || 'generated_test';

  const lower = requirement.toLowerCase();
  const isLogin = /log ?in|sign ?in|authenticat/.test(lower);
  const isForm = /form|submit|checkout|register|sign ?up/.test(lower);
  const isSearch = /search|filter|query/.test(lower);

  let steps = [
    { given: 'the user is on the application', when: 'the page has fully loaded', then: 'the primary UI elements are visible' },
  ];

  if (isLogin) {
    steps = [
      { given: 'the user is on the login page', when: 'they enter valid credentials and submit the form', then: 'they are redirected to the dashboard' },
      { given: 'the user is on the login page', when: 'they enter invalid credentials and submit the form', then: 'an inline validation error is displayed' },
    ];
  } else if (isForm) {
    steps = [
      { given: 'the user is on the form page', when: 'they fill in all required fields and submit', then: 'a success confirmation is shown' },
      { given: 'the user is on the form page', when: 'they submit with a required field missing', then: 'a field-level validation error is shown' },
    ];
  } else if (isSearch) {
    steps = [
      { given: 'the user is on the search page', when: 'they enter a valid search term and press enter', then: 'matching results are displayed' },
      { given: 'the user is on the search page', when: 'they enter a term with no matches', then: 'an empty-state message is shown' },
    ];
  }

  const gherkin = `Feature: ${feature}

${steps
  .map(
    (s, i) => `  Scenario: ${feature} - scenario ${i + 1}
    Given ${s.given}
    When ${s.when}
    Then ${s.then}`
  )
  .join('\n\n')}
`;

  const playwright = buildSingleSpec({ feature, slug, steps, requirement, language });
  const filename = specFilename(coreSlugify(feature) || slug, language);

  return { feature, slug, gherkin, playwright, language, filename, mode: 'template' };
}

export async function generateTests(requirement, language = 'python') {
  const lang = language === 'typescript' ? 'typescript' : 'python';
  const langLabel = lang === 'python' ? 'Python (pytest-playwright, using the sync API)' : 'TypeScript (@playwright/test)';
  const systemPrompt = `You are a senior QA automation engineer. Given a plain-English requirement or user story,
produce two artifacts:
1. A Gherkin feature file (happy path + at least one negative/edge case).
2. A matching Playwright test spec written in ${langLabel}, with realistic, well-named selectors using
   getByRole/getByLabel/getByTestId where sensible, and TODO comments where a real selector can't be known.
Return STRICT JSON only, no markdown fences, no prose, in this exact shape:
{"feature": "string", "gherkin": "string", "playwright": "string"}`;

  try {
    const raw = await callClaude(systemPrompt, `Requirement:\n${requirement}`);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    const slug = slugify(parsed.feature || requirement);
    return { ...parsed, slug, language: lang, filename: specFilename(slug, lang), mode: 'live' };
  } catch (err) {
    return templateGenerateTests(requirement, lang);
  }
}

function templateHealLocator(brokenSelector, domSnippet) {
  const candidates = [];
  const sel = brokenSelector.trim();

  // Try to mine attributes out of the provided DOM snippet for smarter guesses
  const testIdMatch = domSnippet.match(/data-testid=["']([\w-]+)["']/);
  const idMatch = domSnippet.match(/(?<![\w-])id=["']([\w-]+)["']/);
  const nameMatch = domSnippet.match(/name=["']([\w-]+)["']/);
  const placeholderMatch = domSnippet.match(/placeholder=["']([^"']+)["']/);
  const ariaLabelMatch = domSnippet.match(/aria-label=["']([^"']+)["']/);
  const textMatch = domSnippet.match(/>([^<>{}\n]{2,40})</);
  const roleMatch = domSnippet.match(/role=["'](\w+)["']/);

  if (testIdMatch) {
    candidates.push({ selector: `page.getByTestId('${testIdMatch[1]}')`, confidence: 0.97, reason: 'Stable data-testid found in current DOM' });
  }
  if (ariaLabelMatch) {
    candidates.push({ selector: `page.getByLabel('${ariaLabelMatch[1]}')`, confidence: 0.9, reason: 'aria-label is accessible and rarely renamed' });
  }
  if (roleMatch && textMatch) {
    candidates.push({ selector: `page.getByRole('${roleMatch[1]}', { name: '${textMatch[1].trim()}' })`, confidence: 0.88, reason: 'Role + accessible name combination' });
  }
  if (placeholderMatch) {
    candidates.push({ selector: `page.getByPlaceholder('${placeholderMatch[1]}')`, confidence: 0.8, reason: 'Placeholder text matched in current markup' });
  }
  if (nameMatch) {
    candidates.push({ selector: `page.locator('[name="${nameMatch[1]}"]')`, confidence: 0.75, reason: 'name attribute still present' });
  }
  if (idMatch) {
    candidates.push({ selector: `page.locator('#${idMatch[1]}')`, confidence: 0.6, reason: 'id present, but IDs are the most likely to have been the original break cause - use with caution' });
  }
  if (textMatch && candidates.length < 2) {
    candidates.push({ selector: `page.getByText('${textMatch[1].trim()}')`, confidence: 0.55, reason: 'Fallback to visible text match' });
  }

  if (candidates.length === 0) {
    candidates.push({
      selector: `page.locator('${sel}').first()`,
      confidence: 0.3,
      reason: 'No stronger anchors found in the supplied HTML snippet - paste more surrounding markup for a better suggestion',
    });
  }

  return {
    original: sel,
    suggestions: candidates.sort((a, b) => b.confidence - a.confidence),
    mode: 'template',
  };
}

export async function healLocator(brokenSelector, domSnippet) {
  const systemPrompt = `You are a Playwright self-healing locator engine. Given a broken CSS/XPath selector and a
snippet of the CURRENT page HTML, propose up to 4 ranked alternative Playwright locators (prefer getByRole,
getByLabel, getByTestId, getByPlaceholder, in that order of stability), each with a confidence 0-1 and a one-line reason.
Return STRICT JSON only: {"suggestions": [{"selector": "string", "confidence": 0.0, "reason": "string"}]}`;

  try {
    const raw = await callClaude(
      systemPrompt,
      `Broken selector: ${brokenSelector}\n\nCurrent DOM snippet:\n${domSnippet}`
    );
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return { original: brokenSelector, suggestions: parsed.suggestions, mode: 'live' };
  } catch (err) {
    return templateHealLocator(brokenSelector, domSnippet || '');
  }
}

function templateAnalyzeFailure(errorLog) {
  const lower = errorLog.toLowerCase();
  let category = 'Unknown failure';
  let rootCause = 'The error text did not match a known pattern in template mode.';
  let fix = 'Paste the full stack trace, or add an ANTHROPIC_API_KEY for a deeper AI analysis.';

  if (/timeout.*exceed|waiting for selector|locator.*not found/.test(lower)) {
    category = 'Locator / Timing issue';
    rootCause = 'The element was not present or not visible within the wait window - likely a stale selector, a slow-loading async component, or a missing explicit wait.';
    fix = "Replace hard waits with 'await expect(locator).toBeVisible()', verify the selector still matches the live DOM, and consider network idle waits for SPA route transitions.";
  } else if (/net::err|econnrefused|failed to fetch|500 internal/.test(lower)) {
    category = 'Environment / Backend issue';
    rootCause = 'The test failed due to a network or backend error rather than a UI assertion failure - likely an unavailable test environment or backend service.';
    fix = 'Verify the target environment is up before the run, add a health-check step, and retry with backoff for flaky environments.';
  } else if (/expect.*received|tohaveTe(xt|value)|assertion/.test(lower)) {
    category = 'Assertion mismatch';
    rootCause = 'The actual UI state did not match the expected value - could be a genuine regression or test data drift.';
    fix = 'Diff expected vs actual values from the log, confirm whether recent product changes are intentional, and update the assertion or file a defect accordingly.';
  } else if (/strict mode violation|resolved to \d+ elements/.test(lower)) {
    category = 'Ambiguous locator';
    rootCause = 'The selector matched multiple elements, so Playwright strict mode rejected the action.';
    fix = "Scope the locator further (e.g. chain with '.filter()' or a parent test-id) so it resolves to exactly one element.";
  }

  return { category, rootCause, fix, mode: 'template' };
}

export async function analyzeFailure(errorLog, testCode) {
  const systemPrompt = `You are a senior QA automation engineer performing root-cause analysis on a failing Playwright test.
Given the error log (and optionally the test code), return STRICT JSON only:
{"category": "short category label", "rootCause": "1-3 sentence explanation", "fix": "concrete, actionable fix"}`;

  try {
    const raw = await callClaude(
      systemPrompt,
      `Error log:\n${errorLog}\n\nTest code (optional):\n${testCode || 'N/A'}`
    );
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return { ...parsed, mode: 'live' };
  } catch (err) {
    return templateAnalyzeFailure(errorLog);
  }
}
