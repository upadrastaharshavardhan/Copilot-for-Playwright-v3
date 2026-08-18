export type Language = 'python' | 'typescript';

export type HealthResponse = {
  status: string;
  aiMode: 'live' | 'template';
  message: string;
};

export type GenerateResponse = {
  feature: string;
  slug: string;
  gherkin: string;
  playwright: string;
  language: Language;
  filename: string;
  mode: 'live' | 'template';
};

export type HealSuggestion = {
  selector: string;
  confidence: number;
  reason: string;
};

export type HealResponse = {
  original: string;
  suggestions: HealSuggestion[];
  mode: 'live' | 'template';
};

export type AnalyzeResponse = {
  category: string;
  rootCause: string;
  fix: string;
  mode: 'live' | 'template';
};

export type HistoryEntry = {
  id: string;
  type: 'generate' | 'heal' | 'analyze';
  input: unknown;
  output: unknown;
  timestamp: string;
};

export type StatsResponse = {
  total: number;
  byType: Record<string, number>;
  lastRunAt: string | null;
};

/* ----------------------------- Templates ----------------------------- */

export type Template = {
  id: string;
  name: string;
  description: string;
  category: string;
  keywords: string[];
  builtin: boolean;
  pythonSteps: string;
  typescriptSteps: string;
  createdAt?: string;
  updatedAt?: string;
};

export type TemplateInput = {
  name: string;
  description?: string;
  category?: string;
  keywords?: string[];
  pythonSteps?: string;
  typescriptSteps?: string;
};

export type TemplateRunResponse = {
  code: string;
  language: Language;
  caseCount: number;
};

/* ----------------------------- Test Pack ------------------------------ */

export type SheetColumnSummary = {
  name: string;
  rowCount: number;
  detected: {
    meta: Record<string, string>;
    groupedDataFields: { field: string; key: string; variants: number }[];
    standaloneDataFields: { field: string; key: string }[];
  };
  availableDataKeys: { label: string; key: string }[];
};

export type ModuleSummary = {
  module: string;
  totalCases: number;
  files?: number;
  templateId?: string;
  templateUsed: string;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  expectedFields: string[];
  availableKeys: string[];
  unresolvedFields: string[];
};

export type TestCase = {
  id: string;
  module: string;
  title: string;
  steps: string[];
  data: Record<string, unknown>;
  expected: string;
  precondition: string;
  url: string;
  priority: string;
  type: string;
  status: string;
  sourceSheet: string;
  sourceRow: number;
  variantIndex: number;
  variantTotal: number;
};

export type UploadResponse = {
  uploadId: string;
  filename: string;
  sheets: SheetColumnSummary[];
  sampleCases: TestCase[];
  estimatedTotalCases: number;
  exactTotalCases: number;
  moduleSummary: ModuleSummary[];
  templates: Template[];
  warnings: string[];
  limits: { maxCasesTotal: number; maxVariantsPerRow: number };
};

export type GeneratedFilePreview = {
  path: string;
  module: string;
  caseCount: number;
  templateUsed: string;
  code: string;
  kind?: 'spec' | 'feature';
};

export type GenerateRunResponse = {
  runId: string;
  totalCases: number;
  generationTimeMs: number;
  moduleSummary: ModuleSummary[];
  warnings: string[];
  fileCount: number;
  files: GeneratedFilePreview[];
  downloadUrl: string;
};

export type RunSummary = {
  runId: string;
  createdAt: string;
  sourceLabel: string;
  language: Language;
  totalCases: number;
  modules: number;
  generationTimeMs: number;
  warnings: string[];
};

export type CaseQueryResult = {
  items: TestCase[];
  total: number;
  page: number;
  pageSize: number;
  filters: { modules: string[]; types: string[]; priorities: string[]; statuses: string[] };
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: options?.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  health: () => request<HealthResponse>('/health'),
  generateTests: (requirement: string, language: Language) =>
    request<GenerateResponse>('/generate-tests', {
      method: 'POST',
      body: JSON.stringify({ requirement, language }),
    }),
  healLocator: (brokenSelector: string, domSnippet: string) =>
    request<HealResponse>('/heal-locator', {
      method: 'POST',
      body: JSON.stringify({ brokenSelector, domSnippet }),
    }),
  analyzeFailure: (errorLog: string, testCode: string) =>
    request<AnalyzeResponse>('/analyze-failure', {
      method: 'POST',
      body: JSON.stringify({ errorLog, testCode }),
    }),
  history: () => request<HistoryEntry[]>('/history'),
  stats: () => request<StatsResponse>('/stats'),

  // Templates
  listTemplates: () => request<Template[]>('/templates'),
  createTemplate: (input: TemplateInput) =>
    request<Template>('/templates', { method: 'POST', body: JSON.stringify(input) }),
  updateTemplate: (id: string, input: TemplateInput) =>
    request<Template>(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteTemplate: (id: string) => request<{ deleted: boolean }>(`/templates/${id}`, { method: 'DELETE' }),
  runTemplate: (id: string, language: Language, sampleCases?: TestCase[], moduleName?: string) =>
    request<TemplateRunResponse>(`/templates/${id}/run`, {
      method: 'POST',
      body: JSON.stringify({ language, sampleCases, moduleName }),
    }),

  // Test Pack
  uploadTestPack: (file: File, language: Language) => {
    const form = new FormData();
    form.append('file', file);
    form.append('language', language);
    return request<UploadResponse>('/testpack/upload', { method: 'POST', body: form });
  },
  generateTestPack: (params: {
    uploadId: string;
    language: Language;
    moduleTemplateMap?: Record<string, string>;
    moduleFieldMap?: Record<string, Record<string, string>>;
    rowsPerFile?: number;
    maxCasesTotal?: number;
    maxVariantsPerRow?: number;
  }) =>
    request<GenerateRunResponse>('/testpack/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  listRuns: () => request<RunSummary[]>('/testpack/runs'),
  getRun: (runId: string) => request<any>(`/testpack/runs/${runId}`),
  downloadRunUrl: (runId: string) => `/api/testpack/runs/${runId}/download`,

  // Test Cases
  queryTestCases: (
    runId: string,
    params: { module?: string; type?: string; priority?: string; status?: string; q?: string; page?: number; pageSize?: number }
  ) => {
    const qs = new URLSearchParams({ runId, ...toStringParams(params) });
    return request<CaseQueryResult>(`/testcases?${qs.toString()}`);
  },
  updateCaseStatus: (runId: string, caseId: string, status: string) =>
    request<TestCase>(`/testcases/${runId}/${encodeURIComponent(caseId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  bulkUpdateStatus: (runId: string, caseIds: string[], status: string) =>
    request<{ updated: number }>(`/testcases/${runId}/bulk-status`, {
      method: 'POST',
      body: JSON.stringify({ caseIds, status }),
    }),
  exportCasesUrl: (
    runId: string,
    params: { module?: string; type?: string; priority?: string; status?: string; q?: string }
  ) => `/api/testcases/${runId}/export?${new URLSearchParams(toStringParams(params)).toString()}`,
};

function toStringParams(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== '') out[k] = String(v);
  }
  return out;
}
