type StorageBackend = 'cloudflare_d1';
type StorageOperation = 'card.create' | 'card.update' | 'card.get' | 'card.search' | 'card.delete' | 'card.restore' | 'card.diagnostics';
type RecordStatus = 'ACTIVE' | 'DELETED';

interface CardCropBox { x: number; y: number; width: number; height: number; rotate: number; }
interface CardStorageRecord {
  recordId: string;
  recordStatus: RecordStatus;
  revision: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  deletedAt: string;
  deletedBy: string;
  companyName: string;
  companyNameKana: string;
  displayName: string;
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  departmentName: string;
  title: string;
  phoneNumber: string;
  mobileNumber: string;
  faxNumber: string;
  email: string;
  postalCode: string;
  addressText: string;
  websiteUrl: string;
  exchangedByLastName: string;
  exchangedByFirstName: string;
  exchangedByDisplayName: string;
  exchangeDate: string;
  exchangePlace: string;
  groupName: string;
  tags: string[];
  memo: string;
  imageStorageProvider: string;
  imageDriveFileId: string;
  imageUrl: string;
  originalImageDriveFileId: string;
  originalImageUrl: string;
  croppedImageDriveFileId: string;
  croppedImageUrl: string;
  imageFileName: string;
  imageMimeType: string;
  imageSizeBytes: string;
  imageQualityScore: string;
  brightnessStatus: string;
  blurStatus: string;
  frameStatus: string;
  skewStatus: string;
  contourStatus: string;
  retakeRequired: boolean;
  retakeReason: string;
  cropBox: CardCropBox | null;
  ocrText: string;
  ocrStatus: string;
  ocrLanguage: string;
  ocrProcessedAt: string;
  ocrEngine: string;
  ocrErrorMessage: string;
  ocrSourceImageType: string;
  searchKey: string;
  searchText: string;
}
interface StorageJsonRequest {
  apiVersion: 'bc-storage.v1';
  operation: StorageOperation;
  requestId: string;
  client?: { app: string; version: string; source: string };
  payload: {
    record?: Partial<CardStorageRecord>;
    id?: string;
    expectedUpdatedAt?: string;
    expectedRevision?: string;
    deletedBy?: string;
    criteria?: { keyword?: string; owner?: string; tag?: string; limit?: number; includeDeleted?: boolean };
  };
}
interface StorageJsonResponse {
  ok: boolean;
  apiVersion: 'bc-storage.v1';
  operation: StorageOperation;
  requestId: string;
  data?: { record?: CardStorageRecord; records?: CardStorageRecord[]; recordId?: string; revision?: string; createdAt?: string; updatedAt?: string; backend?: StorageBackend; diagnostics?: Record<string, unknown> };
  error?: { code: string; message: string };
  message?: string;
}
interface DbRow {
  id: string;
  record_status: string;
  created_at: string;
  updated_at: string;
  revision: number;
  company?: string;
  name?: string;
  kana?: string;
  department?: string;
  position?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  owner?: string;
  exchange_date?: string;
  tags?: string;
  group_name?: string;
  memo?: string;
  image_url?: string;
  image_file_id?: string;
  original_image_url?: string;
  original_image_file_id?: string;
  cropped_image_url?: string;
  cropped_image_file_id?: string;
  quality_score?: string;
  retake_decision?: string;
  ocr_text?: string;
  ocr_status?: string;
  ocr_language?: string;
  ocr_at?: string;
  registered_by?: string;
  updated_by?: string;
  deleted_at?: string;
  deleted_by?: string;
  search_key?: string;
  search_text?: string;
  data_json?: string;
}

