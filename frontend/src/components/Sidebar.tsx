import { Tab } from '../App';

const ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: 'generate', label: 'Generate Tests', icon: '▶' },
  { id: 'templates', label: 'Test Templates', icon: '▦' },
  { id: 'testpack', label: 'Test Pack (Excel)', icon: '⇪' },
  { id: 'testcases', label: 'Test Case Bank', icon: '☰' },
  { id: 'heal', label: 'Self-Heal Locator', icon: '⟲' },
  { id: 'analyze', label: 'Failure RCA', icon: '◆' },
  { id: 'history', label: 'Run History', icon: '≡' },
];

export default function Sidebar({
  activeTab,
  onSelect,
}: {
  activeTab: Tab;
  onSelect: (t: Tab) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">PW</div>
        <div className="brand-text">
          Copilot for Playwright
          <span>AI QA Console</span>
        </div>
      </div>

      <nav className="nav">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onSelect(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        Built by <b>Harsha Vardhan Upadrasta</b> — AI Automation QA Engineer.
        Generates BDD + Playwright specs in Python or TypeScript, understands
        Excel test packs to bulk-generate thousands of data-driven test
        cases, heals broken locators, and diagnoses failures.
      </div>
    </aside>
  );
}
