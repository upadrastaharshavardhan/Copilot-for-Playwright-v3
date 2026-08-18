import { useEffect, useState } from 'react';
import { api, RunSummary, CaseQueryResult, TestCase } from '../api';

const STATUS_OPTIONS = ['Not Run', 'Passed', 'Failed', 'Blocked'];
const PAGE_SIZE = 25;

export default function TestCasesPanel({ activeRunId }: { activeRunId: string | null }) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [runId, setRunId] = useState<string | null>(activeRunId);
  const [result, setResult] = useState<CaseQueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [module, setModule] = useState('');
  const [type, setType] = useState('');
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.listRuns().then((list) => {
      setRuns(list);
      if (!runId && list.length) setRunId(list[0].runId);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeRunId) setRunId(activeRunId);
  }, [activeRunId]);

  const load = async () => {
    if (!runId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.queryTestCases(runId, { module, type, priority, status, q, page, pageSize: PAGE_SIZE });
      setResult(res);
    } catch (e: any) {
      setError(e.message || 'Failed to load test cases');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, module, type, priority, status, page]);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const updateStatus = async (c: TestCase, next: string) => {
    if (!runId) return;
    await api.updateCaseStatus(runId, c.id, next);
    setResult((prev) => (prev ? { ...prev, items: prev.items.map((x) => (x.id === c.id ? { ...x, status: next } : x)) } : prev));
  };

  const activeRun = runs.find((r) => r.runId === runId);
  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

  return (
    <div>
      <div className="card">
        <div className="card-label">Run</div>
        {runs.length === 0 && (
          <div className="empty-state">
            <strong style={{ color: 'var(--text-muted)' }}>No test pack runs yet</strong>
            Generate a test pack in the Test Pack tab to see cases here.
          </div>
        )}
        {runs.length > 0 && (
          <>
            <select className="field select-field" value={runId || ''} onChange={(e) => { setRunId(e.target.value); setPage(1); }}>
              {runs.map((r) => (
                <option key={r.runId} value={r.runId}>
                  {new Date(r.createdAt).toLocaleString()} — {r.sourceLabel} — {r.totalCases.toLocaleString()} cases ({r.language})
                </option>
              ))}
            </select>
            {activeRun && (
              <div style={{ marginTop: 10 }}>
                <a className="btn btn-ghost" href={api.downloadRunUrl(activeRun.runId)}>
                  ⬇ download zip
                </a>
                <a
                  className="btn btn-ghost"
                  style={{ marginLeft: 8 }}
                  href={api.exportCasesUrl(activeRun.runId, { module, type, priority, status, q })}
                >
                  ⬇ export filtered CSV
                </a>
              </div>
            )}
          </>
        )}
      </div>

      {runId && (
        <div className="card" style={{ marginTop: 16 }}>
          <form onSubmit={search} className="filter-row">
            <input className="field" placeholder="Search id / title…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="field select-field" value={module} onChange={(e) => { setModule(e.target.value); setPage(1); }}>
              <option value="">All modules</option>
              {result?.filters.modules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select className="field select-field" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
              <option value="">All types</option>
              {result?.filters.types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select className="field select-field" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
              <option value="">All priorities</option>
              {result?.filters.priorities.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select className="field select-field" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" type="submit">
              Search
            </button>
          </form>

          {error && <div className="error-banner" style={{ marginTop: 14 }}>{error}</div>}
          {loading && <div className="empty-state">Loading…</div>}

          {!loading && result && (
            <>
              <div className="card-label" style={{ marginTop: 16 }}>
                {result.total.toLocaleString()} matching test cases — page {result.page} of {totalPages}
              </div>
              <div className="case-table">
                <div className="case-row case-row-head">
                  <div>ID</div>
                  <div>Title</div>
                  <div>Module</div>
                  <div>Type</div>
                  <div>Priority</div>
                  <div>Status</div>
                </div>
                {result.items.map((c) => (
                  <div key={c.id}>
                    <div className="case-row" onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}>
                      <div className="mono-cell">{c.id}</div>
                      <div className="case-title-cell">{c.title}</div>
                      <div>{c.module}</div>
                      <div>
                        <span className={`tag tag-${c.type.toLowerCase()}`}>{c.type}</span>
                      </div>
                      <div>{c.priority}</div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <select
                          className="field select-field small"
                          value={c.status}
                          onChange={(e) => updateStatus(c, e.target.value)}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {expandedId === c.id && (
                      <div className="case-detail">
                        <div>
                          <b>Steps:</b> {c.steps.join(' → ') || '—'}
                        </div>
                        <div>
                          <b>Test data:</b> <code>{JSON.stringify(c.data)}</code>
                        </div>
                        <div>
                          <b>Expected:</b> {c.expected || '—'}
                        </div>
                        <div className="module-sub">
                          Source: {c.sourceSheet} row {c.sourceRow} — variant {c.variantIndex}/{c.variantTotal}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="pager">
                <button className="copy-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  ← prev
                </button>
                <span className="module-sub">
                  page {page} / {totalPages}
                </span>
                <button className="copy-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  next →
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