const API_VERSION = 'bc-storage.v1' as const;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return cors(json({ ok: true }), 204);
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/health') {
      return json({ ok: true, service: 'business-card-d1-api' });
    }
    if (request.method !== 'POST' || url.pathname !== '/api/storage') {
      return json({ ok: false, message: 'not found' }, 404);
    }
    if (!isAuthorized(request, env)) {
      return json({ ok: false, message: 'unauthorized' }, 401);
    }

    let body: StorageJsonRequest;
    try {
      body = await request.json() as StorageJsonRequest;
    } catch (_err) {
      return json({ ok: false, message: 'invalid json' }, 400);
    }
    if (body.apiVersion !== API_VERSION || !body.operation || !body.requestId) {
      return json(error(body, 'BAD_REQUEST', 'Storage JSON Protocol v1 の要求形式ではありません。'), 400);
    }

    try {
      const result = await dispatch(body, env);
      return json(result, result.ok ? 200 : statusForError(result.error?.code));
    } catch (err) {
      return json(error(body, 'BACKEND_ERROR', err instanceof Error ? err.message : String(err)), 500);
    }
  }
};

async function dispatch(req: StorageJsonRequest, env: Env): Promise<StorageJsonResponse> {
  if (req.operation === 'card.create') return createCard(req, env);
  if (req.operation === 'card.update') return updateCard(req, env);
  if (req.operation === 'card.delete') return deleteCard(req, env);
  if (req.operation === 'card.restore') return restoreCard(req, env);
  if (req.operation === 'card.search') return searchCards(req, env);
  if (req.operation === 'card.get') return getCard(req, env);
  if (req.operation === 'card.diagnostics') return diagnostics(req, env);
  return error(req, 'BAD_REQUEST', '未対応のoperationです。');
}

async function createCard(req: StorageJsonRequest, env: Env): Promise<StorageJsonResponse> {
  const record = normalizeRecord(req.payload.record || {});
  if (!record.recordId) return error(req, 'VALIDATION_ERROR', 'record.recordId がありません。');
  record.revision = record.revision || '1';
  record.recordStatus = record.recordStatus || 'ACTIVE';
  record.searchText = buildSearchText(record);
  record.searchKey = record.searchText;
  await upsertRecord(env.DB, record, true);
  return ok(req, { record, recordId: record.recordId, revision: record.revision, createdAt: record.createdAt, updatedAt: record.updatedAt, backend: 'cloudflare_d1' }, '登録しました。');
}

async function updateCard(req: StorageJsonRequest, env: Env): Promise<StorageJsonResponse> {
  const id = req.payload.id || req.payload.record?.recordId || '';
  if (!id) return error(req, 'VALIDATION_ERROR', '更新対象のrecordIdがありません。');
  const current = await getRecordById(env.DB, id);
  if (!current) return error(req, 'NOT_FOUND', '更新対象の名刺が見つかりません。');
  const conflict = checkConflict(current, req.payload.expectedUpdatedAt || '', req.payload.expectedRevision || '');
  if (conflict) return error(req, 'CONFLICT', conflict);
  const patch = normalizePartialRecord(req.payload.record || {});
  const next = normalizeRecord({ ...current, ...patch, recordId: id });
  next.recordStatus = 'ACTIVE';
  next.revision = String((Number(current.revision) || 0) + 1);
  next.updatedAt = patch.updatedAt || new Date().toISOString();
  next.searchText = buildSearchText(next);
  next.searchKey = next.searchText;
  await upsertRecord(env.DB, next, false);
  return ok(req, { record: next, recordId: id, revision: next.revision, updatedAt: next.updatedAt, backend: 'cloudflare_d1' }, '更新しました。');
}

