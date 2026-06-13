interface CardImage {
  base64: string;
  mimeType: string;
  originalName: string;
}

interface CardPayload {
  [key: string]: unknown;
  id?: string;
  expectedUpdatedAt?: string;
  expectedRevision?: string;
  registeredBy?: string;
  updatedBy?: string;
  image?: CardImage | null;
  originalImage?: CardImage | null;
  croppedImage?: CardImage | null;
  imageQuality?: {
    score: number;
    brightnessStatus: string;
    blurStatus: string;
    framingStatus: string;
    tiltStatus: string;
    contourStatus: string;
    retakeDecision: string;
    cropPointsJson: string;
  };
  ocrText?: string;
  ocrStatus?: string;
  ocrLanguage?: string;
  ocrAt?: string;
}

interface CardRecord {
  id: string;
  registeredAt?: string;
  updatedAt: string;
  revision: string;
  company: string;
  name: string;
  kana: string;
  department: string;
  position: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  owner: string;
  exchangeDate: string;
  tags: string;
  group: string;
  memo: string;
  imageUrl: string;
  ocrText: string;
}

interface InitialData {
  ok: boolean;
  appTitle?: string;
  userEmail?: string;
  authenticated?: boolean;
  today?: string;
  metadata?: {
    buildBadge?: string;
  };
  message?: string;
}

interface SearchResponse {
  ok: boolean;
  records?: CardRecord[];
  message?: string;
}

interface ApiResult {
  ok?: boolean;
  message?: string;
  text?: string;
  ocrStatus?: string;
  [key: string]: unknown;
}

interface AppState {
  image: CardImage | null;
  editingRecord: CardRecord | null;
  userEmail: string;
}

const state: AppState = {
  image: null,
  editingRecord: null,
  userEmail: ''
};

const textFieldIds = [
  'company', 'name', 'kana', 'department', 'position', 'phone', 'email', 'website',
  'address', 'owner', 'exchangeDate', 'tags', 'group', 'memo'
] as const;

type TextFieldId = typeof textFieldIds[number];

window.addEventListener('DOMContentLoaded', async () => {
  bindTabs();
  bindImage();
  bindForm();
  bindSearch();
  bindOcr();
  await loadInitialData();
});

async function loadInitialData(): Promise<void> {
  try {
    const data = await api<InitialData>('/api/initial');
    textEl('appTitle').textContent = data.appTitle || '名刺共有台帳';
    document.title = data.appTitle || '名刺共有台帳';
    state.userEmail = data.userEmail || '';
    textEl('userInfo').textContent = state.userEmail
      ? `ログイン: ${state.userEmail}`
      : 'Cloudflare Access未設定またはローカル検証中';
    textEl('buildBadge').textContent = data.metadata?.buildBadge || 'Cloudflare版';
    const date = inputEl('exchangeDate');
    if (!date.value) date.value = data.today || '';
    if (!data.authenticated) {
      showMessage('globalMessage', '本番では Cloudflare Access を設定して nextbrain.pro / nextbrain.biz のGoogleアカウントに限定してください。', 'info');
    }
  } catch (err) {
    showMessage('globalMessage', errorMessage(err, '初期データの取得に失敗しました。'), 'error');
  }
}

function bindTabs(): void {
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((el) => el.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((el) => el.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById(`${tab.dataset.tab}Panel`);
      target?.classList.add('active');
      if (tab.dataset.tab === 'search') void searchCards();
    });
  });
}

function bindImage(): void {
  inputEl('imageFile').addEventListener('change', async (event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showMessage('saveMessage', '画像形式は JPEG / PNG / WebP のいずれかにしてください。', 'error');
      target.value = '';
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    state.image = { base64: dataUrl, mimeType: file.type, originalName: file.name };
    const preview = imageEl('imagePreview');
    preview.src = dataUrl;
    preview.style.display = 'block';
    buttonEl('ocrButton').disabled = false;
  });
}

