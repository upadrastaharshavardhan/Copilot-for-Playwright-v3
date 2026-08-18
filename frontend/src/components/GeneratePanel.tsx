import { useState } from 'react';
import { api, GenerateResponse, Language } from '../api';
import CodeBlock from './CodeBlock';
import LanguageToggle from './LanguageToggle';

const EXAMPLES = [
  'As a returning customer, I want to log in with valid credentials and see a clear error on invalid login, so that I trust the authentication flow.',
  'As a shopper, I want to add an item to my cart and complete checkout with a saved address, so that I can complete a purchase quickly.',
  'As a user, I want to search for a product by name and see an empty state when nothing matches.',
];

export default function GeneratePanel() {
  const [requirement, setRequirement] = useState('');
  const [language, setLanguage] = useState<Language>('python');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  const run = async () => {
    if (!requirement.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.generateTests(requirement.trim(), language);
      setResult(res);
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel-grid">
      <div className="card">
        <div className="card-label">User story / requirement</div>
        <textarea
          className="field"
          placeholder="Describe the feature in plain English…"
          value={requirement}
          onChange={(e) => setRequirement(e.target.value)}
        />
        <div className="field-hint">
          Try:{' '}
          {EXAMPLES.map((ex, i) => (
            <span key={i}>
              <button
                className="copy-btn"
                style={{ marginRight: 6, marginTop: 6 }}
                onClick={() => setRequirement(ex)}
              >
                example {i + 1}
              </button>
            </span>
          ))}
        </div>

        <div style={{ marginTop: 18 }}>
          <div className="card-label" style={{ marginBottom: 8 }}>
            Output language
          </div>
          <LanguageToggle value={language} onChange={setLanguage} />
        </div>

        <div style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={run} disabled={loading || !requirement.trim()}>
            {loading ? 'Generating…' : `Generate Gherkin + ${language === 'python' ? 'pytest' : 'Playwright TS'}`}
          </button>
        </div>
        {error && <div className="error-banner" style={{ marginTop: 14 }}>{error}</div>}
      </div>

      <div>
        {!result && !loading && (
          <div className="empty-state">
            <strong style={{ color: 'var(--text-muted)' }}>Nothing generated yet</strong>
            Paste a user story on the left and generate a feature file + spec.
          </div>
        )}
        {result && (
          <div style={{ display: 'grid', gap: 16 }}>
            <CodeBlock filename={`${result.slug}.feature`} code={result.gherkin} />
            <CodeBlock filename={result.filename} code={result.playwright} />
          </div>
        )}
      </div>
    </div>
  );
}
