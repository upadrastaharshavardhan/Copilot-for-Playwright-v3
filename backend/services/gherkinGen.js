/**
 * ---------------------------------------------------------------------------
 * Gherkin (.feature) generation for the Test Pack (Excel/CSV bulk) pipeline.
 * ---------------------------------------------------------------------------
 * The Excel "Steps" column is free text written by QA authors. Sometimes it's
 * already Gherkin-flavoured ("Given ... When ... Then ..."), sometimes it's
 * just plain English ("Enter valid credentials", "User is redirected to the
 * dashboard"). This module makes BOTH work:
 *
 *   1. If a step line already starts with Given/When/Then/And/But, that
 *      explicit keyword is trusted as-is.
 *   2. If it doesn't, the step is auto-classified into Given (setup/state),
 *      When (action), or Then (expected outcome) using simple, transparent
 *      keyword heuristics — no AI call required, so it works the same in
 *      offline "template" mode as it does with a live API key.
 *   3. Consecutive steps in the same category collapse onto "And"/"But",
 *      matching how a human would write the scenario by hand.
 *
 * Mixed spreadsheets (some rows fully Given/When/Then, others plain English)
 * are handled per-step, not per-sheet, so a single test pack can freely mix
 * both styles.
 * ---------------------------------------------------------------------------
 */

const EXPLICIT_KEYWORD_RE = /^\s*(given|when|then|and|but)\b[:\-]?\s*/i;

// Outcome / assertion language -> Then
const THEN_RE =
  /\b(should|shall|is (shown|displayed|visible|redirected|disabled|enabled|hidden)|are (shown|displayed|visible)|expect(s|ed)?|verify|validat(e|ed|es)|confirm(s|ed)?|receive(s)?|error (is|message)|success (message|confirmation)|redirect(s|ed)? to|display(s|ed)?|see(s)?\b.*\b(message|result|error|confirmation|page)|shows?)\b/i;

// Setup / precondition language -> Given
const GIVEN_RE =
  /\b(is on the|is logged in|is already|has (an|a) (valid|existing)?\s*account|as a (registered|logged[- ]in)|already logged in|precondition|assume|given that|has permission|is a valid user)\b/i;

// Leading action verbs -> When (checked BEFORE defaulting the first step to
// Given, so plain rows that open with an action like "Enter valid
// credentials..." or "Click submit" are classified correctly).
const WHEN_ACTION_RE =
  /^(enter|click|select|fill|submit|type|choose|upload|navigate|search|tap|press|log\s?in|log\s?out|open|check|uncheck|drag|drop|scroll|hover|swipe|attempt|try|go to)\b/i;

function stripKeyword(raw) {
  const m = String(raw || '').match(EXPLICIT_KEYWORD_RE);
  if (!m) return { text: String(raw || '').trim(), explicitKeyword: null };
  const kw = m[1].toLowerCase();
  return { text: raw.slice(m[0].length).trim(), explicitKeyword: kw };
}

function classifyPlainStep(text, isFirst) {
  if (THEN_RE.test(text)) return 'then';
  if (GIVEN_RE.test(text)) return 'given';
  if (WHEN_ACTION_RE.test(text.trim())) return 'when';
  if (isFirst) return 'given'; // first unlabeled step (no action verb) defaults to scene-setting
  return 'when'; // default: most unlabeled mid-scenario text is an action
}

const CAP = { given: 'Given', when: 'When', then: 'Then' };

/**
 * Turns { precondition, steps, expected } into an ordered list of
 * { keyword, text } Gherkin lines. Works whether the source rows use
 * explicit Given/When/Then/And/But prefixes, plain English, or a mix.
 */