async function deleteCard(req: StorageJsonRequest, env: Env): Promise<StorageJsonResponse> {
  const id = req.payload.id || req.payload.record?.recordId || '';
  if (!id) return error(req, 'VALIDATION_ERROR', '削除対象のrecordIdがありません。');
  const current = await getRecordById(env.DB, id);
  if (!current) return error(req, 'NOT_FOUND', '削除対象の名刺が見つかりません。');
  const conflict = checkConflict(current, req.payload.expectedUpdatedAt || '', req.payload.expectedRevision || '');
  if (conflict) return error(req, 'CONFLICT', conflict);
  const now = new Date().toISOString();
  const next = normalizeRecord({
    ...current,
    recordStatus: 'DELETED',
    revision: String((Number(current.revision) || 0) + 1),
    updatedAt: now,
    updatedBy: req.payload.deletedBy || current.updatedBy,
    deletedAt: now,
    deletedBy: req.payload.deletedBy || current.deletedBy
  });
  await upsertRecord(env.DB, next, false);
  return ok(req, { record: next, recordId: id, revision: next.revision, updatedAt: next.updatedAt, backend: 'cloudflare_d1' }, '削除しました。');
}

async function restoreCard(req: StorageJsonRequest, env: Env): Promise<StorageJsonResponse> {
  const id = req.payload.id || req.payload.record?.recordId || '';
  if (!id) return error(req, 'VALIDATION_ERROR', '復元対象のrecordIdがありません。');
  const current = await getRecordById(env.DB, id);
  if (!current) return error(req, 'NOT_FOUND', '復元対象の名刺が見つかりません。');
  const now = new Date().toISOString();
  const next = normalizeRecord({ ...current, recordStatus: 'ACTIVE', revision: String((Number(current.revision) || 0) + 1), updatedAt: now, deletedAt: '', deletedBy: '' });
  await upsertRecord(env.DB, next, false);
  return ok(req, { record: next, recordId: id, revision: next.revision, updatedAt: next.updatedAt, backend: 'cloudflare_d1' }, '復元しました。');
}

async function getCard(req: StorageJsonRequest, env: Env): Promise<StorageJsonResponse> {
  const id = req.payload.id || req.payload.record?.recordId || '';
  if (!id) return error(req, 'VALIDATION_ERROR', '取得対象のrecordIdがありません。');
  const record = await getRecordById(env.DB, id);
  if (!record) return error(req, 'NOT_FOUND', '対象の名刺が見つかりません。');
  return ok(req, { record, backend: 'cloudflare_d1' });
}

async function searchCards(req: StorageJsonRequest, env: Env): Promise<StorageJsonResponse> {
  const criteria = req.payload.criteria || {};
  const limit = Math.min(Math.max(Number(criteria.limit) || 100, 1), 100);
  const rows = await env.DB.prepare('SELECT * FROM business_cards ORDER BY updated_at DESC LIMIT 500').all<DbRow>();
  const keyword = normalizeText(criteria.keyword || '');
  const owner = normalizeText(criteria.owner || '');
  const tag = normalizeText(criteria.tag || '');
  const records: CardStorageRecord[] = [];
  for (const row of rows.results || []) {
    const record = rowToRecord(row);
    if (!criteria.includeDeleted && record.recordStatus === 'DELETED') continue;
    const searchText = record.searchText || buildSearchText(record);
    if (keyword && !searchText.includes(keyword)) continue;
    if (owner && !normalizeText(record.exchangedByDisplayName || `${record.exchangedByLastName} ${record.exchangedByFirstName}`).includes(owner)) continue;
    if (tag && !normalizeText(record.tags.join(' ')).includes(tag)) continue;
    records.push(record);
    if (records.length >= limit) break;
  }
  return ok(req, { records, backend: 'cloudflare_d1' });
}

async function diagnostics(req: StorageJsonRequest, env: Env): Promise<StorageJsonResponse> {
  const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM business_cards').first<{ count: number }>();
  return ok(req, { backend: 'cloudflare_d1', diagnostics: { table: 'business_cards', count: count?.count ?? 0 } });
}

async function getRecordById(db: D1Database, id: string): Promise<CardStorageRecord | null> {
  const row = await db.prepare('SELECT * FROM business_cards WHERE id = ?').bind(id).first<DbRow>();
  return row ? rowToRecord(row) : null;
}

