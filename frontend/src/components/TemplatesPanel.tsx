import { useEffect, useState } from 'react';
import { api, Template, TemplateInput, Language, TestCase } from '../api';
import CodeBlock from './CodeBlock';
import LanguageToggle from './LanguageToggle';

const BLANK_FORM: TemplateInput = {
  name: '',
  description: '',
  category: 'custom',
  keywords: [],
  pythonSteps: '',
  typescriptSteps: '',
};

const SAMPLE_CASE: TestCase = {
  id: 'TC-SAMPLE-0001',
  module: 'Sample Module',
  title: 'Sample case',
  steps: ['Step one', 'Step two'],
  data: { username: 'demo_user', password: 'demo_pass', query: 'wireless mouse' },
  expected: 'Expected outcome text',
  precondition: '',
  url: '',
  priority: 'Medium',
  type: 'Positive',
  status: 'Not Run',
  sourceSheet: '',
  sourceRow: 0,
  variantIndex: 1,
  variantTotal: 1,
};

export default function TemplatesPanel() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<TemplateInput>(BLANK_FORM);
  const [error, setError] = useState<string | null>(null);
  const [runLang, setRunLang] = useState<Language>('python');
  const [sampleJson, setSampleJson] = useState(JSON.stringify([SAMPLE_CASE], null, 2));
  const [runResult, setRunResult] = useState<{ code: string; caseCount: number } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const list = await api.listTemplates();
    setTemplates(list);
    setLoading(false);
    if (!selectedId && list.length) setSelectedId(list[0].id);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = templates.find((t) => t.id === selectedId) || null;

  const startCreate = () => {
    setCreating(true);
    setSelectedId(null);
    setForm(BLANK_FORM);
    setRunResult(null);
    setError(null);
  };

  const startEdit = (t: Template) => {
    setCreating(false);
    setSelectedId(t.id);
    setForm({
      name: t.name,
      description: t.description,
      category: t.category,
      keywords: t.keywords,
      pythonSteps: t.pythonSteps,
      typescriptSteps: t.typescriptSteps,
    });
    setRunResult(null);
    setError(null);
  };

  const save = async () => {
    if (!form.name?.trim()) {
      setError('Name is required');
      return;
    }
    setError(null);
    try {
      const payload = {
        ...form,
        keywords: typeof form.keywords === 'string' ? (form.keywords as any).split(',').map((k: string) => k.trim()).filter(Boolean) : form.keywords,
      };
      if (creating) {
        const created = await api.createTemplate(payload);
        await load();
        setSelectedId(created.id);
        setCreating(false);
      } else if (selected) {
        await api.updateTemplate(selected.id, payload);
        await load();
      }
    } catch (e: any) {
      setError(e.message || 'Failed to save template');
    }
  };

  const remove = async (t: Template) => {
    if (!confirm(`Delete template "${t.name}"? This can't be undone.`)) return;
    try {
      await api.deleteTemplate(t.id);
      setSelectedId(null);
      await load();
    } catch (e: any) {
      alert(e.message || 'Failed to delete');
    }
  };

  const runPreview = async () => {
    if (!selected) return;
    setRunning(true);
    setRunError(null);
    setRunResult(null);
    try {
      let cases: TestCase[] | undefined;
      try {
        cases = JSON.parse(sampleJson);
      } catch {
        setRunError('Sample data must be valid JSON (an array of case objects)');
        setRunning(false);
        return;
      }
      const res = await api.runTemplate(selected.id, runLang, cases, selected.category);
      setRunResult(res);
    } catch (e: any) {
      setRunError(e.message || 'Failed to run template');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="tpl-grid">
      <div className="tpl-list card">
        <div className="card-label">
          Templates ({templates.length})
          <button className="copy-btn" onClick={startCreate}>
            + new
          </button>
        </div>
        {loading && <div className="empty-state">Loading…</div>}
        <div className="tpl-items">
          {templates.map((t) => (
            <button
              key={t.id}
              className={`tpl-item ${selectedId === t.id ? 'active' : ''}`}
              onClick={() => startEdit(t)}
            >
              <div className="tpl-item-head">
                <span>{t.name}</span>
                {t.builtin && <span className="tag" style={{ background: 'var(--panel-raised)', color: 'var(--text-dim)', borderColor: 'var(--border)' }}>built-in</span>}
              </div>
              <div className="tpl-item-desc">{t.description || 'No description'}</div>
              <div className="tpl-item-cat">category: {t.category || 'generic'}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="tpl-detail">
        {!creating && !selected && (
          <div className="empty-state">
            <strong style={{ color: 'var(--text-muted)' }}>No template selected</strong>
            Pick one on the left, or create a new one to reuse across a whole test pack.
          </div>
        )}

        {(creating || selected) && (
          <>
            <div className="card">
              <div className="card-label">
                {creating ? 'New template' : selected?.builtin ? 'Built-in template (read-only)' : 'Edit template'}
                {!creating && selected && !selected.builtin && (
                  <button className="copy-btn" onClick={() => remove(selected)}>
                    delete
                  </button>
                )}
              </div>

              <div className="tpl-form-row">
                <div>
                  <div className="field-hint" style={{ marginTop: 0 }}>Name</div>
                  <input
                    className="field"
                    disabled={!creating && !!selected?.builtin}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <div className="field-hint" style={{ marginTop: 0 }}>Category (used to auto-match module names)</div>
                  <input
                    className="field"
                    disabled={!creating && !!selected?.builtin}
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="e.g. login, checkout, api"
                  />
                </div>
              </div>

              <div className="field-hint">Description</div>
              <input
                className="field"
                disabled={!creating && !!selected?.builtin}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />

              <div className="field-hint">Keywords (comma-separated — matched against a module's name)</div>
              <input
                className="field"
                disabled={!creating && !!selected?.builtin}
                value={Array.isArray(form.keywords) ? form.keywords.join(', ') : (form.keywords as any) || ''}
                onChange={(e) => setForm({ ...form, keywords: e.target.value as any })}
                placeholder="login, signin, auth"
              />

              <div className="field-hint">
                Python step code — use <code>{'{{data.fieldName}}'}</code>, <code>{'{{expected}}'}</code> tokens
              </div>
              <textarea
                className="field mono"
                style={{ minHeight: 130 }}
                disabled={!creating && !!selected?.builtin}
                value={form.pythonSteps}
                onChange={(e) => setForm({ ...form, pythonSteps: e.target.value })}
                placeholder={'page.goto(BASE_URL + "/login")\npage.get_by_label("Username").fill(str({{data.username}}))'}
              />

              <div className="field-hint">TypeScript step code</div>
              <textarea
                className="field mono"
                style={{ minHeight: 130 }}
                disabled={!creating && !!selected?.builtin}
                value={form.typescriptSteps}
                onChange={(e) => setForm({ ...form, typescriptSteps: e.target.value })}
                placeholder={"await page.goto(BASE_URL + '/login');\nawait page.getByLabel('Username').fill(String({{data.username}}));"}
              />

              {error && <div className="error-banner" style={{ marginTop: 14 }}>{error}</div>}

              {(creating || (selected && !selected.builtin)) && (
                <div style={{ marginTop: 14 }}>
                  <button className="btn btn-primary" onClick={save}>
                    {creating ? 'Create template' : 'Save changes'}
                  </button>
                </div>
              )}
            </div>

            {selected && (
              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-label">Run this template against sample data</div>
                <LanguageToggle value={runLang} onChange={setRunLang} />
                <div className="field-hint">Sample cases (JSON array — edit freely, or paste rows from a test pack)</div>
                <textarea
                  className="field mono"
                  style={{ minHeight: 160 }}
                  value={sampleJson}
                  onChange={(e) => setSampleJson(e.target.value)}
                />
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-primary" onClick={runPreview} disabled={running}>
                    {running ? 'Running…' : 'Run template'}
                  </button>
                </div>
                {runError && <div className="error-banner" style={{ marginTop: 14 }}>{runError}</div>}
                {runResult && (
                  <div style={{ marginTop: 16 }}>
                    <CodeBlock filename={`preview.${runLang === 'python' ? 'py' : 'ts'}`} code={runResult.code} />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
