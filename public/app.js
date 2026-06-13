const state = {
    image: null,
    editingRecord: null,
    userEmail: ''
};
const textFieldIds = [
    'company', 'name', 'kana', 'department', 'position', 'phone', 'email', 'website',
    'address', 'owner', 'exchangeDate', 'tags', 'group', 'memo'
];
window.addEventListener('DOMContentLoaded', async () => {
    bindTabs();
    bindImage();
    bindForm();
    bindSearch();
    bindOcr();
    await loadInitialData();
});
async function loadInitialData() {
    try {
        const data = await api('/api/initial');
        textEl('appTitle').textContent = data.appTitle || '名刺共有台帳';
        document.title = data.appTitle || '名刺共有台帳';
        state.userEmail = data.userEmail || '';
        textEl('userInfo').textContent = state.userEmail
            ? `ログイン: ${state.userEmail}`
            : 'Cloudflare Access未設定またはローカル検証中';
        textEl('buildBadge').textContent = data.metadata?.buildBadge || 'Cloudflare版';
        const date = inputEl('exchangeDate');
        if (!date.value)
            date.value = data.today || '';
        if (!data.authenticated) {
            showMessage('globalMessage', '本番では Cloudflare Access を設定して nextbrain.pro / nextbrain.biz のGoogleアカウントに限定してください。', 'info');
        }
    }
    catch (err) {
        showMessage('globalMessage', errorMessage(err, '初期データの取得に失敗しました。'), 'error');
    }
}
function bindTabs() {
    document.querySelectorAll('.tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach((el) => el.classList.remove('active'));
            document.querySelectorAll('.panel').forEach((el) => el.classList.remove('active'));
            tab.classList.add('active');
            const target = document.getElementById(`${tab.dataset.tab}Panel`);
            target?.classList.add('active');
            if (tab.dataset.tab === 'search')
                void searchCards();
        });
    });
}
function bindImage() {
    inputEl('imageFile').addEventListener('change', async (event) => {
        const target = event.target;
        const file = target.files?.[0];
        if (!file)
            return;
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
function bindForm() {
    const form = document.getElementById('cardForm');
    if (!form)
        throw new Error('cardForm が見つかりません。');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = buttonEl('saveButton');
        button.disabled = true;
        try {
            const payload = buildPayload();
            const endpoint = state.editingRecord ? `/api/cards/${encodeURIComponent(state.editingRecord.id)}` : '/api/cards';
            const method = state.editingRecord ? 'PUT' : 'POST';
            const result = await api(endpoint, { method, body: JSON.stringify(payload) });
            showMessage('saveMessage', result.message || '保存しました。', 'success');
            resetForm();
            await searchCards();
        }
        catch (err) {
            showMessage('saveMessage', errorMessage(err, '保存に失敗しました。'), 'error');
        }
        finally {
            button.disabled = false;
        }
    });
}
function bindSearch() {
    buttonEl('searchButton').addEventListener('click', () => void searchCards());
}
function bindOcr() {
    buttonEl('ocrButton').addEventListener('click', async () => {
        if (!state.image)
            return;
        const button = buttonEl('ocrButton');
        button.disabled = true;
        textEl('ocrStatus').textContent = 'OCR実行中...';
        try {
            const result = await api('/api/ocr', {
                method: 'POST',
                body: JSON.stringify({ image: state.image, ocrLanguage: 'ja' })
            });
            textareaEl('ocrText').value = String(result.text || '');
            textEl('ocrStatus').textContent = result.message || result.ocrStatus || 'OCR完了';
            buttonEl('clearOcrButton').disabled = false;
        }
        catch (err) {
            textEl('ocrStatus').textContent = errorMessage(err, 'OCRに失敗しました。');
        }
        finally {
            button.disabled = false;
        }
    });
    buttonEl('clearOcrButton').addEventListener('click', () => {
        textareaEl('ocrText').value = '';
        textEl('ocrStatus').textContent = 'OCR未実行';
        buttonEl('clearOcrButton').disabled = true;
    });
}
function buildPayload() {
    const payload = {};
    textFieldIds.forEach((id) => {
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
async function searchCards() {
    const params = new URLSearchParams({
        keyword: inputEl('keyword').value.trim(),
        owner: inputEl('searchOwner').value.trim(),
        tag: inputEl('searchTag').value.trim()
    });
    try {
        const result = await api(`/api/cards?${params.toString()}`);
        renderResults(result.records || []);
    }
    catch (err) {
        showMessage('searchMessage', errorMessage(err, '検索に失敗しました。'), 'error');
    }
}
function renderResults(records) {
    textEl('resultCount').textContent = `${records.length}件`;
    const root = document.getElementById('results');
    const template = document.getElementById('resultTemplate');
    if (!root || !template)
        return;
    root.innerHTML = '';
    records.forEach((record) => {
        const node = template.content.cloneNode(true);
        const title = node.querySelector('.result-title');
        const meta = node.querySelector('.result-meta');
        const body = node.querySelector('.result-body');
        if (title)
            title.textContent = [record.company, record.name].filter(Boolean).join(' / ') || '(会社名・氏名なし)';
        if (meta)
            meta.textContent = [record.department, record.position, record.email, record.phone].filter(Boolean).join(' | ');
        if (body)
            body.innerHTML = buildResultBody(record);
        node.querySelector('.edit-button')?.addEventListener('click', () => editRecord(record));
        node.querySelector('.delete-button')?.addEventListener('click', () => void deleteRecord(record));
        root.appendChild(node);
    });
}
function buildResultBody(record) {
    const parts = [];
    if (record.owner)
        parts.push(`名刺交換者: ${escapeHtml(record.owner)}`);
    if (record.exchangeDate)
        parts.push(`交換日: ${escapeHtml(record.exchangeDate)}`);
    if (record.tags)
        parts.push(`タグ: ${escapeHtml(record.tags)}`);
    if (record.group)
        parts.push(`グループ: ${escapeHtml(record.group)}`);
    if (record.memo)
        parts.push(`メモ: ${escapeHtml(record.memo)}`);
    if (record.imageUrl)
        parts.push(`<a href="${escapeAttr(record.imageUrl)}" target="_blank" rel="noreferrer">画像を開く</a>`);
    return parts.join('<br>');
}
function editRecord(record) {
    state.editingRecord = record;
    textFieldIds.forEach((id) => {
        inputEl(id).value = String(record[id] || '');
    });
    textareaEl('ocrText').value = record.ocrText || '';
    buttonEl('saveButton').textContent = '更新する';
    document.querySelector('[data-tab="register"]')?.click();
    showMessage('saveMessage', '検索結果から編集内容を読み込みました。更新すると楽観ロックで競合確認します。', 'info');
}
async function deleteRecord(record) {
    const ok = window.confirm(`${record.company || ''} ${record.name || ''} を削除しますか？`);
    if (!ok)
        return;
    try {
        const result = await api(`/api/cards/${encodeURIComponent(record.id)}`, {
            method: 'DELETE',
            body: JSON.stringify({ expectedUpdatedAt: record.updatedAt, expectedRevision: record.revision })
        });
        showMessage('searchMessage', result.message || '削除しました。', 'success');
        await searchCards();
    }
    catch (err) {
        showMessage('searchMessage', errorMessage(err, '削除に失敗しました。'), 'error');
    }
}
function resetForm() {
    const form = document.getElementById('cardForm');
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
async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body)
        headers.set('Content-Type', 'application/json; charset=utf-8');
    const response = await fetch(path, { ...options, headers });
    const text = await response.text();
    let data;
    try {
        data = (text ? JSON.parse(text) : {});
    }
    catch (_err) {
        data = { ok: false, message: text };
    }
    if (!response.ok || data.ok === false)
        throw new Error(data.message || `HTTP ${response.status}`);
    return data;
}
function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('ファイル読込に失敗しました。'));
        reader.readAsDataURL(file);
    });
}
function showMessage(id, message, type = 'info') {
    const el = document.getElementById(id);
    if (!el)
        return;
    el.textContent = message;
    el.className = `message show ${type}`;
}
function errorMessage(err, fallback) {
    return err instanceof Error && err.message ? err.message : fallback;
}
function inputEl(id) {
    const el = document.getElementById(id);
    if (!(el instanceof HTMLInputElement))
        throw new Error(`${id} input が見つかりません。`);
    return el;
}
function textareaEl(id) {
    const el = document.getElementById(id);
    if (!(el instanceof HTMLTextAreaElement))
        throw new Error(`${id} textarea が見つかりません。`);
    return el;
}
function buttonEl(id) {
    const el = document.getElementById(id);
    if (!(el instanceof HTMLButtonElement))
        throw new Error(`${id} button が見つかりません。`);
    return el;
}
function imageEl(id) {
    const el = document.getElementById(id);
    if (!(el instanceof HTMLImageElement))
        throw new Error(`${id} image が見つかりません。`);
    return el;
}
function textEl(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`${id} element が見つかりません。`);
    return el;
}
function escapeHtml(value) {
    return String(value || '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] || ch));
}
function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, '&#39;');
}
export {};
//# sourceMappingURL=app.js.map