async function upsertRecord(db: D1Database, record: CardStorageRecord, isCreate: boolean): Promise<void> {
  const query = `INSERT INTO business_cards (
    id, record_status, created_at, updated_at, revision, company, name, kana, department, position,
    phone, email, address, website, owner, exchange_date, tags, group_name, memo,
    image_url, image_file_id, original_image_url, original_image_file_id, cropped_image_url, cropped_image_file_id,
    quality_score, retake_decision, ocr_text, ocr_status, ocr_language, ocr_at,
    registered_by, updated_by, deleted_at, deleted_by, search_key, search_text, data_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    record_status=excluded.record_status,
    updated_at=excluded.updated_at,
    revision=excluded.revision,
    company=excluded.company,
    name=excluded.name,
    kana=excluded.kana,
    department=excluded.department,
    position=excluded.position,
    phone=excluded.phone,
    email=excluded.email,
    address=excluded.address,
    website=excluded.website,
    owner=excluded.owner,
    exchange_date=excluded.exchange_date,
    tags=excluded.tags,
    group_name=excluded.group_name,
    memo=excluded.memo,
    image_url=excluded.image_url,
    image_file_id=excluded.image_file_id,
    original_image_url=excluded.original_image_url,
    original_image_file_id=excluded.original_image_file_id,
    cropped_image_url=excluded.cropped_image_url,
    cropped_image_file_id=excluded.cropped_image_file_id,
    quality_score=excluded.quality_score,
    retake_decision=excluded.retake_decision,
    ocr_text=excluded.ocr_text,
    ocr_status=excluded.ocr_status,
    ocr_language=excluded.ocr_language,
    ocr_at=excluded.ocr_at,
    updated_by=excluded.updated_by,
    deleted_at=excluded.deleted_at,
    deleted_by=excluded.deleted_by,
    search_key=excluded.search_key,
    search_text=excluded.search_text,
    data_json=excluded.data_json`;
  await db.prepare(query).bind(
    record.recordId,
    record.recordStatus,
    record.createdAt || new Date().toISOString(),
    record.updatedAt || new Date().toISOString(),
    Number(record.revision) || 1,
    record.companyName,
    record.displayName || [record.lastName, record.firstName].filter(Boolean).join(' '),
    [record.lastNameKana, record.firstNameKana].filter(Boolean).join(' '),
    record.departmentName,
    record.title,
    record.phoneNumber || record.mobileNumber,
    record.email,
    [record.postalCode, record.addressText].filter(Boolean).join(' '),
    record.websiteUrl,
    record.exchangedByDisplayName || [record.exchangedByLastName, record.exchangedByFirstName].filter(Boolean).join(' '),
    record.exchangeDate,
    record.tags.join(', '),
    record.groupName,
    record.memo,
    record.imageUrl,
    record.imageDriveFileId,
    record.originalImageUrl,
    record.originalImageDriveFileId,
    record.croppedImageUrl,
    record.croppedImageDriveFileId,
    record.imageQualityScore,
    record.retakeReason || (record.retakeRequired ? '推奨' : '不要'),
    record.ocrText,
    record.ocrStatus,
    record.ocrLanguage,
    record.ocrProcessedAt,
    record.createdBy,
    record.updatedBy,
    record.deletedAt,
    record.deletedBy,
    record.searchKey,
    record.searchText,
    JSON.stringify(record)
  ).run();
}

