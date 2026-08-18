import { Router } from 'express';
import { healLocator } from '../services/aiService.js';
import { appendHistory } from '../services/historyStore.js';

const router = Router();

router.post('/', async (req, res) => {
  const { brokenSelector, domSnippet } = req.body;
  if (!brokenSelector || !brokenSelector.trim()) {
    return res.status(400).json({ error: 'brokenSelector is required' });
  }

  try {
    const result = await healLocator(brokenSelector.trim(), domSnippet || '');
    appendHistory({
      type: 'heal',
      input: { brokenSelector, domSnippet },
      output: result,
      timestamp: new Date().toISOString(),
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to heal locator' });
  }
});

export default router;
