# Copilot for Playwright — AI QA Console

An AI-powered console for Playwright automation testers, built around the things QA engineers actually lose time on:

| Tab | What it does |
|---|---|
| **Generate Tests** | Paste a plain-English user story → get a Gherkin `.feature` file + a runnable Playwright spec, in **Python (pytest-playwright, default) or TypeScript**. |
| **Test Templates** | Write real Playwright step logic once (using `{{data.field}}` tokens), tag it with keywords, and it auto-applies to every module in a test pack whose name matches — reused across thousands of generated cases instead of rewritten per case. |
| **Test Pack (Excel → Tests)** | Upload any QA test pack (`.xlsx`/`.xls`/`.csv`). The engine fuzzy-matches columns (Module, Steps, Expected Result, Priority, Type…), expands data-driven columns (`Username_1/2/3`, or pipe-delimited cells) into individually addressable test cases, resolves a template per module, flags any data field a template expects but the sheet doesn't have (with a mapping picker to fix it), and generates a compact, chunked, data-driven Playwright suite — **5,000–10,000+ test cases in well under a second**, packaged as a deployable zip with a test-case bank CSV and a traceability matrix back to the source spreadsheet. |
| **Test Case Bank** | Every generated test case, paginated and filterable by module/type/priority/status, with inline status tracking (Not Run/Passed/Failed/Blocked) and CSV export. |
| **Self-Heal Locator** | Paste a selector that started failing + a snippet of the current DOM → get ranked, more resilient replacement locators with confidence scores and reasons. |
| **Failure RCA** | Paste a Playwright error/stack trace → get a root-cause category and a concrete fix, instead of manually re-reading logs. |
| **Run History** | Everything generated/healed/diagnosed this session, with quick stats. |

It runs in two modes, automatically:

- **Smart Template mode** (default, zero setup) — a deterministic rules engine
  produces real, usable output with no API key and no cost. This is what runs
  out of the box, so the demo never depends on internet access or a paid key.
  The Test Pack / Templates / Test Case Bank features are **fully deterministic
  and don't call any AI model at all** — that's what lets them generate
  thousands of test cases instantly instead of being bottlenecked by LLM calls.
- **Live AI mode** — drop an `ANTHROPIC_API_KEY` into `backend/.env` and the
  Generate Tests endpoint automatically calls Claude instead, with template
  mode as the fallback if the call ever fails. No code changes needed to switch.

The status badge in the top-right of the UI always shows which mode is active.

## How the Test Pack engine scales to thousands of cases

The trick isn't calling AI 10,000 times — it's treating the spreadsheet as
data and generating a small number of **parametrized** spec files:

1. **Understand the sheet** (`backend/services/excelParser.js`) — headers are
   fuzzy-matched against synonyms (e.g. "Expected Result", "Expected Outcome"
   all resolve to the same field), and any column that isn't recognized as
   metadata becomes a raw test-data field.
2. **Expand data-driven rows** — a column group like `Username_1`/`Username_2`,
   or a single cell like `alice|bob|carol`, turns ONE spreadsheet row into
   N fully independent, uniquely-IDed test cases.
3. **Match a template per module** (`backend/services/templateStore.js` +
   `testCaseEngine.js`) — either a built-in (Login, Form, Search, REST API) or
   a custom one you write, matched by keyword against the module name.
4. **Generate one compact function per module**, backed by a `TEST_DATA` /
   `testData` array holding every case — so 1,800 login test cases become 6
   files of 300 (configurable), each running via `pytest.mark.parametrize` /
   a `test.each`-style loop, not 1,800 separate functions.
5. **Package + persist** — a zip with the generated suite, a `test_case_bank.csv`,
   and a `traceability_matrix.csv` mapping every test case ID back to its
   source row; the case bank is also stored server-side for the Test Case
   Bank tab's paginated/filterable view.



## Why this project (for the interview)

This maps directly onto the AI-agent work on the resume — the Doc-to-Test-Case
agent, the natural-language-to-query agent, and RCA-from-logs — but as a single,
demoable, full-stack artifact instead of an internal Copilot Studio flow:
same pattern (LLM + guardrails + structured output), applied to Playwright
specifically. It's also a good hook for "how would you make this production-grade,"
since the honest next steps (real Playwright execution in a sandboxed runner,
persistent DB instead of a JSON file, auth, streaming responses) are easy to
talk through live.

## Tech stack

- **Frontend:** React 18 + TypeScript + Vite (no CSS framework — hand-built
  design system, see `frontend/src/styles`)
- **Backend:** Node.js + Express (ESM)
- **AI:** Anthropic Messages API (optional — template mode needs nothing)
- **Storage:** flat JSON file for run history (intentionally simple; swap for
  SQLite/Postgres for production)

## Run it (2 terminals)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env       # optional — only needed for Live AI mode
npm start
```

Runs on **http://localhost:4000**. Console will print which mode it's in.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on **http://localhost:5173** and proxies `/api/*` to the backend.
Open that URL in your browser.

That's it — no database, no Docker, no external services required for the
default demo path.

### Optional: enable Live AI mode

```bash
# in backend/.env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-5
```

Restart the backend. The status badge switches to `LIVE · Claude API`.

## Project structure

```
ai-playwright-copilot/
├── backend/
│   ├── server.js              # Express app + routes
│   ├── routes/                # generate / templates / testpack / testcases / heal / analyze
│   ├── services/
│   │   ├── aiService.js       # Claude calls + Smart Template fallback (Python/TypeScript)
│   │   ├── excelParser.js     # test-pack column detection + data-driven expansion
│   │   ├── templateStore.js   # built-in + custom template CRUD
│   │   ├── codeGen.js         # language-aware code generation (single + bulk)
│   │   ├── testCaseEngine.js  # groups/chunks cases into generated files per module
│   │   ├── testCaseStore.js   # paginated/filterable persisted test case bank
│   │   ├── zipService.js      # deployable zip packaging
│   │   └── historyStore.js    # flat-file run history
│   └── data/                  # templates.json, testcase-runs/
└── frontend/
    └── src/
        ├── App.tsx             # tab shell
        ├── api.ts              # typed fetch client
        ├── components/         # GeneratePanel, TemplatesPanel, TestPackPanel,
        │                       # TestCasesPanel, HealPanel, AnalyzePanel, HistoryPanel, Sidebar
        └── styles/              # design tokens + layout CSS
```

## Talking points for the panel

- **Why template mode exists at all:** shows you design for reliability and
  cost, not just "call the LLM for everything" — the app degrades gracefully
  instead of breaking when a key is missing or a call fails.
- **Self-heal ranking logic:** locator preference order (testId → aria-label →
  role+name → placeholder → name → id → text) mirrors Playwright's own
  best-practice locator hierarchy — worth explaining why IDs/CSS classes rank
  lowest (most likely to have caused the original break).
- **RCA categorization:** pattern-matches common Playwright failure classes
  (timing, environment, assertion mismatch, strict-mode violations) — a real
  version would ingest historical flake data to tune categories further.
- **Natural extension points:** wire `Generate Tests` output straight into a
  CI job that actually executes the spec in a Playwright container and feeds
  failures back into the RCA tab — closing the loop end-to-end.