function rowToRecord(row: DbRow): CardStorageRecord {
  if (row.data_json && row.data_json !== '{}') {
    try {
      return normalizeRecord(JSON.parse(row.data_json) as Partial<CardStorageRecord>);
    } catch (_err) {
      // data_json破損時は旧列から復元する
    }
  }
  return normalizeRecord({
    recordId: row.id,
    recordStatus: row.record_status === 'DELETED' ? 'DELETED' : 'ACTIVE',
    revision: String(row.revision || 1),
    createdAt: row.created_at || '',
    createdBy: row.registered_by || '',
    updatedAt: row.updated_at || '',
    updatedBy: row.updated_by || '',
    deletedAt: row.deleted_at || '',
    deletedBy: row.deleted_by || '',
    companyName: row.company || '',
    displayName: row.name || '',
    lastNameKana: row.kana || '',
    departmentName: row.department || '',
    title: row.position || '',
    phoneNumber: row.phone || '',
    email: row.email || '',
    addressText: row.address || '',
    websiteUrl: row.website || '',
    exchangedByDisplayName: row.owner || '',
    exchangeDate: row.exchange_date || '',
    tags: splitTags(row.tags || ''),
    groupName: row.group_name || '',
    memo: row.memo || '',
    imageUrl: row.image_url || '',
    imageDriveFileId: row.image_file_id || '',
    originalImageUrl: row.original_image_url || '',
    originalImageDriveFileId: row.original_image_file_id || '',
    croppedImageUrl: row.cropped_image_url || '',
    croppedImageDriveFileId: row.cropped_image_file_id || '',
    imageQualityScore: String(row.quality_score || ''),
    retakeReason: row.retake_decision || '',
    retakeRequired: row.retake_decision === '必須' || row.retake_decision === '推奨',
    ocrText: row.ocr_text || '',
    ocrStatus: row.ocr_status || '',
    ocrLanguage: row.ocr_language || 'ja',
    ocrProcessedAt: row.ocr_at || '',
    searchKey: row.search_key || row.search_text || '',
    searchText: row.search_text || row.search_key || ''
  });
}

function normalizeRecord(value: Partial<CardStorageRecord>): CardStorageRecord {
  const record: CardStorageRecord = {
    recordId: s(value.recordId), recordStatus: value.recordStatus === 'DELETED' ? 'DELETED' : 'ACTIVE', revision: s(value.revision) || '1',
    createdAt: s(value.createdAt), createdBy: s(value.createdBy), updatedAt: s(value.updatedAt), updatedBy: s(value.updatedBy), deletedAt: s(value.deletedAt), deletedBy: s(value.deletedBy),
    companyName: s(value.companyName), companyNameKana: s(value.companyNameKana), displayName: s(value.displayName), lastName: s(value.lastName), firstName: s(value.firstName), lastNameKana: s(value.lastNameKana), firstNameKana: s(value.firstNameKana), departmentName: s(value.departmentName), title: s(value.title),
    phoneNumber: s(value.phoneNumber), mobileNumber: s(value.mobileNumber), faxNumber: s(value.faxNumber), email: s(value.email), postalCode: s(value.postalCode), addressText: s(value.addressText), websiteUrl: s(value.websiteUrl),
    exchangedByLastName: s(value.exchangedByLastName), exchangedByFirstName: s(value.exchangedByFirstName), exchangedByDisplayName: s(value.exchangedByDisplayName), exchangeDate: s(value.exchangeDate), exchangePlace: s(value.exchangePlace),
    groupName: s(value.groupName), tags: Array.isArray(value.tags) ? value.tags.map(s).filter(Boolean) : splitTags(value.tags as unknown as string), memo: s(value.memo),
    imageStorageProvider: s(value.imageStorageProvider) || 'google_drive', imageDriveFileId: s(value.imageDriveFileId), imageUrl: s(value.imageUrl), originalImageDriveFileId: s(value.originalImageDriveFileId), originalImageUrl: s(value.originalImageUrl), croppedImageDriveFileId: s(value.croppedImageDriveFileId), croppedImageUrl: s(value.croppedImageUrl), imageFileName: s(value.imageFileName), imageMimeType: s(value.imageMimeType), imageSizeBytes: s(value.imageSizeBytes),
    imageQualityScore: s(value.imageQualityScore), brightnessStatus: s(value.brightnessStatus), blurStatus: s(value.blurStatus), frameStatus: s(value.frameStatus), skewStatus: s(value.skewStatus), contourStatus: s(value.contourStatus), retakeRequired: value.retakeRequired === true, retakeReason: s(value.retakeReason), cropBox: value.cropBox || null,
    ocrText: s(value.ocrText), ocrStatus: s(value.ocrStatus), ocrLanguage: s(value.ocrLanguage) || 'ja', ocrProcessedAt: s(value.ocrProcessedAt), ocrEngine: s(value.ocrEngine), ocrErrorMessage: s(value.ocrErrorMessage), ocrSourceImageType: s(value.ocrSourceImageType),
    searchKey: s(value.searchKey), searchText: s(value.searchText)
  };
  record.searchText = record.searchText || buildSearchText(record);
  record.searchKey = record.searchKey || record.searchText;
  return record;
}

