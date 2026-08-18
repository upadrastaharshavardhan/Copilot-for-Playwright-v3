import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import generateRouter from './routes/generate.js';
import healRouter from './routes/heal.js';
import analyzeRouter from './routes/analyze.js';
import templatesRouter from './routes/templates.js';
import testpackRouter from './routes/testpack.js';
import testcasesRouter from './routes/testcases.js';
import { getHistory, getStats } from './services/historyStore.js';
import { aiMode } from './services/aiService.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', aiMode, message: `Running in ${aiMode === 'live' ? 'Live AI (Claude)' : 'Smart Template'} mode` });
});

app.get('/api/history', (req, res) => {
  res.json(getHistory());
});

app.get('/api/stats', (req, res) => {
  res.json(getStats());
});

app.use('/api/generate-tests', generateRouter);
app.use('/api/heal-locator', healRouter);
app.use('/api/analyze-failure', analyzeRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/testpack', testpackRouter);
app.use('/api/testcases', testcasesRouter);

app.listen(PORT, () => {
  console.log(`\n  AI Co-Pilot for Playwright QA — backend running`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  AI mode: ${aiMode === 'live' ? 'LIVE (Anthropic API key detected)' : 'SMART TEMPLATE (no API key set - fully functional offline demo)'}\n`);
});
