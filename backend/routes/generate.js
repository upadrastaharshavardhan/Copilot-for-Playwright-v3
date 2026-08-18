import { Router } from 'express';
import { generateTests } from '../services/aiService.js';
import { appendHistory } from '../services/historyStore.js';

const router = Router();

router.post('/', async (req, res) => {
  const { requirement, language } = req.body;
  if (!requirement || !requirement.trim()) {
    return res.status(400).json({ error: 'requirement is required' });
  }
  const lang = language === 'typescript' ? 'typescript' : 'python';

  try {
    const result = await generateTests(requirement.trim(), lang);
    appendHistory({
      type: 'generate',
      input: { requirement: requirement.trim(), language: lang },
      output: result,
      timestamp: new Date().toISOString(),
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate tests' });
  }
});

export default router;
