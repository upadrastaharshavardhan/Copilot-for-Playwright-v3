import { Language } from '../api';

export default function LanguageToggle({
  value,
  onChange,
}: {
  value: Language;
  onChange: (lang: Language) => void;
}) {
  return (
    <div className="lang-toggle" role="tablist" aria-label="Output language">
      <button
        type="button"
        role="tab"
        aria-selected={value === 'python'}
        className={`lang-toggle-btn ${value === 'python' ? 'active' : ''}`}
        onClick={() => onChange('python')}
      >
        <span className="lang-dot py" /> Python
        <span className="lang-sub">pytest-playwright</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'typescript'}
        className={`lang-toggle-btn ${value === 'typescript' ? 'active' : ''}`}
        onClick={() => onChange('typescript')}
      >
        <span className="lang-dot ts" /> TypeScript
        <span className="lang-sub">@playwright/test</span>
      </button>
    </div>
  );
}
