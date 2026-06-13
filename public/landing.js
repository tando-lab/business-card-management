window.addEventListener('DOMContentLoaded', () => {
    void loadLanding();
});
async function loadLanding() {
    try {
        const [initial, diagnostics] = await Promise.all([
            api('/api/initial'),
            api('/api/diagnostics')
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
    }
    catch (err) {
        showMessage('loginMessage', errorMessage(err, 'ログイン状態の確認に失敗しました。'), 'error');
        text('loginUser').textContent = '確認失敗';
        text('dbStatus').textContent = '確認失敗';
        text('storageStatus').textContent = '確認失敗';
    }
}
async function api(endpoint) {
    const response = await fetch(endpoint, {
        headers: { 'Accept': 'application/json' }
    });
    const text = await response.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    }
    catch (_err) {
        throw new Error('API応答がJSONではありません。');
    }
    if (!response.ok) {
        const message = typeof data === 'object' && data && 'message' in data
            ? String(data.message || '')
            : '';
        throw new Error(message || `HTTP ${response.status}`);
    }
    return data;
}
function text(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`要素が見つかりません: ${id}`);
    return el;
}
function showMessage(id, message, type) {
    const el = text(id);
    el.textContent = message;
    el.className = `message ${type} show`;
}
function errorMessage(err, fallback) {
    if (err instanceof Error && err.message)
        return err.message;
    return fallback;
}
export {};
//# sourceMappingURL=landing.js.map