type StorageBackend = 'cloudflare_d1';
type StorageOperation = 'card.create' | 'card.update' | 'card.get' | 'card.search' | 'card.delete' | 'card.restore' | 'card.diagnostics';
type RecordStatus = 'ACTIVE' | 'DELETED' | 'ARCHIVED';

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
  imageWidth: string;
  imageHeight: string;
  imageFolderId: string;
  imageQualityScore: string;
  brightnessStatus: string;
  blurStatus: string;
  frameStatus: string;
  skewStatus: string;
  contourStatus: string;
  retakeRequired: boolean;
  retakeReason: string;
  qualityWarnings: string[];
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
  nameSortKey: string;
  companySortKey: string;
  emailLower: string;
  phoneDigits: string;
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
  error?: { code: string; message: string; details?: Array<{ field?: string; reason?: string }> };
  message?: string;
}
interface DbRow {
  record_id?: string;
  record_status?: string;
  revision?: number;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  deleted_at?: string;
  deleted_by?: string;
  company_name?: string;
  company_name_kana?: string;
  last_name?: string;
  first_name?: string;
  last_name_kana?: string;
  first_name_kana?: string;
  department_name?: string;
  title?: string;
  phone_number?: string;
  mobile_number?: string;
  fax_number?: string;
  email?: string;
  postal_code?: string;
  address_text?: string;
  website_url?: string;
  exchanged_by_last_name?: string;
  exchanged_by_first_name?: string;
  exchange_date?: string;
  exchange_place?: string;
  group_name?: string;
  tags?: string;
  memo?: string;
  image_storage_provider?: string;
  image_drive_file_id?: string;
  image_url?: string;
  original_image_drive_file_id?: string;
  original_image_url?: string;
  cropped_image_drive_file_id?: string;
  cropped_image_url?: string;
  image_file_name?: string;
  image_mime_type?: string;
  image_size_bytes?: string;
  image_width?: string;
  image_height?: string;
  image_folder_id?: string;
  image_quality_score?: string;
  brightness_status?: string;
  blur_status?: string;
  frame_status?: string;
  skew_status?: string;
  contour_status?: string;
  retake_required?: string;
  retake_reason?: string;
  quality_warnings?: string;
  crop_box?: string;
  ocr_text?: string;
  ocr_status?: string;
  ocr_language?: string;
  ocr_processed_at?: string;
  ocr_engine?: string;
  ocr_error_message?: string;
  ocr_source_image_type?: string;
  search_key?: string;
  search_text?: string;
  name_sort_key?: string;
  company_sort_key?: string;
  email_lower?: string;
  phone_digits?: string;
  data_json?: string;
}

