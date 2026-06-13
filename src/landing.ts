interface InitialData {
  ok: boolean;
  appTitle?: string;
  userEmail?: string;
  authenticated?: boolean;
  metadata?: {
    buildBadge?: string;
    appVersion?: string;
  };
  message?: string;
}

interface DiagnosticsData {
  ok: boolean;
  user?: {
    email: string;
    authenticated: boolean;
    allowed: boolean;
  };
  bindings?: {
    db: boolean;
    cardImages: boolean;
    assets: boolean;
    ocrApiUrl: boolean;
  };
  config?: {
    appTitle: string;
    allowedEmailDomains: string[];
    maxSearchResults: number;
  };
  routes?: Array<{ path: string; description: string }>;
  message?: string;
}

window.addEventListener('DOMContentLoaded', () => {
  void loadLanding();
});

async function loadLanding(): Promise<void> {
  try {
    const [initial, diagnostics] = await Promise.all([
      api<InitialData>('/api/initial'),
      api<DiagnosticsData>('/api/diagnostics')
    ]);

    const appTitle = initial.appTitle || diagnostics.config?.appTitle || '名刺管理';
    text('loginTitle').textContent = appTitle;
    document.title = `ログイン | ${appTitle}`;

    const email = initial.userEmail || diagnostics.user?.email || '';
    const authenticated = Boolean(initial.authenticated || diagnostics.user?.authenticated);
    text('loginUser').textContent = email || 'Cloudflare Access未設定または未認証';

    const allowedDomains = diagnostics.config?.allowedEmailDomains || [];
    text('allowedDomains').textContent = allowedDomains.length > 0 ? allowedDomains.join(' / ') : '制限なし';

    const db = diagnostics.bindings?.db ? '設定済み' : '未設定';
    text('dbStatus').textContent = `D1: ${db}`;

    const r2 = diagnostics.bindings?.cardImages ? 'R2設定済み' : 'R2未設定';
    const ocr = diagnostics.bindings?.ocrApiUrl ? 'OCR API設定済み' : 'OCR API未設定';
    text('storageStatus').textContent = `${r2} / ${ocr}`;

    const message = authenticated
      ? `${email} として認証されています。登録・検索画面へ進めます。`
      : 'Cloudflare Access未設定の検証状態です。本番ではAccessでGoogle認証を必須にしてください。';
    showMessage('loginMessage', message, authenticated ? 'success' : 'info');
  } catch (err) {
    showMessage('loginMessage', errorMessage(err, 'ログイン状態の確認に失敗しました。'), 'error');
    text('loginUser').textContent = '確認失敗';
    text('dbStatus').textContent = '確認失敗';
    text('storageStatus').textContent = '確認失敗';
  }
}

async function api<T>(endpoint: string): Promise<T> {
  const response = await fetch(endpoint, {
    headers: { 'Accept': 'application/json' }
  });
  const text = await response.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_err) {
    throw new Error('API応答がJSONではありません。');
  }
  if (!response.ok) {
    const message = typeof data === 'object' && data && 'message' in data
      ? String((data as { message?: unknown }).message || '')
      : '';
    throw new Error(message || `HTTP ${response.status}`);
  }
  return data as T;
}

function text(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`要素が見つかりません: ${id}`);
  return el;
}

function showMessage(id: string, message: string, type: 'success' | 'error' | 'info'): void {
  const el = text(id);
  el.textContent = message;
  el.className = `message ${type} show`;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export {};
