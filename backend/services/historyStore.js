import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'data', 'history.json');
const MAX_ENTRIES = 100;

function readAll() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

export function appendHistory(entry) {
  const all = readAll();
  all.unshift({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 8), ...entry });
  const trimmed = all.slice(0, MAX_ENTRIES);
  fs.writeFileSync(DATA_FILE, JSON.stringify(trimmed, null, 2));
  return trimmed[0];
}

export function getHistory() {
  return readAll();
}

export function getStats() {
  const all = readAll();
  const byType = all.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {});
  return {
    total: all.length,
    byType,
    lastRunAt: all[0]?.timestamp || null,
  };
}
