import { Router } from 'express';
import { listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate } from '../services/templateStore.js';
import { renderBulkModuleFile, slugify } from '../services/codeGen.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(listTemplates());
});

router.get('/:id', (req, res) => {
  const t = getTemplate(req.params.id);
  if (!t) return res.status(404).json({ error: 'Template not found' });
  res.json(t);
});

router.post('/', (req, res) => {
  const { name, description, category, keywords, pythonSteps, typescriptSteps } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  const template = createTemplate({ name, description, category, keywords, pythonSteps, typescriptSteps });
  res.status(201).json(template);
});

router.put('/:id', (req, res) => {
  try {
    const updated = updateTemplate(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Template not found' });
    res.json(updated);
  } catch (err) {
    if (err.message === 'BUILTIN_READONLY') {
      return res.status(400).json({ error: 'Built-in templates cannot be edited. Create a new template instead.' });
    }
    res.status(500).json({ error: 'Failed to update template' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const ok = deleteTemplate(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Template not found' });
    res.json({ deleted: true });
  } catch (err) {
    if (err.message === 'BUILTIN_READONLY') {
      return res.status(400).json({ error: 'Built-in templates cannot be deleted.' });
    }
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Renders a preview of the template applied to a small sample data set,
// so a user can sanity-check step code before running it across a full
// test pack of thousands of rows.
router.post('/:id/run', (req, res) => {
  const { language, sampleCases, moduleName } = req.body;
  const lang = language === 'typescript' ? 'typescript' : 'python';
  const template = getTemplate(req.params.id);
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const cases =
    Array.isArray(sampleCases) && sampleCases.length
      ? sampleCases
      : [
          {
            id: 'TC-SAMPLE-0001',
            title: 'Sample case',
            steps: ['Step one', 'Step two'],
            data: { username: 'demo_user', password: 'demo_pass', query: 'demo search' },
            expected: 'Expected outcome text',
            precondition: '',
            url: '',
          },
        ];

  const mod = moduleName || template.category || 'Sample Module';
  const code = renderBulkModuleFile({
    language: lang,
    moduleName: mod,
    moduleSlug: slugify(mod),
    cases,
    template: template.id === 'builtin-generic' ? null : template,
    sourceLabel: 'Template preview (sample data)',
    partIndex: 1,
    partTotal: 1,
  });

  res.json({ code, language: lang, caseCount: cases.length });
});

export default router;
