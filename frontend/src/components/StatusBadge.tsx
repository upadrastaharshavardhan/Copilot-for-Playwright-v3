import { HealthResponse } from '../api';

export default function StatusBadge({ health }: { health: HealthResponse | null }) {
  if (!health) {
    return (
      <div className="status-badge">
        <span className="status-dot offline" />
        backend offline — start the API server
      </div>
    );
  }

  return (
    <div className="status-badge">
      <span className={`status-dot ${health.aiMode}`} />
      {health.aiMode === 'live' ? 'LIVE · Claude API' : 'SMART TEMPLATE · offline mode'}
    </div>
  );
}
