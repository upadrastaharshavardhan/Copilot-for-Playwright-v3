import { useEffect, useState } from 'react';
import { api, HistoryEntry, StatsResponse } from '../api';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

function summarize(entry: HistoryEntry): string {
  if (entry.type === 'generate') {
    const input = entry.input as any;
    if (typeof input === 'string') return input;
    return input?.requirement || '';
  }
  if (entry.type === 'heal') return (entry.input as any)?.brokenSelector || '';
  if (entry.type === 'analyze') return (entry.input as any)?.errorLog?.split('\n')[0] || '';
  return '';
}

export default function HistoryPanel() {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [h, s] = await Promise.all([api.history(), api.stats()]);
    setItems(h);
    setStats(s);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="stats-row">
        <div className="stat-card">
          <div className="num">{stats?.total ?? '—'}</div>
          <div className="label">Total runs</div>
        </div>
        <div className="stat-card">
          <div className="num">{stats?.byType.generate ?? 0}</div>
          <div className="label">Tests generated</div>
        </div>
        <div className="stat-card">
          <div className="num">{stats?.byType.heal ?? 0}</div>
          <div className="label">Locators healed</div>
        </div>
        <div className="stat-card">
          <div className="num">{stats?.byType.analyze ?? 0}</div>
          <div className="label">Failures diagnosed</div>
        </div>
      </div>

      <div className="card-label">
        Recent activity
        <button className="copy-btn" onClick={load}>
          refresh
        </button>
      </div>

      {loading && <div className="empty-state">Loading…</div>}

      {!loading && items.length === 0 && (
        <div className="empty-state">
          <strong style={{ color: 'var(--text-muted)' }}>No activity yet</strong>
          Generate a test, heal a locator, or diagnose a failure to see it here.
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="history-list">
          {items.map((item) => (
            <div className="history-item" key={item.id}>
              <div className="history-item-head">
                <span className="history-type">{item.type}</span>
                <span className="history-time">{timeAgo(item.timestamp)}</span>
              </div>
              <div className="history-input">{summarize(item)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