function normalizePartialRecord(value: Partial<CardStorageRecord>): Partial<CardStorageRecord> {
  const copy = { ...value };
  if (value.tags !== undefined) copy.tags = Array.isArray(value.tags) ? value.tags.map(s).filter(Boolean) : splitTags(value.tags as unknown as string);
  return copy;
}

function buildSearchText(record: Partial<CardStorageRecord>): string {
  return normalizeText([
    record.companyName, record.companyNameKana, record.displayName, record.lastName, record.firstName,
    record.lastNameKana, record.firstNameKana, record.departmentName, record.title, record.phoneNumber,
    record.mobileNumber, record.faxNumber, record.email, record.postalCode, record.addressText, record.websiteUrl,
    record.exchangedByLastName, record.exchangedByFirstName, record.exchangedByDisplayName, record.exchangeDate,
    record.exchangePlace, record.groupName, Array.isArray(record.tags) ? record.tags.join(' ') : '', record.memo, record.ocrText
  ].join(' '));
}

function splitTags(value: string): string[] { return s(value).split(/[、,\n]/).map((x) => x.trim()).filter(Boolean); }
function normalizeText(value: unknown): string { return s(value).toLowerCase().replace(/[\u3000\s]+/g, ' ').trim(); }
function s(value: unknown): string { return String(value ?? '').trim(); }
function checkConflict(current: CardStorageRecord, expectedUpdatedAt: string, expectedRevision: string): string {
  if (expectedUpdatedAt && expectedUpdatedAt !== current.updatedAt) return '他の利用者により更新されています。検索結果を再読み込みしてから操作してください。';
  if (expectedRevision && expectedRevision !== current.revision) return '他の利用者により更新されています。検索結果を再読み込みしてから操作してください。';
  return '';
}
function ok(req: StorageJsonRequest, data: NonNullable<StorageJsonResponse['data']>, message = ''): StorageJsonResponse { return { ok: true, apiVersion: API_VERSION, operation: req.operation, requestId: req.requestId, data, message }; }
function error(req: Partial<StorageJsonRequest>, code: string, message: string): StorageJsonResponse { return { ok: false, apiVersion: API_VERSION, operation: req.operation || 'card.diagnostics', requestId: req.requestId || '', error: { code, message }, message }; }
function statusForError(code?: string): number { if (code === 'UNAUTHORIZED') return 401; if (code === 'NOT_FOUND') return 404; if (code === 'CONFLICT') return 409; if (code === 'VALIDATION_ERROR' || code === 'BAD_REQUEST') return 400; return 500; }
function json(body: unknown, status = 200): Response { return cors(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })); }
function isAuthorized(request: Request, env: Env): boolean {
  const expected = env.BUSINESS_CARD_API_TOKEN || '';
  const authorization = request.headers.get('Authorization') || '';
  if (!expected || !authorization.startsWith('Bearer ')) return false;
  return authorization.slice('Bearer '.length).trim() === expected;
}

function cors(response: Response, status?: number): Response { const headers = new Headers(response.headers); headers.set('Access-Control-Allow-Origin', '*'); headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS'); headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization'); return new Response(response.body, { status: status ?? response.status, headers }); }
