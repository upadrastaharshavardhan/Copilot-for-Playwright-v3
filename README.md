# Copilot for Playwright — AI QA Console

An AI-powered console for Playwright automation testers, built around the tasks QA engineers actually lose time on: converting requirements into tests, scaling spreadsheet-based test packs, reusing automation logic, healing broken locators, and diagnosing failures.

> **Fast by default. AI when you need it.**
>
> The application runs out of the box with a deterministic **Smart Template mode** — no API key, no database, no external services, and no per-test LLM calls. Optionally enable **Live AI mode** with Anthropic Claude for natural-language test generation.

---

## 🚀 Features

| Tab | What it does |
|---|---|
| **Generate Tests** | Paste a plain-English user story and generate a Gherkin `.feature` file plus runnable Playwright automation. Supports **Python (`pytest-playwright`)** and **TypeScript**. |
| **Test Templates** | Write reusable Playwright step logic using `{{data.field}}` tokens and automatically apply it to matching modules across a test pack. |
| **Test Pack** | Upload `.xlsx`, `.xls`, or `.csv` QA test packs and convert thousands of spreadsheet rows into compact, data-driven Playwright suites. |
| **Test Case Bank** | Browse generated test cases with pagination, filtering, inline status tracking, and CSV export. |
| **Self-Heal Locator** | Paste a failing selector and current DOM snippet to get ranked, more resilient replacement locators with confidence scores and reasons. |
| **Failure RCA** | Paste a Playwright error or stack trace to get a root-cause category and concrete fix recommendation. |
| **Run History** | Review everything generated, healed, or diagnosed during the current session with quick statistics. |

---

# 🧠 Two Execution Modes

## Smart Template Mode — Default

The application is fully usable without an AI API key.

A deterministic rules engine generates real, usable Playwright-oriented output using predefined templates and rules.

This is what runs out of the box, so the demo does not depend on internet access or a paid API.

### Smart Template Mode provides

- No API key required
- No external AI dependency
- No per-test LLM calls
- Predictable output
- Very low generation cost
- Fast bulk generation
- Offline-friendly demo experience
- Reliable fallback when AI is unavailable

The **Test Pack**, **Test Templates**, and **Test Case Bank** workflows are deterministic and do not need an AI model.

---

## Live AI Mode — Optional

Live AI mode uses the Anthropic Messages API for natural-language test generation.

Add an Anthropic API key to:

```text
backend/.env
```

Example:

```env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-5
```

Restart the backend.

The status badge changes to:

```text
LIVE · Claude API
```

If an AI request fails, the application can fall back to Smart Template generation.

This means the application remains usable even when the AI service is unavailable.

---

# 📊 How the Test Pack Engine Scales

The key design decision is:

> **Do not call AI 10,000 times to generate 10,000 tests.**

Instead, the spreadsheet is treated as structured test data and the engine generates a small number of parametrized Playwright spec files.

### High-level flow

```text
QA Test Pack
     │
     ▼
┌──────────────────────────┐
│ Excel / CSV Parser       │
│ Fuzzy Column Detection   │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ Data-Driven Expansion    │
│ Username_1/2/3           │
│ alice|bob|carol          │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ Module → Template Match  │
│ Keyword Based Matching   │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ Parametrized Test Suite  │
│ Python / TypeScript      │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ ZIP + CSV + Traceability │
│ + Test Case Bank         │
└──────────────────────────┘
```

---

## 1. Spreadsheet Understanding

`backend/services/excelParser.js` analyzes the uploaded spreadsheet.

Headers are fuzzy-matched against known synonyms.

For example:

```text
Module
Module Name
Feature
Component
```

can resolve to the logical **Module** field.

Similarly:

```text
Expected Result
Expected Outcome
Expected Behavior
```

can resolve to **Expected Result**.

Columns that are not recognized as metadata are retained as raw test-data fields.

This allows the engine to work with real-world QA spreadsheets without requiring an exact column naming convention.

---

## 2. Data-Driven Expansion

The engine supports numbered columns such as:

```text
Username_1
Username_2
Username_3
```

It also supports pipe-delimited values such as:

```text
alice|bob|carol
```

One spreadsheet row can therefore become multiple independently addressable test cases.

Example:

```text
Original Row
     │
     ├── Username_1
     ├── Username_2
     └── Username_3
             │
             ▼
       ┌─────────────┐
       │ TC-001-01   │
       │ TC-001-02   │
       │ TC-001-03   │
       └─────────────┘
```

Every expanded case receives its own test-case identity.