function bindForm(): void {
  const form = document.getElementById('cardForm') as HTMLFormElement | null;
  if (!form) throw new Error('cardForm が見つかりません。');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = buttonEl('saveButton');
    button.disabled = true;
    try {
      const payload = buildPayload();
      const endpoint = state.editingRecord ? `/api/cards/${encodeURIComponent(state.editingRecord.id)}` : '/api/cards';
      const method = state.editingRecord ? 'PUT' : 'POST';
      const result = await api<ApiResult>(endpoint, { method, body: JSON.stringify(payload) });
      showMessage('saveMessage', result.message || '保存しました。', 'success');
      resetForm();
      await searchCards();
    } catch (err) {
      showMessage('saveMessage', errorMessage(err, '保存に失敗しました。'), 'error');
    } finally {
      button.disabled = false;
    }
  });
}

function bindSearch(): void {
  buttonEl('searchButton').addEventListener('click', () => void searchCards());
}

function bindOcr(): void {
  buttonEl('ocrButton').addEventListener('click', async () => {
    if (!state.image) return;
    const button = buttonEl('ocrButton');
    button.disabled = true;
    textEl('ocrStatus').textContent = 'OCR実行中...';
    try {
      const result = await api<ApiResult>('/api/ocr', {
        method: 'POST',
        body: JSON.stringify({ image: state.image, ocrLanguage: 'ja' })
      });
      textareaEl('ocrText').value = String(result.text || '');
      textEl('ocrStatus').textContent = result.message || result.ocrStatus || 'OCR完了';
      buttonEl('clearOcrButton').disabled = false;
    } catch (err) {
      textEl('ocrStatus').textContent = errorMessage(err, 'OCRに失敗しました。');
    } finally {
      button.disabled = false;
    }
  });

  buttonEl('clearOcrButton').addEventListener('click', () => {
    textareaEl('ocrText').value = '';
    textEl('ocrStatus').textContent = 'OCR未実行';
    buttonEl('clearOcrButton').disabled = true;
  });
}

function buildPayload(): CardPayload {
  const payload: CardPayload = {};
  textFieldIds.forEach((id: TextFieldId) => {
    payload[id] = inputEl(id).value.trim();
  });
  payload.registeredBy = state.userEmail;
  payload.updatedBy = state.userEmail;
  payload.image = state.image;
  payload.originalImage = state.image;
  payload.croppedImage = null;
  payload.imageQuality = {
    score: state.image ? 50 : 0,
    brightnessStatus: state.image ? '未判定' : '',
    blurStatus: state.image ? '未判定' : '',
    framingStatus: state.image ? '未判定' : '',
    tiltStatus: state.image ? '未判定' : '',
    contourStatus: state.image ? '初期版' : '',
    retakeDecision: '判定待ち',
    cropPointsJson: ''
  };
  payload.ocrText = textareaEl('ocrText').value.trim();
  payload.ocrStatus = payload.ocrText ? 'OK' : '';
  payload.ocrLanguage = 'ja';
  payload.ocrAt = payload.ocrText ? new Date().toISOString() : '';
  if (state.editingRecord) {
    payload.id = state.editingRecord.id;
    payload.expectedUpdatedAt = state.editingRecord.updatedAt;
    payload.expectedRevision = state.editingRecord.revision;
  }
  return payload;
}

async function searchCards(): Promise<void> {
  const params = new URLSearchParams({
    keyword: inputEl('keyword').value.trim(),
    owner: inputEl('searchOwner').value.trim(),
    tag: inputEl('searchTag').value.trim()
  });
  try {
    const result = await api<SearchResponse>(`/api/cards?${params.toString()}`);
    renderResults(result.records || []);
  } catch (err) {
    showMessage('searchMessage', errorMessage(err, '検索に失敗しました。'), 'error');
  }
}

function renderResults(records: CardRecord[]): void {
  textEl('resultCount').textContent = `${records.length}件`;
  const root = document.getElementById('results');
  const template = document.getElementById('resultTemplate') as HTMLTemplateElement | null;
  if (!root || !template) return;
  root.innerHTML = '';
  records.forEach((record) => {
    const node = template.content.cloneNode(true) as DocumentFragment;
    const title = node.querySelector<HTMLElement>('.result-title');
    const meta = node.querySelector<HTMLElement>('.result-meta');
    const body = node.querySelector<HTMLElement>('.result-body');
    if (title) title.textContent = [record.company, record.name].filter(Boolean).join(' / ') || '(会社名・氏名なし)';
    if (meta) meta.textContent = [record.department, record.position, record.email, record.phone].filter(Boolean).join(' | ');
    if (body) body.innerHTML = buildResultBody(record);
    node.querySelector<HTMLButtonElement>('.edit-button')?.addEventListener('click', () => editRecord(record));
    node.querySelector<HTMLButtonElement>('.delete-button')?.addEventListener('click', () => void deleteRecord(record));
    root.appendChild(node);
  });
}

