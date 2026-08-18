import { useState } from 'react';
import { api, AnalyzeResponse } from '../api';

const EXAMPLE_ERROR = `TimeoutError: locator.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator("#submit")
  - locator resolved to hidden <button #submit>`;

export default function AnalyzePanel() {
  const [errorLog, setErrorLog] = useState('');
  const [testCode, setTestCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  const run = async () => {
    if (!errorLog.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.analyzeFailure(errorLog.trim(), testCode.trim());
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
        <div className="card-label">Playwright error / stack trace</div>
        <textarea
          className="field"
          placeholder="Paste the failure output from your test run…"
          value={errorLog}
          onChange={(e) => setErrorLog(e.target.value)}
        />

        <div className="card-label" style={{ marginTop: 18 }}>
          Test code (optional)
        </div>
        <textarea
          className="field"
          style={{ minHeight: 90 }}
          placeholder="Paste the failing test for extra context…"
          value={testCode}
          onChange={(e) => setTestCode(e.target.value)}
        />

        <div className="field-hint">
          <button className="copy-btn" onClick={() => setErrorLog(EXAMPLE_ERROR)}>
            load example
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={run} disabled={loading || !errorLog.trim()}>
            {loading ? 'Diagnosing…' : 'Analyze failure'}
          </button>
        </div>
        {error && <div className="error-banner" style={{ marginTop: 14 }}>{error}</div>}
      </div>

      <div>
        {!result && !loading && (
          <div className="empty-state">
            <strong style={{ color: 'var(--text-muted)' }}>No diagnosis yet</strong>
            Paste an error log to get a root-cause category and fix.
          </div>
        )}
        {result && (
          <div className="card">
            <div className="card-label">Diagnosis</div>
            <div className="rca-grid">
              <div className="rca-row">
                <div className="rca-key">Category</div>
                <div className="rca-value">
                  <span className="tag">{result.category}</span>
                </div>
              </div>
              <div className="rca-row">
                <div className="rca-key">Root cause</div>
                <div className="rca-value">{result.rootCause}</div>
              </div>
              <div className="rca-row">
                <div className="rca-key">Suggested fix</div>
                <div className="rca-value">{result.fix}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