---

## 3. Template Resolution

The engine resolves a reusable template for each module.

Built-in template patterns include:

- Login
- Form
- Search
- REST API

Custom templates can also be created through the **Test Templates** tab.

Example template tokens:

```text
{{data.username}}
{{data.password}}
{{data.searchTerm}}
{{data.expectedMessage}}
```

The template defines the automation behavior while the spreadsheet supplies the test data.

---

## 4. Parametrized Test Generation

Instead of generating thousands of separate functions:

```python
def test_login_001():
    ...

def test_login_002():
    ...

def test_login_003():
    ...
```

the engine generates compact parametrized suites:

```python
@pytest.mark.parametrize("test_data", TEST_DATA)
def test_login(page, test_data):
    ...
```

For example:

```text
1,800 Login test cases
        ↓
6 generated files
        ↓
300 cases per file
```

The chunk size can be configured.

This keeps the generated suite smaller, easier to maintain, and faster to generate.

---

# 🧩 Generate Tests

The **Generate Tests** tab converts a plain-English user story into:

1. Gherkin `.feature`
2. Playwright test implementation
3. Python `pytest-playwright`
4. TypeScript Playwright

Example requirement:

> As a registered user, I want to log in using my username and password, so that I can access my dashboard.

The system generates structured test scenarios and runnable Playwright automation.

---

# ♻️ Test Templates

The Test Templates feature allows automation logic to be written once and reused across many generated test cases.

Example:

```text
{{data.username}}
{{data.password}}
{{data.expectedMessage}}
```

A template can be associated with keywords:

```text
login
authentication
sign in
user login
```

A module such as:

```text
Customer Login Validation
```

can automatically resolve to the Login template.

### Why templates?

Without templates:

```text
1,000 test cases
        ×
Repeated automation logic
        =
Large duplicated codebase
```

With templates:

```text
Reusable Template
        +
Test Data
        ↓
Compact Parametrized Suite
```

This separates **automation behavior** from **test data**.

---

# 📥 Test Pack — Excel → Tests

Supported input formats:

- `.xlsx`
- `.xls`
- `.csv`

The engine automatically:

- Detects common QA columns
- Fuzzy-matches column names
- Preserves unknown columns as test data
- Expands data-driven values
- Generates unique test-case IDs
- Matches templates by module
- Detects missing template fields
- Provides field mapping when required
- Generates Python or TypeScript Playwright
- Chunks large test suites
- Creates a deployable ZIP
- Generates `test_case_bank.csv`
- Generates `traceability_matrix.csv`
- Persists generated cases for the Test Case Bank

---

# 🔗 Template Data Mapping

Templates can declare fields they expect.

Example:

```text
{{data.username}}
{{data.password}}
{{data.accountType}}
```

The spreadsheet may contain:

```text
User Name
Password
Account Type
```

The engine can map these source columns to the template fields.

If a required field is missing, the application flags it rather than silently generating incorrect automation.

This provides an important guardrail for large-scale test generation.

---

# 🧪 Test Case Bank

Every generated test case is persisted in the Test Case Bank.

The Test Case Bank supports:

- Pagination
- Filtering
- Module filtering
- Type filtering
- Priority filtering
- Status filtering
- Inline status tracking
- CSV export

Supported statuses:

```text
Not Run
Passed
Failed
Blocked
```

The Test Case Bank provides a lightweight view of the relationship between the source QA test pack and the generated automation.

---

# 🩹 Self-Heal Locator

The **Self-Heal Locator** feature accepts:

1. A selector that has started failing
2. A snippet of the current DOM

The engine generates and ranks replacement locators.

### Locator preference

```text
1. Test ID
2. ARIA label
3. Role + accessible name
4. Placeholder
5. Name
6. ID
7. Text
8. CSS / class-based selectors
```

Each candidate includes:

- Replacement locator
- Confidence score
- Reason for ranking

### Why semantic locators rank higher

Selectors based on user-facing semantics are generally more resilient:

```text
data-testid
aria-label
role
accessible name
placeholder
```

than implementation-specific selectors such as:

```text
CSS classes
deep CSS paths
generated IDs
fragile DOM hierarchy
```

This follows the general Playwright best practice of preferring resilient user-facing locators.

---

# 🔎 Failure RCA

The **Failure RCA** feature accepts a Playwright error or stack trace.

It identifies common failure categories such as:

```text
Timing / Synchronization
Environment
Assertion Mismatch
Strict-Mode Violation
Locator Failure
Navigation Failure
Unknown / Unclassified
```

