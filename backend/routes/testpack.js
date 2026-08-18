import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { parseWorkbook, summarizeColumns, buildTestCaseBank, DEFAULT_LIMITS } from '../services/excelParser.js';
import { generateSuiteFiles, analyzeModules } from '../services/testCaseEngine.js';
import { listTemplates } from '../services/templateStore.js';
import { buildZip } from '../services/zipService.js';
import { saveRun, listRuns, getRunMeta } from '../services/testCaseStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP_DIR = path.join(__dirname, '..', 'tmp');
fs.mkdirSync(TMP_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(xlsx|xls|csv)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only .xlsx, .xls, or .csv test packs are supported'), ok);
  },
});

const router = Router();

function uploadFilePath(uploadId) {
  return path.join(TMP_DIR, `upload-${uploadId}.json`);
}

// -------------------------------------------------------------------------
// 1) Upload + parse: fuzzy column detection + a small preview, without
//    committing to a full expansion yet (so the UI can offer template
//    choices per module and let the user tune expansion limits first).
// -------------------------------------------------------------------------
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name must be "file")' });

  try {
    const sheets = await parseWorkbook(req.file.buffer, req.file.originalname);
    if (!sheets.length) {
      return res.status(400).json({ error: 'No readable sheets/header rows found in that file' });
    }

    const uploadId = crypto.randomBytes(8).toString('hex');
    fs.writeFileSync(
      uploadFilePath(uploadId),
      JSON.stringify({ filename: req.file.originalname, sheets, uploadedAt: new Date().toISOString() })
    );

    // Quick preview build (capped small) so the UI can show sample cases
    // and an estimated total without doing the full expansion twice.
    const preview = buildTestCaseBank(sheets, { maxCasesTotal: 25, maxVariantsPerRow: DEFAULT_LIMITS.maxVariantsPerRow });
    const fullEstimate = estimateTotalCases(sheets);

    // Full-scale (but capped) build purely to resolve, per module, which
    // template will match and whether it has everything it needs — shown
    // in the UI *before* the user commits to a full generate run.
    const analysisBank = buildTestCaseBank(sheets, DEFAULT_LIMITS);
    const req_language = req.body.language === 'typescript' ? 'typescript' : 'python';
    const moduleSummary = analyzeModules(analysisBank.cases, req_language);

    res.json({
      uploadId,
      filename: req.file.originalname,
      sheets: sheets.map(summarizeColumns),
      sampleCases: preview.cases.slice(0, 10),
      estimatedTotalCases: fullEstimate,
      exactTotalCases: analysisBank.cases.length,
      moduleSummary,
      templates: listTemplates(),
      warnings: analysisBank.warnings,
      limits: DEFAULT_LIMITS,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to parse test pack' });
  }
});

function estimateTotalCases(sheets) {
  // Cheap upper-bound estimate without fully materializing cases:
  // rows * max observed variant width per sheet (via a light re-scan).
  let total = 0;
  for (const sheet of sheets) total += sheet.rows.length;
  return total; // exact expansion count is reported after generate; this is a floor estimate
}

// -------------------------------------------------------------------------
// 2) Generate: full expansion + template resolution + multi-file, chunked
//    code generation + zip packaging + persisted, paginatable case bank.
// -------------------------------------------------------------------------
router.post('/generate', async (req, res) => {
  const {
    uploadId,
    language,
    moduleTemplateMap = {},
    moduleFieldMap = {},
    rowsPerFile,
    maxCasesTotal,
    maxVariantsPerRow,
    includeFeatureFiles,
  } = req.body;

  if (!uploadId) return res.status(400).json({ error: 'uploadId is required (upload a file first)' });

  const stored = (() => {
    try {
      return JSON.parse(fs.readFileSync(uploadFilePath(uploadId), 'utf-8'));
    } catch {
      return null;
    }
  })();
  if (!stored) return res.status(404).json({ error: 'Upload not found or expired — please re-upload the test pack' });

  const lang = language === 'typescript' ? 'typescript' : 'python';
  const start = Date.now();

  try {
    const { cases, warnings, sheetSummaries } = buildTestCaseBank(stored.sheets, {
      maxCasesTotal: clampInt(maxCasesTotal, 1, 20000, DEFAULT_LIMITS.maxCasesTotal),
      maxVariantsPerRow: clampInt(maxVariantsPerRow, 1, 1000, DEFAULT_LIMITS.maxVariantsPerRow),
    });

    if (!cases.length) {
      return res.status(400).json({ error: 'No test cases could be built from that test pack — check the sheet has data rows.' });
    }

    const { files, moduleSummary } = generateSuiteFiles({
      cases,
      language: lang,
      moduleTemplateMap,
      moduleFieldMap,
      rowsPerFile: clampInt(rowsPerFile, 10, 2000, 300),
      sourceLabel: stored.filename,
      includeFeatureFiles: includeFeatureFiles !== false,
    });

    const runId = crypto.randomBytes(8).toString('hex');
    const generationTimeMs = Date.now() - start;
    const summary = {
      runId,
      createdAt: new Date().toISOString(),
      sourceLabel: stored.filename,
      language: lang,
      totalCases: cases.length,
      sheetSummaries,
      moduleSummary,
      warnings,
      generationTimeMs,
      fileCount: files.length,
    };

    const zipPath = path.join(TMP_DIR, `run-${runId}.zip`);
    await buildZip({ outPath: zipPath, language: lang, files, cases, summary });

    saveRun({ runId, summary, files, cases, zipPath });

    // Upload temp file no longer needed
    try {
      fs.unlinkSync(uploadFilePath(uploadId));
    } catch {
      /* noop */
    }

    res.json({
      runId,
      totalCases: cases.length,
      generationTimeMs,
      moduleSummary,
      warnings,
      fileCount: files.length,
      files: files.slice(0, 6).map((f) => ({ path: f.path, module: f.module, caseCount: f.caseCount, templateUsed: f.templateUsed, code: f.code, kind: f.kind })),
      downloadUrl: `/api/testpack/runs/${runId}/download`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to generate test cases' });
  }
});

function clampInt(val, min, max, fallback) {
  const n = parseInt(val, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

router.get('/runs', (req, res) => {
  res.json(listRuns());
});

router.get('/runs/:runId', (req, res) => {
  const meta = getRunMeta(req.params.runId);
  if (!meta) return res.status(404).json({ error: 'Run not found' });
  res.json(meta);
});

router.get('/runs/:runId/download', (req, res) => {
  const meta = getRunMeta(req.params.runId);
  if (!meta || !meta.zipPath || !fs.existsSync(meta.zipPath)) {
    return res.status(404).json({ error: 'Zip not found for this run' });
  }
  res.download(meta.zipPath, `playwright-tests-${req.params.runId}.zip`);
});

export default router;
