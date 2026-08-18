import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = path.join(__dirname, '..', 'data', 'testcase-runs');
const INDEX_FILE = path.join(RUNS_DIR, 'index.json');
const MAX_RUNS_KEPT = 25;
const CODE_PREVIEW_FILE_LIMIT = 6; // only keep code text for the first N files per run, to keep JSON small

function ensureDir() {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
}

function readIndex() {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeIndex(list) {
  ensureDir();
  fs.writeFileSync(INDEX_FILE, JSON.stringify(list, null, 2));
}

function casesFile(runId) {
  return path.join(RUNS_DIR, `${runId}-cases.json`);
}
function metaFile(runId) {
  return path.join(RUNS_DIR, `${runId}-meta.json`);
}

export function saveRun({ runId, summary, files, cases, zipPath }) {
  ensureDir();

  const filesForStorage = files.map((f, i) => ({
    path: f.path,
    module: f.module,
    language: f.language,
    templateUsed: f.templateUsed,
    caseCount: f.caseCount,
    code: i < CODE_PREVIEW_FILE_LIMIT ? f.code : null,
  }));

  fs.writeFileSync(casesFile(runId), JSON.stringify(cases));
  fs.writeFileSync(
    metaFile(runId),
    JSON.stringify({ ...summary, files: filesForStorage, zipPath }, null, 2)
  );

  const index = readIndex();
  index.unshift({
    runId,
    createdAt: summary.createdAt,
    sourceLabel: summary.sourceLabel,
    language: summary.language,
    totalCases: summary.totalCases,
    modules: summary.moduleSummary.length,
    generationTimeMs: summary.generationTimeMs,
    warnings: summary.warnings,
  });
  const trimmed = index.slice(0, MAX_RUNS_KEPT);
  // best-effort cleanup of dropped runs' files
  for (const dropped of index.slice(MAX_RUNS_KEPT)) {
    [casesFile(dropped.runId), metaFile(dropped.runId)].forEach((f) => {
      try {
        fs.unlinkSync(f);
      } catch {
        /* noop */
      }
    });
  }
  writeIndex(trimmed);
}

export function listRuns() {
  return readIndex();
}

export function getRunMeta(runId) {
  try {
    return JSON.parse(fs.readFileSync(metaFile(runId), 'utf-8'));
  } catch {
    return null;
  }
}

function loadCases(runId) {
  try {
    return JSON.parse(fs.readFileSync(casesFile(runId), 'utf-8'));
  } catch {
    return null;
  }
}

export function queryCases(runId, { module, type, priority, status, q, page = 1, pageSize = 50 } = {}) {
  const all = loadCases(runId);
  if (!all) return null;

  let filtered = all;
  if (module) filtered = filtered.filter((c) => c.module === module);
  if (type) filtered = filtered.filter((c) => c.type === type);
  if (priority) filtered = filtered.filter((c) => c.priority === priority);
  if (status) filtered = filtered.filter((c) => c.status === status);
  if (q) {
    const needle = q.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.id.toLowerCase().includes(needle) ||
        c.title.toLowerCase().includes(needle) ||
        c.module.toLowerCase().includes(needle)
    );
  }

  const total = filtered.length;
  const start = (Math.max(1, page) - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  const modules = [...new Set(all.map((c) => c.module))].sort();
  const types = [...new Set(all.map((c) => c.type))].sort();
  const priorities = [...new Set(all.map((c) => c.priority))].sort();
  const statuses = [...new Set(all.map((c) => c.status))].sort();

  return { items, total, page, pageSize, filters: { modules, types, priorities, statuses } };
}

export function updateCaseStatus(runId, caseId, status) {
  const all = loadCases(runId);
  if (!all) return null;
  const c = all.find((x) => x.id === caseId);
  if (!c) return null;
  c.status = status;
  fs.writeFileSync(casesFile(runId), JSON.stringify(all));
  return c;
}

export function bulkUpdateStatus(runId, caseIds, status) {
  const all = loadCases(runId);
  if (!all) return 0;
  const idSet = new Set(caseIds);
  let count = 0;
  for (const c of all) {
    if (idSet.has(c.id)) {
      c.status = status;
      count++;
    }
  }
  fs.writeFileSync(casesFile(runId), JSON.stringify(all));
  return count;
}

export function allCasesForExport(runId, filters = {}) {
  const result = queryCases(runId, { ...filters, page: 1, pageSize: Number.MAX_SAFE_INTEGER });
  return result ? result.items : [];
}
