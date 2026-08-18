import { useState } from 'react';
import { api, HealResponse } from '../api';

const EXAMPLE_SELECTOR = '#old-login-btn';
const EXAMPLE_DOM = `<button data-testid="login-submit" aria-label="Log in" class="btn-primary--v3">
  Log in
</button>`;

export default function HealPanel() {
  const [selector, setSelector] = useState('');
  const [dom, setDom] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HealResponse | null>(null);

  const run = async () => {
    if (!selector.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.healLocator(selector.trim(), dom.trim());
      setResult(res);
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const loadExample = () => {
    setSelector(EXAMPLE_SELECTOR);
    setDom(EXAMPLE_DOM);
  };

  return (
    <div className="panel-grid">
      <div className="card">
        <div className="card-label">Broken selector</div>
        <input
          className="field"
          placeholder="#old-login-btn"
          value={selector}
          onChange={(e) => setSelector(e.target.value)}
        />

        <div className="card-label" style={{ marginTop: 18 }}>
          Current DOM snippet
        </div>
        <textarea
          className="field"
          placeholder="Paste the surrounding HTML of the element as it exists today…"
          value={dom}
          onChange={(e) => setDom(e.target.value)}
        />
        <div className="field-hint">
          <button className="copy-btn" onClick={loadExample}>
            load example
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={run} disabled={loading || !selector.trim()}>
            {loading ? 'Analyzing…' : 'Suggest healed locators'}
          </button>
        </div>
        {error && <div className="error-banner" style={{ marginTop: 14 }}>{error}</div>}
      </div>

      <div>
        {!result && !loading && (
          <div className="empty-state">
            <strong style={{ color: 'var(--text-muted)' }}>No suggestions yet</strong>
            Paste a broken selector and the current DOM to get ranked alternatives.
          </div>
        )}
        {result && (
          <div className="card">
            <div className="card-label">
              Ranked alternatives for <code style={{ color: 'var(--coral)' }}>{result.original}</code>
            </div>
            {result.suggestions.map((s, i) => (
              <div className="suggestion" key={i}>
                <code>{s.selector}</code>
                <div className="reason">{s.reason}</div>
                <div className="confidence-track">
                  <div className="confidence-fill" style={{ width: `${Math.round(s.confidence * 100)}%` }} />
                </div>
                <div className="confidence-label">
                  <span>confidence</span>
                  <span>{Math.round(s.confidence * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
