import { Router } from 'express';
import { analyzeFailure } from '../services/aiService.js';
import { appendHistory } from '../services/historyStore.js';

const router = Router();

router.post('/', async (req, res) => {
  const { errorLog, testCode } = req.body;
  if (!errorLog || !errorLog.trim()) {
    return res.status(400).json({ error: 'errorLog is required' });
  }

  try {
    const result = await analyzeFailure(errorLog.trim(), testCode || '');
    appendHistory({
      type: 'analyze',
      input: { errorLog, testCode },
      output: result,
      timestamp: new Date().toISOString(),
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to analyze failure' });
  }
});

export default router;