The output provides:

- Root-cause category
- Explanation
- Likely cause
- Recommended fix

A production implementation could extend this with historical failure and flake data to improve RCA accuracy over time.

---

# 📜 Run History

The Run History tab provides a session-level view of generated activity.

It can track:

```text
Test generation
Test-pack generation
Locator healing
Failure analysis
```

Quick statistics make it easy to demonstrate the complete workflow during an interview or technical walkthrough.

---

# 🏗️ Architecture

```text
                    ┌─────────────────────────┐
                    │       React + Vite       │
                    │                         │
                    │  Generate Tests          │
                    │  Templates               │
                    │  Test Pack               │
                    │  Test Case Bank          │
                    │  Self-Heal               │
                    │  Failure RCA             │
                    │  Run History             │
                    └────────────┬────────────┘
                                 │
                              /api/*
                                 │
                    ┌────────────▼────────────┐
                    │    Node.js + Express     │
                    │                          │
                    │  Routes                  │
                    │  Services                │
                    │  Storage                 │
                    └─────────┬─────────┬──────┘
                              │         │
                 ┌────────────▼───┐   ┌─▼────────────────┐
                 │ Smart Template │   │ Optional Claude  │
                 │ Engine         │   │ Messages API     │
                 └────────────┬───┘   └──────────────────┘
                              │
                 ┌────────────▼────────────┐
                 │ Generated Playwright    │
                 │ Python / TypeScript     │
                 └─────────────────────────┘
```

---

# 📁 Project Structure

```text
ai-playwright-copilot/
│
├── backend/
│   ├── server.js
│   │
│   ├── routes/
│   │   ├── generate/
│   │   ├── templates/
│   │   ├── testpack/
│   │   ├── testcases/
│   │   ├── heal/
│   │   └── analyze/
│   │
│   ├── services/
│   │   ├── aiService.js
│   │   ├── excelParser.js
│   │   ├── templateStore.js
│   │   ├── codeGen.js
│   │   ├── testCaseEngine.js
│   │   ├── testCaseStore.js
│   │   ├── zipService.js
│   │   └── historyStore.js
│   │
│   └── data/
│       ├── templates.json
│       └── testcase-runs/
│
└── frontend/
    └── src/
        ├── App.tsx
        ├── api.ts
        │
        ├── components/
        │   ├── GeneratePanel.tsx
        │   ├── TemplatesPanel.tsx
        │   ├── TestPackPanel.tsx
        │   ├── TestCasesPanel.tsx
        │   ├── HealPanel.tsx
        │   ├── AnalyzePanel.tsx
        │   ├── HistoryPanel.tsx
        │   └── Sidebar.tsx
        │
        └── styles/
            ├── tokens
            └── layout
```

---

# 🛠️ Tech Stack

## Frontend

- React 18
- TypeScript
- Vite
- Custom CSS design system
- No CSS framework

## Backend

- Node.js
- Express
- ES Modules

## AI

- Anthropic Messages API
- Claude
- Optional — Smart Template mode requires no AI

## Storage

- Flat JSON files for the demo
- Designed to be replaced with SQLite/PostgreSQL

## Test Automation

- Playwright
- Python
- pytest-playwright
- TypeScript Playwright

---

# ⚡ Getting Started

## Prerequisites

Install:

- Node.js
- npm

No database or Docker setup is required for the default demo.

---

## 1. Start the Backend

Open Terminal 1:

```bash
cd backend
npm install
cp .env.example .env
npm start
```

Backend:

```text
http://localhost:4000
```

The backend console prints which execution mode is active.

> `.env` is optional for Smart Template mode.

---

## 2. Start the Frontend

Open Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

Open the Vite URL in your browser.

The frontend proxies `/api/*` requests to the backend.

---

# 🤖 Enable Live AI Mode

Create or update:

```text
backend/.env
```

Add:

```env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-5
```

Restart the backend.

The UI should show:

```text
LIVE · Claude API
```

If the API call fails, the application can fall back to Smart Template generation.

---

# 📦 Generated ZIP

A generated test-pack ZIP contains the automation artifacts required to continue development or deployment.

Typical structure:

```text
generated-test-suite/
│
├── features/
│   └── *.feature
│
├── tests/
│   └── *.py / *.ts
│
├── test_case_bank.csv
│
├── traceability_matrix.csv
│
└── supporting configuration/files
```

The exact structure depends on the selected language and test-pack configuration.

---

# 🔗 Traceability Matrix

Every generated test case can be mapped back to its source spreadsheet row.

