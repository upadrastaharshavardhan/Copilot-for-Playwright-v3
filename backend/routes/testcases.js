import { Router } from 'express';
import { queryCases, updateCaseStatus, bulkUpdateStatus, allCasesForExport } from '../services/testCaseStore.js';

const router = Router();

router.get('/', (req, res) => {
  const { runId, module, type, priority, status, q, page, pageSize } = req.query;
  if (!runId) return res.status(400).json({ error: 'runId is required' });

  const result = queryCases(runId, {
    module: module || undefined,
    type: type || undefined,
    priority: priority || undefined,
    status: status || undefined,
    q: q || undefined,
    page: parseInt(page, 10) || 1,
    pageSize: Math.min(parseInt(pageSize, 10) || 50, 500),
  });

  if (!result) return res.status(404).json({ error: 'Run not found' });
  res.json(result);
});

router.patch('/:runId/:caseId', (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });
  const updated = updateCaseStatus(req.params.runId, req.params.caseId, status);
  if (!updated) return res.status(404).json({ error: 'Run or case not found' });
  res.json(updated);
});

router.post('/:runId/bulk-status', (req, res) => {
  const { caseIds, status } = req.body;
  if (!Array.isArray(caseIds) || !caseIds.length || !status) {
    return res.status(400).json({ error: 'caseIds (array) and status are required' });
  }
  const count = bulkUpdateStatus(req.params.runId, caseIds, status);
  res.json({ updated: count });
});

router.get('/:runId/export', (req, res) => {
  const { module, type, priority, status, q } = req.query;
  const items = allCasesForExport(req.params.runId, { module, type, priority, status, q });
  if (!items) return res.status(404).json({ error: 'Run not found' });

  const header = ['id', 'module', 'title', 'type', 'priority', 'status', 'expected', 'steps', 'data'];
  const escape = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(',')];
  for (const c of items) {
    lines.push(
      [c.id, c.module, c.title, c.type, c.priority, c.status, c.expected, (c.steps || []).join(' | '), JSON.stringify(c.data || {})]
        .map(escape)
        .join(',')
    );
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="test-cases-${req.params.runId}.csv"`);
  res.send(lines.join('\n'));
});

export default router;
