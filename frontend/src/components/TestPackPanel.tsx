import { useRef, useState } from 'react';
import { api, UploadResponse, Language, Template, GenerateRunResponse } from '../api';
import LanguageToggle from './LanguageToggle';
import CodeBlock from './CodeBlock';

export default function TestPackPanel({ onGenerated }: { onGenerated: (runId: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [language, setLanguage] = useState<Language>('python');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadResponse | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);

  const [templateOverride, setTemplateOverride] = useState<Record<string, string>>({});
  const [fieldMap, setFieldMap] = useState<Record<string, Record<string, string>>>({});

  const [rowsPerFile, setRowsPerFile] = useState(300);
  const [maxCasesTotal, setMaxCasesTotal] = useState(12000);
  const [maxVariantsPerRow, setMaxVariantsPerRow] = useState(200);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<GenerateRunResponse | null>(null);

  const reset = () => {
    setUpload(null);
    setGenResult(null);
    setTemplateOverride({});
    setFieldMap({});
    setUploadError(null);
    setGenError(null);
  };

  const handleFile = async (file: File) => {
    reset();
    setUploading(true);
    try {
      const res = await api.uploadTestPack(file, language);
      setUpload(res);
      setTemplates(res.templates);
      setMaxCasesTotal(res.limits.maxCasesTotal);
      setMaxVariantsPerRow(res.limits.maxVariantsPerRow);
    } catch (e: any) {
      setUploadError(e.message || 'Failed to parse test pack');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const generate = async () => {
    if (!upload) return;
    setGenerating(true);
    setGenError(null);
    setGenResult(null);
    try {
      const res = await api.generateTestPack({
        uploadId: upload.uploadId,
        language,
        moduleTemplateMap: templateOverride,
        moduleFieldMap: fieldMap,
        rowsPerFile,
        maxCasesTotal,
        maxVariantsPerRow,
      });
      setGenResult(res);
    } catch (e: any) {
      setGenError(e.message || 'Failed to generate test cases');
    } finally {
      setGenerating(false);
    }
  };

  const setModuleField = (module: string, templateField: string, sourceKey: string) => {
    setFieldMap((prev) => ({
      ...prev,
      [module]: { ...(prev[module] || {}), [templateField]: sourceKey },
    }));
  };

  return (
    <div>
      <div className="card">
        <div className="card-label">Upload a test pack (.xlsx, .xls, or .csv)</div>
        <div className="field-hint">
          Any layout works — the engine fuzzy-matches columns like Module / Steps / Expected Result / Priority,
          and treats extra columns as test data. Columns like <code>Username_1</code>/<code>Username_2</code>, or
          cells with pipe-separated values (<code>a|b|c</code>), get expanded into separate data-driven test cases.
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="card-label" style={{ marginBottom: 8 }}>
            Output language
          </div>
          <LanguageToggle value={language} onChange={setLanguage} />
        </div>

        <div
          className="dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{ marginTop: 16 }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {uploading ? 'Parsing…' : upload ? `${upload.filename} — click or drop to replace` : 'Click or drop a test pack file here'}
        </div>

        {uploadError && <div className="error-banner" style={{ marginTop: 14 }}>{uploadError}</div>}
      </div>

      {upload && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-label">
            Parsed result — {upload.exactTotalCases.toLocaleString()} test cases detected across {upload.sheets.length} sheet
            {upload.sheets.length !== 1 ? 's' : ''}
          </div>

          {upload.warnings.length > 0 && (
            <div className="error-banner" style={{ background: 'var(--gold-glow)', borderColor: 'rgba(232,163,61,0.35)', color: 'var(--gold)' }}>
              {upload.warnings.join(' ')}
            </div>
          )}

          <div className="module-table">
            <div className="module-row module-row-head">
              <div>Module</div>
              <div>Cases</div>
              <div>Template</div>
              <div>Field mapping</div>
            </div>
            {upload.moduleSummary.map((m) => (
              <div className="module-row" key={m.module}>
                <div>
                  <div className="module-name">{m.module}</div>
                  <div className="module-sub">
                    {Object.entries(m.byType).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </div>
                </div>
                <div className="module-count">{m.totalCases.toLocaleString()}</div>
                <div>
                  <select
                    className="field select-field"
                    value={templateOverride[m.module] || ''}
                    onChange={(e) => setTemplateOverride((prev) => ({ ...prev, [m.module]: e.target.value }))}
                  >
                    <option value="">Auto ({m.templateUsed})</option>
                    {templates
                      .filter((t) => t.id !== 'builtin-generic')
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  {m.expectedFields.length === 0 && <span className="module-sub">No data fields required</span>}
                  {m.expectedFields.map((f) => {
                    const resolved = m.availableKeys.includes(f) && !fieldMap[m.module]?.[f];
                    return (
                      <div key={f} className="field-map-row">
                        <span className={resolved ? 'field-map-ok' : 'field-map-warn'}>{f}</span>
                        <span className="module-sub">←</span>
                        <select
                          className="field select-field small"
                          value={fieldMap[m.module]?.[f] || (resolved ? f : '')}
                          onChange={(e) => setModuleField(m.module, f, e.target.value)}
                        >
                          <option value="">— none —</option>
                          {m.availableKeys.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <button className="copy-btn" onClick={() => setShowAdvanced((v) => !v)} style={{ marginTop: 14 }}>
            {showAdvanced ? 'hide' : 'show'} advanced options
          </button>

          {showAdvanced && (
            <div className="tpl-form-row" style={{ marginTop: 12 }}>
              <div>
                <div className="field-hint" style={{ marginTop: 0 }}>Rows per generated file</div>
                <input
                  type="number"
                  className="field"
                  value={rowsPerFile}
                  onChange={(e) => setRowsPerFile(parseInt(e.target.value, 10) || 300)}
                />
              </div>
              <div>
                <div className="field-hint" style={{ marginTop: 0 }}>Max total test cases</div>
                <input
                  type="number"
                  className="field"
                  value={maxCasesTotal}
                  onChange={(e) => setMaxCasesTotal(parseInt(e.target.value, 10) || 12000)}
                />
              </div>
              <div>
                <div className="field-hint" style={{ marginTop: 0 }}>Max variants per source row</div>
                <input
                  type="number"
                  className="field"
                  value={maxVariantsPerRow}
                  onChange={(e) => setMaxVariantsPerRow(parseInt(e.target.value, 10) || 200)}
                />
              </div>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={generate} disabled={generating}>
              {generating ? 'Generating…' : `Generate ${upload.exactTotalCases.toLocaleString()} test cases`}
            </button>
          </div>
          {genError && <div className="error-banner" style={{ marginTop: 14 }}>{genError}</div>}
        </div>
      )}

      {genResult && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-label">
            Done — {genResult.totalCases.toLocaleString()} test cases in {genResult.generationTimeMs}ms, {genResult.fileCount} files
          </div>

          <div className="stats-row">
            <div className="stat-card">
              <div className="num">{genResult.totalCases.toLocaleString()}</div>
              <div className="label">Test cases</div>
            </div>
            <div className="stat-card">
              <div className="num">{genResult.fileCount}</div>
              <div className="label">Generated files</div>
            </div>
            <div className="stat-card">
              <div className="num">{genResult.generationTimeMs}ms</div>
              <div className="label">Generation time</div>
            </div>
            <div className="stat-card">
              <div className="num">{genResult.moduleSummary.length}</div>
              <div className="label">Modules</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
            <a className="btn btn-primary" href={api.downloadRunUrl(genResult.runId)}>
              ⬇ Download deployable ZIP
            </a>
            <button className="btn btn-ghost" onClick={() => onGenerated(genResult.runId)}>
              Manage these test cases →
            </button>
          </div>

          <div className="card-label">File previews (first {genResult.files.length} of {genResult.fileCount})</div>
          <div style={{ display: 'grid', gap: 14 }}>
            {genResult.files.map((f) => (
              <CodeBlock key={f.path} filename={`${f.path} — ${f.caseCount} cases (${f.templateUsed})`} code={f.code} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