Example:

```text
Source Spreadsheet
       │
       ▼
Source Row 127
       │
       ▼
TC-0127-01
TC-0127-02
TC-0127-03
       │
       ▼
Generated Playwright Test
```

The generated `traceability_matrix.csv` answers:

> **Where did this automated test come from?**

This is particularly useful for enterprise QA environments with large test packs.

---

# 🎯 Design Principles

## Reliability Over Unnecessary AI

Not every problem needs an LLM.

The application intentionally separates:

```text
Deterministic Transformation
+
Reusable Templates
+
Optional AI Reasoning
```

This reduces:

- Cost
- Latency
- API dependency
- Failure modes

---

## Data-Driven Generation Over Code Duplication

The test pack is treated as **data**, while templates define **behavior**.

This distinction allows thousands of test cases to be generated without creating thousands of repetitive functions.

---

## Graceful Degradation

The application remains functional when:

- No API key exists
- AI service is unavailable
- AI request fails
- Internet connectivity is unavailable

The deterministic generation path remains available.

---

# 💼 Why This Project?

This project maps directly to common AI-agent patterns used in modern QA engineering:

```text
Unstructured Input
       ↓
Interpretation
       ↓
Structured Output
       ↓
Validation / Guardrails
       ↓
Deterministic Transformation
       ↓
Generated Automation
       ↓
Execution / Feedback
```

It brings several capabilities into one full-stack artifact:

- Document → test-case generation
- Natural language → structured output
- Reusable automation templates
- Spreadsheet → executable tests
- Locator self-healing
- Failure RCA
- Test traceability
- AI fallback architecture
- Cost-aware automation design

Instead of demonstrating these as isolated internal workflows, the project presents them as one cohesive **Playwright QA Copilot**.

---

# 🗣️ Interview Talking Points

## Why Have Smart Template Mode?

Production automation should not depend on an LLM for every operation.

The deterministic engine provides:

- Reliability
- Predictable output
- Lower cost
- Lower latency
- Offline/demo capability
- Fast bulk generation

AI is used where probabilistic reasoning adds value instead of where deterministic transformation is sufficient.

---

## Why Not Call AI 10,000 Times?

Because the spreadsheet already contains structured test data.

The efficient approach is:

```text
1 Template
+
10,000 Data Records
+
Parametrized Playwright Tests
```

rather than:

```text
10,000 LLM Requests
```

This is faster, cheaper, and easier to control.

---

## Why Templates?

Templates separate:

```text
Automation Behavior
```

from:

```text
Test Data
```

A change to login automation can therefore be made once and reused across many test cases.

---

## How Does Self-Healing Work?

The locator engine ranks candidates according to expected stability.

Semantic locators such as:

```python
page.get_by_test_id(...)
page.get_by_role(...)
page.get_by_label(...)
page.get_by_placeholder(...)
```

are preferred over brittle implementation details such as CSS classes and deep DOM paths.

---

## How Does RCA Work?

The demo uses deterministic pattern matching against common Playwright failure signatures.

A production version could add:

```text
Historical Failures
+
Flake Frequency
+
Environment Metadata
+
Previous Fixes
```

to continuously improve RCA recommendations.

---

# 🚀 Production Roadmap

The current implementation intentionally keeps infrastructure simple so the core QA automation concepts are easy to demonstrate.

Natural production extensions include:

## Test Execution

- Sandboxed Playwright workers
- Containerized execution
- Browser isolation
- Parallel execution
- Artifact collection
- Screenshots
- Videos
- Playwright traces

## Persistence

Replace flat JSON storage with:

- PostgreSQL
- SQLite

depending on deployment requirements.

## Security

- Authentication
- Role-based access control
- API-key management
- Secrets management
- Input validation
- Rate limiting
- Sandboxed test execution

## AI

- Streaming responses
- Structured output validation
- Prompt/version management
- Model routing
- Token/cost tracking
- Evaluation datasets
- Historical failure learning

## CI/CD

A natural next step is:

```text
Generate Test
      ↓
Commit / Package
      ↓
CI Job
      ↓
Playwright Execution
      ↓
Failures
      ↓
RCA
      ↓
Self-Heal Recommendation
      ↓
Developer / QA Review
```

This closes the loop between:

**Test Generation → Execution → Diagnosis → Maintenance**

---

# 🎬 Suggested Interview Demo Flow

A simple 5–10 minute demo can follow this sequence.

### 1. Generate a Test

Enter a user story and show:

```text
Requirement
    ↓
Gherkin
    ↓
Playwright Python / TypeScript
```