const API_VERSION = 'bc-storage.v1' as const;
const DEFAULT_GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxwpIIkhm2uwfz36Jv2XDOcZqv2XtDyTYyNeMTVJELwWKFGXy5X34HXbXGy0US5TmaogA/exec';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return cors(json({ ok: true }), 204);
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      return loginPage(env);
    }

    if (request.method === 'GET' && (url.pathname === '/api' || url.pathname === '/api/' || url.pathname === '/api/health')) {
      return json({
        ok: true,
        service: 'business-card-d1-api',
        schemaVersion: 'r60',
        login: '/',
        storageApi: '/api/storage',
        auth: {
          requiredHeader: 'X-API-Key',
          workerApiKeyConfigured: Boolean(String(env.BUSINESS_CARD_API_KEY || '').trim())
        }
      });
    }

    const isStorageApi = request.method === 'POST' && (url.pathname === '/api/storage' || url.pathname === '/api' || url.pathname === '/api/');
    if (!isStorageApi) return json({ ok: false, message: 'not found' }, 404);

    const auth = inspectApiKey(request, env);
    if (!auth.authorized) return json(unauthorizedResponse(auth), 401);
    let body: StorageJsonRequest;
    try { body = await request.json() as StorageJsonRequest; } catch (_err) { return json({ ok: false, message: 'invalid json' }, 400); }
    if (body.apiVersion !== API_VERSION || !body.operation || !body.requestId) return json(error(body, 'BAD_REQUEST', 'Storage JSON Protocol v1 の要求形式ではありません。'), 400);
    try { const result = await dispatch(body, env); return json(result, result.ok ? 200 : statusForError(result.error?.code)); }
    catch (err) { return json(error(body, 'BACKEND_ERROR', err instanceof Error ? err.message : String(err)), 500); }
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
  record.revision = record.revision || '1'; record.recordStatus = record.recordStatus || 'ACTIVE';
  finalizeSearchFields(record);
  await upsertRecord(env.DB, record);
  return ok(req, { record, recordId: record.recordId, revision: record.revision, createdAt: record.createdAt, updatedAt: record.updatedAt, backend: 'cloudflare_d1' }, '登録しました。');
}
async function updateCard(req: StorageJsonRequest, env: Env): Promise<StorageJsonResponse> {
  const id = req.payload.id || req.payload.record?.recordId || ''; if (!id) return error(req, 'VALIDATION_ERROR', '更新対象のrecordIdがありません。');
  const current = await getRecordById(env.DB, id); if (!current) return error(req, 'NOT_FOUND', '更新対象の名刺が見つかりません。');
  const conflict = checkConflict(current, req.payload.expectedUpdatedAt || '', req.payload.expectedRevision || ''); if (conflict) return error(req, 'CONFLICT', conflict);
  const patch = normalizePartialRecord(req.payload.record || {});
  const next = normalizeRecord({ ...current, ...patch, recordId: id, recordStatus: 'ACTIVE', revision: String((Number(current.revision) || 0) + 1), updatedAt: patch.updatedAt || new Date().toISOString() });
  finalizeSearchFields(next); await upsertRecord(env.DB, next);
  return ok(req, { record: next, recordId: id, revision: next.revision, updatedAt: next.updatedAt, backend: 'cloudflare_d1' }, '更新しました。');
}
async function deleteCard(req: StorageJsonRequest, env: Env): Promise<StorageJsonResponse> {
  const id = req.payload.id || req.payload.record?.recordId || ''; if (!id) return error(req, 'VALIDATION_ERROR', '削除対象のrecordIdがありません。');
  const current = await getRecordById(env.DB, id); if (!current) return error(req, 'NOT_FOUND', '削除対象の名刺が見つかりません。');
  const conflict = checkConflict(current, req.payload.expectedUpdatedAt || '', req.payload.expectedRevision || ''); if (conflict) return error(req, 'CONFLICT', conflict);
  const now = new Date().toISOString();
  const next = normalizeRecord({ ...current, recordStatus: 'DELETED', revision: String((Number(current.revision) || 0) + 1), updatedAt: now, updatedBy: req.payload.deletedBy || current.updatedBy, deletedAt: now, deletedBy: req.payload.deletedBy || current.deletedBy });
  finalizeSearchFields(next); await upsertRecord(env.DB, next);
  return ok(req, { record: next, recordId: id, revision: next.revision, updatedAt: next.updatedAt, backend: 'cloudflare_d1' }, '削除しました。');
}
async function restoreCard(req: StorageJsonRequest, env: Env): Promise<StorageJsonResponse> {
  const id = req.payload.id || req.payload.record?.recordId || ''; if (!id) return error(req, 'VALIDATION_ERROR', '復元対象のrecordIdがありません。');
  const current = await getRecordById(env.DB, id); if (!current) return error(req, 'NOT_FOUND', '復元対象の名刺が見つかりません。');
  const now = new Date().toISOString();
  const next = normalizeRecord({ ...current, recordStatus: 'ACTIVE', revision: String((Number(current.revision) || 0) + 1), updatedAt: now, deletedAt: '', deletedBy: '' });
  finalizeSearchFields(next); await upsertRecord(env.DB, next);
  return ok(req, { record: next, recordId: id, revision: next.revision, updatedAt: next.updatedAt, backend: 'cloudflare_d1' }, '復元しました。');
}
async function getCard(req: StorageJsonRequest, env: Env): Promise<StorageJsonResponse> {
  const id = req.payload.id || req.payload.record?.recordId || ''; if (!id) return error(req, 'VALIDATION_ERROR', '取得対象のrecordIdがありません。');
  const record = await getRecordById(env.DB, id); if (!record) return error(req, 'NOT_FOUND', '対象の名刺が見つかりません。');
  return ok(req, { record, backend: 'cloudflare_d1' });
}
async function searchCards(req: StorageJsonRequest, env: Env): Promise<StorageJsonResponse> {
  const criteria = req.payload.criteria || {}; const limit = Math.min(Math.max(Number(criteria.limit) || 100, 1), 100);
  const rows = await env.DB.prepare('SELECT * FROM business_cards ORDER BY updated_at DESC LIMIT 500').all<DbRow>();
  const keyword = normalizeText(criteria.keyword || ''); const owner = normalizeText(criteria.owner || ''); const tag = normalizeText(criteria.tag || ''); const records: CardStorageRecord[] = [];
  for (const row of rows.results || []) {
    const record = rowToRecord(row); if (!criteria.includeDeleted && record.recordStatus === 'DELETED') continue;
    const searchText = record.searchText || buildSearchText(record);
    if (keyword && !searchText.includes(keyword)) continue;
    if (owner && !normalizeText(`${record.exchangedByLastName} ${record.exchangedByFirstName}`).includes(owner)) continue;
    if (tag && !normalizeText(record.tags.join(' ')).includes(tag)) continue;
    records.push(record); if (records.length >= limit) break;
  }
  return ok(req, { records, backend: 'cloudflare_d1' });
}
async function diagnostics(req: StorageJsonRequest, env: Env): Promise<StorageJsonResponse> {
  const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM business_cards').first<{ count: number }>();
  return ok(req, { backend: 'cloudflare_d1', diagnostics: { table: 'business_cards', schemaVersion: 'r55', count: count?.count ?? 0 } });
}
async function getRecordById(db: D1Database, id: string): Promise<CardStorageRecord | null> {
  const row = await db.prepare('SELECT * FROM business_cards WHERE record_id = ?').bind(id).first<DbRow>();
  return row ? rowToRecord(row) : null;
}
async function upsertRecord(db: D1Database, record: CardStorageRecord): Promise<void> {
  const query = `INSERT INTO business_cards (record_id, record_status, revision, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, company_name, company_name_kana, last_name, first_name, last_name_kana, first_name_kana, department_name, title, phone_number, mobile_number, fax_number, email, postal_code, address_text, website_url, exchanged_by_last_name, exchanged_by_first_name, exchange_date, exchange_place, group_name, tags, memo, image_storage_provider, image_drive_file_id, image_url, original_image_drive_file_id, original_image_url, cropped_image_drive_file_id, cropped_image_url, image_file_name, image_mime_type, image_size_bytes, image_width, image_height, image_folder_id, image_quality_score, brightness_status, blur_status, frame_status, skew_status, contour_status, retake_required, retake_reason, quality_warnings, crop_box, ocr_text, ocr_status, ocr_language, ocr_processed_at, ocr_engine, ocr_error_message, ocr_source_image_type, search_key, search_text, name_sort_key, company_sort_key, email_lower, phone_digits, data_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(record_id) DO UPDATE SET
    record_status=excluded.record_status,
    revision=excluded.revision,
    created_at=excluded.created_at,
    created_by=excluded.created_by,
    updated_at=excluded.updated_at,
    updated_by=excluded.updated_by,
    deleted_at=excluded.deleted_at,
    deleted_by=excluded.deleted_by,
    company_name=excluded.company_name,
    company_name_kana=excluded.company_name_kana,
    last_name=excluded.last_name,
    first_name=excluded.first_name,
    last_name_kana=excluded.last_name_kana,
    first_name_kana=excluded.first_name_kana,
    department_name=excluded.department_name,
    title=excluded.title,
    phone_number=excluded.phone_number,
    mobile_number=excluded.mobile_number,
    fax_number=excluded.fax_number,
    email=excluded.email,
    postal_code=excluded.postal_code,
    address_text=excluded.address_text,
    website_url=excluded.website_url,
    exchanged_by_last_name=excluded.exchanged_by_last_name,
    exchanged_by_first_name=excluded.exchanged_by_first_name,
    exchange_date=excluded.exchange_date,
    exchange_place=excluded.exchange_place,
    group_name=excluded.group_name,
    tags=excluded.tags,
    memo=excluded.memo,
    image_storage_provider=excluded.image_storage_provider,
    image_drive_file_id=excluded.image_drive_file_id,
    image_url=excluded.image_url,
    original_image_drive_file_id=excluded.original_image_drive_file_id,
    original_image_url=excluded.original_image_url,
    cropped_image_drive_file_id=excluded.cropped_image_drive_file_id,
    cropped_image_url=excluded.cropped_image_url,
    image_file_name=excluded.image_file_name,
    image_mime_type=excluded.image_mime_type,
    image_size_bytes=excluded.image_size_bytes,
    image_width=excluded.image_width,
    image_height=excluded.image_height,
    image_folder_id=excluded.image_folder_id,
    image_quality_score=excluded.image_quality_score,
    brightness_status=excluded.brightness_status,
    blur_status=excluded.blur_status,
    frame_status=excluded.frame_status,
    skew_status=excluded.skew_status,
    contour_status=excluded.contour_status,
    retake_required=excluded.retake_required,
    retake_reason=excluded.retake_reason,
    quality_warnings=excluded.quality_warnings,
    crop_box=excluded.crop_box,
    ocr_text=excluded.ocr_text,
    ocr_status=excluded.ocr_status,
    ocr_language=excluded.ocr_language,
    ocr_processed_at=excluded.ocr_processed_at,
    ocr_engine=excluded.ocr_engine,
    ocr_error_message=excluded.ocr_error_message,
    ocr_source_image_type=excluded.ocr_source_image_type,
    search_key=excluded.search_key,
    search_text=excluded.search_text,
    name_sort_key=excluded.name_sort_key,
    company_sort_key=excluded.company_sort_key,
    email_lower=excluded.email_lower,
    phone_digits=excluded.phone_digits,
    data_json=excluded.data_json`;
  await db.prepare(query).bind(
    record.recordId, record.recordStatus, Number(record.revision) || 1, record.createdAt, record.createdBy, record.updatedAt, record.updatedBy, record.deletedAt, record.deletedBy, record.companyName, record.companyNameKana, record.lastName, record.firstName, record.lastNameKana, record.firstNameKana, record.departmentName, record.title, record.phoneNumber, record.mobileNumber, record.faxNumber, record.email, record.postalCode, record.addressText, record.websiteUrl, record.exchangedByLastName, record.exchangedByFirstName, record.exchangeDate, record.exchangePlace, record.groupName, JSON.stringify(record.tags || []), record.memo, record.imageStorageProvider, record.imageDriveFileId, record.imageUrl, record.originalImageDriveFileId, record.originalImageUrl, record.croppedImageDriveFileId, record.croppedImageUrl, record.imageFileName, record.imageMimeType, record.imageSizeBytes, record.imageWidth, record.imageHeight, record.imageFolderId, record.imageQualityScore, record.brightnessStatus, record.blurStatus, record.frameStatus, record.skewStatus, record.contourStatus, record.retakeRequired ? 'TRUE' : '', record.retakeReason, JSON.stringify(record.qualityWarnings || []), record.cropBox ? JSON.stringify(record.cropBox) : '', record.ocrText, record.ocrStatus, record.ocrLanguage, record.ocrProcessedAt, record.ocrEngine, record.ocrErrorMessage, record.ocrSourceImageType, record.searchKey, record.searchText, record.nameSortKey, record.companySortKey, record.emailLower, record.phoneDigits,
    JSON.stringify(record)
  ).run();
}
function rowToRecord(row: DbRow): CardStorageRecord {
  if (row.data_json && row.data_json !== '{}') { try { return normalizeRecord(JSON.parse(row.data_json) as Partial<CardStorageRecord>); } catch (_err) { } }
  return normalizeRecord({
    recordId: s(row.record_id),
    recordStatus: row.record_status === 'DELETED' ? 'DELETED' : (row.record_status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE'),
    revision: String(row.revision || 1),
    createdAt: s(row.created_at),
    createdBy: s(row.created_by),
    updatedAt: s(row.updated_at),
    updatedBy: s(row.updated_by),
    deletedAt: s(row.deleted_at),
    deletedBy: s(row.deleted_by),
    companyName: s(row.company_name),
    companyNameKana: s(row.company_name_kana),
    lastName: s(row.last_name),
    firstName: s(row.first_name),
    lastNameKana: s(row.last_name_kana),
    firstNameKana: s(row.first_name_kana),
    departmentName: s(row.department_name),
    title: s(row.title),
    phoneNumber: s(row.phone_number),
    mobileNumber: s(row.mobile_number),
    faxNumber: s(row.fax_number),
    email: s(row.email),
    postalCode: s(row.postal_code),
    addressText: s(row.address_text),
    websiteUrl: s(row.website_url),
    exchangedByLastName: s(row.exchanged_by_last_name),
    exchangedByFirstName: s(row.exchanged_by_first_name),
    exchangeDate: s(row.exchange_date),
    exchangePlace: s(row.exchange_place),
    groupName: s(row.group_name),
    tags: parseStringArray(row.tags || ''),
    memo: s(row.memo),
    imageStorageProvider: s(row.image_storage_provider),
    imageDriveFileId: s(row.image_drive_file_id),
    imageUrl: s(row.image_url),
    originalImageDriveFileId: s(row.original_image_drive_file_id),
    originalImageUrl: s(row.original_image_url),
    croppedImageDriveFileId: s(row.cropped_image_drive_file_id),
    croppedImageUrl: s(row.cropped_image_url),
    imageFileName: s(row.image_file_name),
    imageMimeType: s(row.image_mime_type),
    imageSizeBytes: s(row.image_size_bytes),
    imageWidth: s(row.image_width),
    imageHeight: s(row.image_height),
    imageFolderId: s(row.image_folder_id),
    imageQualityScore: s(row.image_quality_score),
    brightnessStatus: s(row.brightness_status),
    blurStatus: s(row.blur_status),
    frameStatus: s(row.frame_status),
    skewStatus: s(row.skew_status),
    contourStatus: s(row.contour_status),
    retakeRequired: String(row.retake_required || '').toUpperCase() === 'TRUE',
    retakeReason: s(row.retake_reason),
    qualityWarnings: parseStringArray(row.quality_warnings || ''),
    cropBox: parseCropBox(row.crop_box || ''),
    ocrText: s(row.ocr_text),
    ocrStatus: s(row.ocr_status),
    ocrLanguage: s(row.ocr_language),
    ocrProcessedAt: s(row.ocr_processed_at),
    ocrEngine: s(row.ocr_engine),
    ocrErrorMessage: s(row.ocr_error_message),
    ocrSourceImageType: s(row.ocr_source_image_type),
    searchKey: s(row.search_key),
    searchText: s(row.search_text),
    nameSortKey: s(row.name_sort_key),
    companySortKey: s(row.company_sort_key),
    emailLower: s(row.email_lower),
    phoneDigits: s(row.phone_digits),
  });
}
function normalizeRecord(value: Partial<CardStorageRecord>): CardStorageRecord {
  const record: CardStorageRecord = {
    recordId: s(value.recordId),
    recordStatus: value.recordStatus === 'DELETED' ? 'DELETED' : (value.recordStatus === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE'),
    revision: s(value.revision) || '1',
    createdAt: s(value.createdAt),
    createdBy: s(value.createdBy),
    updatedAt: s(value.updatedAt),
    updatedBy: s(value.updatedBy),
    deletedAt: s(value.deletedAt),
    deletedBy: s(value.deletedBy),
    companyName: s(value.companyName),
    companyNameKana: s(value.companyNameKana),
    lastName: s(value.lastName),
    firstName: s(value.firstName),
    lastNameKana: s(value.lastNameKana),
    firstNameKana: s(value.firstNameKana),
    departmentName: s(value.departmentName),
    title: s(value.title),
    phoneNumber: s(value.phoneNumber),
    mobileNumber: s(value.mobileNumber),
    faxNumber: s(value.faxNumber),
    email: s(value.email),
    postalCode: s(value.postalCode),
    addressText: s(value.addressText),
    websiteUrl: s(value.websiteUrl),
    exchangedByLastName: s(value.exchangedByLastName),
    exchangedByFirstName: s(value.exchangedByFirstName),
    exchangeDate: s(value.exchangeDate),
    exchangePlace: s(value.exchangePlace),
    groupName: s(value.groupName),
    tags: Array.isArray(value.tags) ? value.tags.map(s).filter(Boolean) : splitTags(value.tags as unknown as string),
    memo: s(value.memo),
    imageStorageProvider: s(value.imageStorageProvider),
    imageDriveFileId: s(value.imageDriveFileId),
    imageUrl: s(value.imageUrl),
    originalImageDriveFileId: s(value.originalImageDriveFileId),
    originalImageUrl: s(value.originalImageUrl),
    croppedImageDriveFileId: s(value.croppedImageDriveFileId),
    croppedImageUrl: s(value.croppedImageUrl),
    imageFileName: s(value.imageFileName),
    imageMimeType: s(value.imageMimeType),
    imageSizeBytes: s(value.imageSizeBytes),
    imageWidth: s(value.imageWidth),
    imageHeight: s(value.imageHeight),
    imageFolderId: s(value.imageFolderId),
    imageQualityScore: s(value.imageQualityScore),
    brightnessStatus: s(value.brightnessStatus),
    blurStatus: s(value.blurStatus),
    frameStatus: s(value.frameStatus),
    skewStatus: s(value.skewStatus),
    contourStatus: s(value.contourStatus),
    retakeRequired: value.retakeRequired === true,
    retakeReason: s(value.retakeReason),
    qualityWarnings: Array.isArray(value.qualityWarnings) ? value.qualityWarnings.map(s).filter(Boolean) : splitTags(value.qualityWarnings as unknown as string),
    cropBox: value.cropBox || null,
    ocrText: s(value.ocrText),
    ocrStatus: s(value.ocrStatus),
    ocrLanguage: s(value.ocrLanguage),
    ocrProcessedAt: s(value.ocrProcessedAt),
    ocrEngine: s(value.ocrEngine),
    ocrErrorMessage: s(value.ocrErrorMessage),
    ocrSourceImageType: s(value.ocrSourceImageType),
    searchKey: s(value.searchKey),
    searchText: s(value.searchText),
    nameSortKey: s(value.nameSortKey),
    companySortKey: s(value.companySortKey),
    emailLower: s(value.emailLower),
    phoneDigits: s(value.phoneDigits),
  };
  finalizeSearchFields(record);
  return record;
}
function normalizePartialRecord(value: Partial<CardStorageRecord>): Partial<CardStorageRecord> {
  const copy = { ...value };
  if (value.tags !== undefined) copy.tags = Array.isArray(value.tags) ? value.tags.map(s).filter(Boolean) : splitTags(value.tags as unknown as string);
  if (value.qualityWarnings !== undefined) copy.qualityWarnings = Array.isArray(value.qualityWarnings) ? value.qualityWarnings.map(s).filter(Boolean) : splitTags(value.qualityWarnings as unknown as string);
  return copy;
}
function finalizeSearchFields(record: CardStorageRecord): void {
  record.searchText = record.searchText || buildSearchText(record);
  record.searchKey = record.searchKey || record.searchText;
  record.nameSortKey = record.nameSortKey || normalizeText([record.lastName, record.firstName].filter(Boolean).join(' ') || [record.lastNameKana, record.firstNameKana].filter(Boolean).join(' '));
  record.companySortKey = record.companySortKey || normalizeText(record.companyNameKana || record.companyName);
  record.emailLower = record.emailLower || record.email.toLowerCase();
  record.phoneDigits = record.phoneDigits || s(`${record.phoneNumber} ${record.mobileNumber} ${record.faxNumber}`).replace(/\D+/g, '');
}
function buildSearchText(record: Partial<CardStorageRecord>): string { return normalizeText([record.companyName, record.companyNameKana, record.lastName, record.firstName, record.lastNameKana, record.firstNameKana, record.departmentName, record.title, record.phoneNumber, record.mobileNumber, record.faxNumber, record.email, record.postalCode, record.addressText, record.websiteUrl, record.exchangedByLastName, record.exchangedByFirstName, record.exchangeDate, record.exchangePlace, record.groupName, record.tags, record.memo, record.imageStorageProvider, record.originalImageUrl, record.croppedImageUrl, record.imageFileName, record.imageMimeType, record.imageSizeBytes, record.imageWidth, record.imageHeight, record.imageFolderId, record.imageQualityScore, record.brightnessStatus, record.blurStatus, record.frameStatus, record.skewStatus, record.contourStatus, record.retakeRequired, record.retakeReason, record.qualityWarnings, record.cropBox, record.ocrText, record.ocrStatus, record.ocrLanguage, record.ocrProcessedAt, record.ocrEngine, record.ocrErrorMessage, record.ocrSourceImageType].map((value) => Array.isArray(value) ? value.join(' ') : String(value || '')).join(' ')); }
function parseStringArray(value: string): string[] { try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed.map(s).filter(Boolean); } catch (_err) { } return splitTags(value); }
function parseCropBox(value: string): CardCropBox | null { try { const parsed = JSON.parse(value) as Partial<CardCropBox>; return { x: Number(parsed.x) || 0, y: Number(parsed.y) || 0, width: Number(parsed.width) || 0, height: Number(parsed.height) || 0, rotate: Number(parsed.rotate) || 0 }; } catch (_err) { return null; } }
function splitTags(value: string): string[] { return s(value).split(/[、,\n]/).map((x) => x.trim()).filter(Boolean); }
function normalizeText(value: unknown): string { return s(value).toLowerCase().replace(/[　\s]+/g, ' ').trim(); }
function s(value: unknown): string { return String(value ?? '').trim(); }
function checkConflict(current: CardStorageRecord, expectedUpdatedAt: string, expectedRevision: string): string { if (expectedUpdatedAt && expectedUpdatedAt !== current.updatedAt) return '他の利用者により更新されています。検索結果を再読み込みしてから操作してください。'; if (expectedRevision && expectedRevision !== current.revision) return '他の利用者により更新されています。検索結果を再読み込みしてから操作してください。'; return ''; }
function ok(req: StorageJsonRequest, data: NonNullable<StorageJsonResponse['data']>, message = ''): StorageJsonResponse { return { ok: true, apiVersion: API_VERSION, operation: req.operation, requestId: req.requestId, data, message }; }
function error(req: Partial<StorageJsonRequest>, code: string, message: string): StorageJsonResponse { return { ok: false, apiVersion: API_VERSION, operation: req.operation || 'card.diagnostics', requestId: req.requestId || '', error: { code, message }, message }; }
function statusForError(code?: string): number { if (code === 'UNAUTHORIZED') return 401; if (code === 'NOT_FOUND') return 404; if (code === 'CONFLICT') return 409; if (code === 'VALIDATION_ERROR' || code === 'BAD_REQUEST') return 400; return 500; }
function loginPage(env: Env): Response {
  const gasUrl = String(env.GAS_WEB_APP_URL || DEFAULT_GAS_WEB_APP_URL).trim() || DEFAULT_GAS_WEB_APP_URL;
  const safeGasUrl = escapeHtmlAttr(gasUrl);
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>名刺管理ログイン</title>
  <style>
    :root { color-scheme: light; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f4f6fb; color: #111827; }
    .page { min-height: 100vh; display: flex; align-items: flex-start; justify-content: center; padding: 72px 16px; box-sizing: border-box; }
    .card { width: min(760px, 100%); background: #fff; border-radius: 16px; box-shadow: 0 18px 50px rgba(15, 23, 42, .10); padding: 32px; box-sizing: border-box; }
    h1 { margin: 0 0 28px; font-size: 28px; line-height: 1.3; }
    form { display: grid; grid-template-columns: auto minmax(240px, 1fr) auto; gap: 12px; align-items: center; }
    label { font-weight: 700; white-space: nowrap; }
    input { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 14px; font-size: 16px; }
    button { border: 0; border-radius: 10px; background: #2563eb; color: #fff; padding: 12px 28px; font-weight: 700; font-size: 16px; cursor: pointer; }
    button:hover { background: #1d4ed8; }
    .note { margin-top: 18px; color: #64748b; font-size: 13px; line-height: 1.7; }
    @media (max-width: 640px) {
      .page { padding-top: 40px; }
      .card { padding: 24px; }
      form { grid-template-columns: 1fr; }
      button { width: 100%; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="card" aria-labelledby="title">
      <h1 id="title">名刺管理ログイン</h1>
      <form method="get" action="${safeGasUrl}">
        <label for="authuser">Googleアカウント</label>
        <input id="authuser" name="authuser" type="email" inputmode="email" autocomplete="username" placeholder="name@nextbrain.pro" pattern="^[^@\\s]+@(nextbrain\\.pro|nextbrain\\.biz)$" required>
        <button type="submit">ログイン</button>
      </form>
      <div class="note">許可ドメイン: nextbrain.pro / nextbrain.biz<br>画面表示とGoogleログインセッションはGAS側で行います。</div>
    </section>
  </main>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function json(body: unknown, status = 200): Response { return cors(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })); }
interface AuthInspection { authorized: boolean; expectedConfigured: boolean; expectedLength: number; apiKeyHeaderPresent: boolean; receivedKeyLength: number; }
function inspectApiKey(request: Request, env: Env): AuthInspection { const expected = String(env.BUSINESS_CARD_API_KEY || '').trim(); const receivedApiKey = String(request.headers.get('X-API-Key') || '').trim(); return { authorized: Boolean(expected) && receivedApiKey === expected, expectedConfigured: Boolean(expected), expectedLength: expected.length, apiKeyHeaderPresent: Boolean(receivedApiKey), receivedKeyLength: receivedApiKey.length }; }
function unauthorizedResponse(auth: AuthInspection): StorageJsonResponse { const message = 'unauthorized: X-API-Key が未設定または一致しません。'; return { ok: false, apiVersion: API_VERSION, operation: 'card.diagnostics', requestId: '', error: { code: 'UNAUTHORIZED', message, details: [{ field: 'X-API-Key', reason: auth.apiKeyHeaderPresent ? 'header_present' : 'header_missing' }, { field: 'BUSINESS_CARD_API_KEY', reason: auth.expectedConfigured ? 'worker_api_key_configured' : 'worker_api_key_missing' }] }, data: { diagnostics: { requiredHeader: 'X-API-Key', apiKeyHeaderPresent: auth.apiKeyHeaderPresent, workerApiKeyConfigured: auth.expectedConfigured, receivedKeyLength: auth.receivedKeyLength, expectedKeyLength: auth.expectedLength } }, message }; }
function cors(response: Response, status?: number): Response { const headers = new Headers(response.headers); headers.set('Access-Control-Allow-Origin', '*'); headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS'); headers.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key'); return new Response(response.body, { status: status ?? response.status, headers }); }
