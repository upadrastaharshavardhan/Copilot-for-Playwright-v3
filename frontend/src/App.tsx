import { useEffect, useState } from 'react';
import { api, HealthResponse } from './api';
import Sidebar from './components/Sidebar';
import GeneratePanel from './components/GeneratePanel';
import HealPanel from './components/HealPanel';
import AnalyzePanel from './components/AnalyzePanel';
import HistoryPanel from './components/HistoryPanel';
import TemplatesPanel from './components/TemplatesPanel';
import TestPackPanel from './components/TestPackPanel';
import TestCasesPanel from './components/TestCasesPanel';
import StatusBadge from './components/StatusBadge';
import './styles/app.css';

export type Tab = 'generate' | 'templates' | 'testpack' | 'testcases' | 'heal' | 'analyze' | 'history';

const TAB_META: Record<Tab, { label: string; eyebrow: string; desc: string }> = {
  generate: {
    label: 'Generate Tests',
    eyebrow: '01 · Requirement → Test',
    desc: 'Turn a plain-English user story into a Gherkin feature file and a runnable Playwright spec, in Python or TypeScript.',
  },
  templates: {
    label: 'Test Templates',
    eyebrow: '02 · Reusable Step Logic',
    desc: 'Write real Playwright interactions once, reference test-pack data with {{data.field}} tokens, and reuse the template across every matching module.',
  },
  testpack: {
    label: 'Test Pack (Excel → Tests)',
    eyebrow: '03 · Spreadsheet → Thousands of Tests',
    desc: 'Upload a QA test pack and let the engine understand it, expand data-driven rows, match templates, and generate a deployable suite.',
  },
  testcases: {
    label: 'Test Case Bank',
    eyebrow: '04 · Manage & Track',
    desc: 'Browse, filter, and track status across every generated test case, with full traceability back to the source spreadsheet.',
  },
  heal: {
    label: 'Self-Heal Locator',
    eyebrow: '05 · Broken → Fixed',
    desc: 'Paste a selector that started failing and a snippet of the current DOM to get ranked, more resilient alternatives.',
  },
  analyze: {
    label: 'Failure RCA',
    eyebrow: '06 · Log → Root Cause',
    desc: 'Paste a Playwright error/stack trace to get a root-cause category and a concrete fix.',
  },
  history: {
    label: 'Run History',
    eyebrow: '07 · Session Log',
    desc: 'Everything generated, healed, or diagnosed this session, most recent first.',
  },
};

export default function App() {
  const [tab, setTab] = useState<Tab>('generate');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <div className="shell">
      <Sidebar activeTab={tab} onSelect={setTab} />
      <main className="console">
        <header className="console-header">
          <div>
            <div className="eyebrow">{TAB_META[tab].eyebrow}</div>
            <h1>{TAB_META[tab].label}</h1>
            <p className="desc">{TAB_META[tab].desc}</p>
          </div>
          <StatusBadge health={health} />
        </header>

        <div className="console-body">
          {tab === 'generate' && <GeneratePanel />}
          {tab === 'templates' && <TemplatesPanel />}
          {tab === 'testpack' && (
            <TestPackPanel
              onGenerated={(runId) => {
                setActiveRunId(runId);
                setTab('testcases');
              }}
            />
          )}
          {tab === 'testcases' && <TestCasesPanel activeRunId={activeRunId} />}
          {tab === 'heal' && <HealPanel />}
          {tab === 'analyze' && <AnalyzePanel />}
          {tab === 'history' && <HistoryPanel />}
        </div>
      </main>
    </div>
  );
}