### 2. Show a Reusable Template

Demonstrate:

```text
{{data.username}}
{{data.password}}
```

Explain how one automation implementation can be reused across many test cases.

### 3. Upload a Test Pack

Show:

- Fuzzy column detection
- Data-driven expansion
- Template matching
- Missing field detection

### 4. Generate Thousands of Cases

Explain that the engine creates parametrized tests instead of making thousands of AI calls.

### 5. Open the Test Case Bank

Filter by:

- Module
- Priority
- Type
- Status

### 6. Download the ZIP

Show:

```text
features/
tests/
test_case_bank.csv
traceability_matrix.csv
```

### 7. Demonstrate Self-Healing

Provide a broken selector and current DOM.

Show the ranked replacement locators and confidence scores.

### 8. Demonstrate RCA

Paste a Playwright stack trace.

Show:

```text
Failure Category
+
Root Cause
+
Recommended Fix
```

### 9. Explain Production Evolution

Finish with:

```text
Sandboxed Playwright Runner
+
Persistent Database
+
Authentication
+
CI/CD
+
Historical Flake Intelligence
```

---

# 📸 Screenshots

## 01 · Requirement → Test

### Generate Tests

![Generate Tests](https://github.com/user-attachments/assets/c89fc746-ca30-464a-b01d-d2a1cdcee2fe)

---

## 02 · Reusable Step Logic

### Test Templates

![Test Templates](https://github.com/user-attachments/assets/2b9235a6-eda0-4823-b04b-222eef74c952)

![Test Templates](https://github.com/user-attachments/assets/90c10f22-20c8-4a40-a999-93993549e171)

---

## 03 · Spreadsheet → Thousands of Tests

### Test Pack

![Test Pack](https://github.com/user-attachments/assets/1c67cab1-12d3-4c7d-b066-7c65ac4e5721)

![Test Pack](https://github.com/user-attachments/assets/3294d294-14a0-4e26-8710-88c7e20b0da1)

![Test Pack](https://github.com/user-attachments/assets/3374cfc7-d9e2-46cd-ae16-d0ee6acb2440)

![Test Pack](https://github.com/user-attachments/assets/8c111344-ec6a-4c2f-b494-92af27df7987)

---

## 04 · Generated Feature File

![Feature File](https://github.com/user-attachments/assets/51bfd25e-f0aa-4377-b341-bdc6d517149a)

---

## 05 · Generated Python Playwright Test

![Python Test](https://github.com/user-attachments/assets/2edc44a0-e655-439a-bfda-415132b67e79)

---

## 06 · Download Deployable ZIP

![Download ZIP](https://github.com/user-attachments/assets/43273211-ce99-4738-82a8-0ed4e7f4cbde)

---

## 07 · File Manager

![File Manager](https://github.com/user-attachments/assets/a68e5947-bcc0-4b75-87b2-ca4e6cf23a35)

### Features Folder

![Features Folder](https://github.com/user-attachments/assets/6a9b8923-5295-492e-b381-00e7092474b0)

![Features Files](https://github.com/user-attachments/assets/cc35d56f-18ef-4c2f-b494-92af27df7987)

### Python Test Files

![Python Files](https://github.com/user-attachments/assets/a25583ea-dade-4cb2-90d1-c07e07d0efac)

![Python Test Files](https://github.com/user-attachments/assets/ab9df248-4832-450b-8359-2d69582c3779)

---

# 📌 Summary

**Copilot for Playwright** is a full-stack AI-assisted QA automation console that combines:

```text
Natural Language
       +
Reusable Templates
       +
Excel / CSV Test Packs
       +
Data-Driven Generation
       +
Playwright
       +
Locator Self-Healing
       +
Failure RCA
       +
Traceability
```

The key architectural principle is:

> **Use deterministic automation for deterministic problems, and AI where reasoning actually adds value.**

This makes the system faster, cheaper, more reliable, and easier to evolve into a production-grade QA automation platform.

---

# ⭐ End-to-End Value Proposition

```text
Requirements
     ↓
AI / Deterministic Rules
     ↓
Gherkin + Playwright
     ↓
Reusable Templates
     ↓
Excel Test Pack
     ↓
Thousands of Parametrized Tests
     ↓
Deployable ZIP
     ↓
Playwright CI Execution
     ↓
Failure RCA
     ↓
Self-Healing
```

**One console. One workflow. From requirement to executable Playwright automation.**
<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/43c855b0-699d-46b1-af5d-bd11a333bbc2" />