function buildResultBody(record: CardRecord): string {
  const parts: string[] = [];
  if (record.owner) parts.push(`名刺交換者: ${escapeHtml(record.owner)}`);
  if (record.exchangeDate) parts.push(`交換日: ${escapeHtml(record.exchangeDate)}`);
  if (record.tags) parts.push(`タグ: ${escapeHtml(record.tags)}`);
  if (record.group) parts.push(`グループ: ${escapeHtml(record.group)}`);
  if (record.memo) parts.push(`メモ: ${escapeHtml(record.memo)}`);
  if (record.imageUrl) parts.push(`<a href="${escapeAttr(record.imageUrl)}" target="_blank" rel="noreferrer">画像を開く</a>`);
  return parts.join('<br>');
}

function editRecord(record: CardRecord): void {
  state.editingRecord = record;
  textFieldIds.forEach((id: TextFieldId) => {
    inputEl(id).value = String(record[id] || '');
  });
  textareaEl('ocrText').value = record.ocrText || '';
  buttonEl('saveButton').textContent = '更新する';
  document.querySelector<HTMLButtonElement>('[data-tab="register"]')?.click();
  showMessage('saveMessage', '検索結果から編集内容を読み込みました。更新すると楽観ロックで競合確認します。', 'info');
}

async function deleteRecord(record: CardRecord): Promise<void> {
  const ok = window.confirm(`${record.company || ''} ${record.name || ''} を削除しますか？`);
  if (!ok) return;
  try {
    const result = await api<ApiResult>(`/api/cards/${encodeURIComponent(record.id)}`, {
      method: 'DELETE',
      body: JSON.stringify({ expectedUpdatedAt: record.updatedAt, expectedRevision: record.revision })
    });
    showMessage('searchMessage', result.message || '削除しました。', 'success');
    await searchCards();
  } catch (err) {
    showMessage('searchMessage', errorMessage(err, '削除に失敗しました。'), 'error');
  }
}

function resetForm(): void {
  const form = document.getElementById('cardForm') as HTMLFormElement | null;
  form?.reset();
  imageEl('imagePreview').style.display = 'none';
  textareaEl('ocrText').value = '';
  textEl('ocrStatus').textContent = 'OCR未実行';
  buttonEl('ocrButton').disabled = true;
  buttonEl('clearOcrButton').disabled = true;
  buttonEl('saveButton').textContent = '登録する';
  state.image = null;
  state.editingRecord = null;
}

async function api<T extends ApiResult | SearchResponse | InitialData>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (options.body) headers.set('Content-Type', 'application/json; charset=utf-8');
  const response = await fetch(path, { ...options, headers });
  const text = await response.text();
  let data: T;
  try {
    data = (text ? JSON.parse(text) : {}) as T;
  } catch (_err) {
    data = { ok: false, message: text } as T;
  }
  if (!response.ok || data.ok === false) throw new Error(data.message || `HTTP ${response.status}`);
  return data;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('ファイル読込に失敗しました。'));
    reader.readAsDataURL(file);
  });
}

function showMessage(id: string, message: string, type: 'info' | 'success' | 'error' = 'info'): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.className = `message show ${type}`;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function inputEl(id: string): HTMLInputElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement)) throw new Error(`${id} input が見つかりません。`);
  return el;
}

function textareaEl(id: string): HTMLTextAreaElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLTextAreaElement)) throw new Error(`${id} textarea が見つかりません。`);
  return el;
}

function buttonEl(id: string): HTMLButtonElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLButtonElement)) throw new Error(`${id} button が見つかりません。`);
  return el;
}

function imageEl(id: string): HTMLImageElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLImageElement)) throw new Error(`${id} image が見つかりません。`);
  return el;
}

function textEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`${id} element が見つかりません。`);
  return el;
}

function escapeHtml(value: unknown): string {
  return String(value || '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] || ch));
}

function escapeAttr(value: unknown): string {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

export {};