export function buildGherkinLines({ precondition, steps, expected }) {
  const rawEntries = [];
  if (precondition && precondition.trim()) {
    rawEntries.push({ raw: precondition.trim(), forcedCategory: 'given' });
  }
  for (const s of steps || []) {
    if (s && String(s).trim()) rawEntries.push({ raw: String(s).trim() });
  }
  // If the sheet's Expected Result column is populated but never showed up
  // in the steps text, fold it in as a trailing Then so the scenario always
  // ends with a verifiable outcome.
  if (expected && expected.trim()) {
    const alreadyCovered = rawEntries.some((e) => e.raw.toLowerCase().includes(expected.trim().toLowerCase()));
    if (!alreadyCovered) rawEntries.push({ raw: expected.trim(), forcedCategory: 'then' });
  }

  const lines = [];
  let lastCategory = null;

  rawEntries.forEach((entry, idx) => {
    let category;
    let displayKeyword;

    if (entry.forcedCategory) {
      category = entry.forcedCategory;
      displayKeyword = null; // let the And/Given/When/Then logic below decide the word
    } else {
      const { text, explicitKeyword } = stripKeyword(entry.raw);
      entry.raw = text; // use the de-prefixed text as the step body
      if (explicitKeyword === 'given' || explicitKeyword === 'when' || explicitKeyword === 'then') {
        category = explicitKeyword;
      } else if (explicitKeyword === 'and' || explicitKeyword === 'but') {
        // "And"/"But" inherit whatever category came before them, exactly
        // like real Gherkin — if it's the very first line, fall back to Given.
        category = lastCategory || 'given';
        displayKeyword = explicitKeyword === 'but' ? 'But' : null;
      } else {
        // No keyword at all — plain English. Auto-classify it.
        category = classifyPlainStep(text, idx === 0 && !precondition);
      }
    }

    lines.push({ category, forceBut: displayKeyword === 'But', text: entry.raw });
    lastCategory = category;
  });

  // A scenario that never establishes any state (no Given at all — e.g. a
  // spreadsheet row that opens straight with an action verb) still runs
  // fine, but isn't idiomatic Gherkin. Re-anchor the very first line's
  // category to "given" so every generated scenario opens with context,
  // without changing the underlying step text.
  if (lines.length && !lines.some((l) => l.category === 'given')) {
    lines[0].category = 'given';
  }

  // Final pass: derive the actual displayed keyword from the (possibly
  // just-adjusted) category sequence, so consecutive same-category lines
  // collapse onto "And"/"But" and category changes get their proper word.
  let prevCategory = null;
  return lines.map((l) => {
    const keyword = l.category === prevCategory ? (l.forceBut ? 'But' : 'And') : CAP[l.category];
    prevCategory = l.category;
    return { keyword, text: l.text };
  });
}

function escapeForComment(str) {
  return String(str || '').replace(/\r?\n/g, ' ').trim();
}

/**
 * Renders one Scenario block for a single normalized test case.
 */
export function renderScenario(testCase) {
  const lines = buildGherkinLines({
    precondition: testCase.precondition,
    steps: testCase.steps,
    expected: testCase.expected,
  });

  if (!lines.length) {
    // No usable step text at all — still emit a traceable placeholder
    // scenario rather than silently dropping the case from the feature file.
    return `  @${testCase.priority || 'Medium'} @${testCase.type || 'Positive'}
  Scenario: ${escapeForComment(testCase.title)} [${testCase.id}]
    # TODO: no Steps text was found for this row in the source spreadsheet
    Given the preconditions for "${escapeForComment(testCase.title)}" are met
    Then the scenario needs its steps filled in`;
  }

  const body = lines.map((l) => `    ${l.keyword} ${l.text}`).join('\n');
  const tags = `@${(testCase.priority || 'Medium').replace(/\s+/g, '')} @${(testCase.type || 'Positive').replace(/\s+/g, '')}`;

  return `  ${tags}
  Scenario: ${escapeForComment(testCase.title)} [${testCase.id}]
${body}`;
}

/**
 * Renders a full .feature file for one module (or one chunk of a large
 * module), mirroring how renderBulkModuleFile chunks spec files — so every
 * generated .feature file has a 1:1, same-size counterpart .py/.ts file.
 */
export function renderFeatureFile({ moduleName, cases, sourceLabel, partIndex, partTotal }) {
  const partSuffix = partTotal > 1 ? ` (part ${partIndex}/${partTotal})` : '';
  const scenarios = cases.map(renderScenario).join('\n\n');

  return `# Module: ${moduleName}${partSuffix}
# Source: ${sourceLabel}
# Scenarios in this file: ${cases.length}
#
# Auto-generated by AI Co-Pilot for Playwright QA — Test Pack Engine.
# Steps are read from the spreadsheet's Steps/Precondition/Expected Result
# columns. Rows already written as Given/When/Then/And/But are kept as-is;
# plain-English rows are automatically classified into Given (setup),
# When (action), and Then (expected outcome).

Feature: ${moduleName}${partSuffix}

${scenarios}
`;
}
