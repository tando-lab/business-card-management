import { HttpError, nowJstText } from './http';
import type {
  AppEnv,
  BusinessCardRow,
  CardImage,
  CardPayload,
  CardRecord,
  D1Value,
  ImageRefs,
  RawCardPayload,
  SearchCriteria
} from './types';

export const TEXT_FIELDS = [
  'company', 'name', 'kana', 'department', 'position', 'phone', 'email', 'address',
  'website', 'owner', 'exchangeDate', 'tags', 'group', 'memo'
] as const;

type TextField = typeof TEXT_FIELDS[number];

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ACTIVE = 'ACTIVE';
const DELETED = 'DELETED';

export interface MutationPrecondition {
  expectedUpdatedAt?: string;
  expectedRevision?: string;
}

export function normalizePayload(payload: RawCardPayload = {}, actor = ''): CardPayload {
  const rawQuality = payload.imageQuality || {};
  return {
    id: trim(payload.id),
    expectedUpdatedAt: trim(payload.expectedUpdatedAt),
    expectedRevision: trim(payload.expectedRevision),
    company: trim(payload.company),
    name: trim(payload.name),
    kana: trim(payload.kana),
    department: trim(payload.department),
    position: trim(payload.position),
    phone: trim(payload.phone),
    email: trim(payload.email),
    address: trim(payload.address),
    website: sanitizeHttpUrl(payload.website || payload.url) || trim(payload.website || payload.url),
    owner: trim(payload.owner),
    exchangeDate: trim(payload.exchangeDate),
    tags: trim(payload.tags),
    group: trim(payload.group),
    memo: trim(payload.memo),
    ocrText: trim(payload.ocrText).slice(0, 45000),
    ocrStatus: trim(payload.ocrStatus),
    ocrLanguage: trim(payload.ocrLanguage || 'ja'),
    ocrAt: trim(payload.ocrAt),
    registeredBy: trim(payload.registeredBy) || actor,
    updatedBy: trim(payload.updatedBy || payload.registeredBy) || actor,
    image: normalizeImage(payload.image || {}),
    originalImage: normalizeImage(payload.originalImage || {}),
    croppedImage: normalizeImage(payload.croppedImage || {}),
    imageQuality: {
      score: Number(trim(rawQuality.score)) || 0,
      brightnessStatus: trim(rawQuality.brightnessStatus),
      blurStatus: trim(rawQuality.blurStatus),
      framingStatus: trim(rawQuality.framingStatus),
      tiltStatus: trim(rawQuality.tiltStatus),
      contourStatus: trim(rawQuality.contourStatus),
      retakeDecision: trim(rawQuality.retakeDecision),
      cropPointsJson: trim(rawQuality.cropPointsJson)
    }
  };
}

export function validateCard(card: CardPayload): void {
  if (!card.company && !card.name) {
    throw new HttpError(400, 'VALIDATION_ERROR', '会社名または氏名のいずれかは必須です。', 'company');
  }
  if (card.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(card.email)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'メールアドレスの形式を確認してください。', 'email');
  }
  if (card.website && !/^https?:\/\//i.test(card.website)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'URLは http:// または https:// から入力してください。', 'website');
  }
  [card.image, card.originalImage, card.croppedImage].forEach(validateImage);
}

function validateImage(image: CardImage): void {
  if (!image.base64) return;
  if (!ALLOWED_MIME_TYPES.has(image.mimeType)) {
    throw new HttpError(400, 'VALIDATION_ERROR', '画像形式は JPEG / PNG / WebP のいずれかにしてください。');
  }
}

export async function createCard(env: AppEnv, payload: RawCardPayload, actor: string, source = 'cloudflare-ui') {
  const card = normalizePayload(payload, actor);
  validateCard(card);
  const now = nowJstText();
  const id = crypto.randomUUID();
  const imageRefs = await saveCardImages(env, card, id);
  const searchKey = buildSearchKey(card);

  await db(env).prepare(`
    INSERT INTO business_cards (
      id, record_status, created_at, updated_at, revision,
      company, name, kana, department, position, phone, email, address, website,
      owner, exchange_date, tags, group_name, memo,
      image_url, image_file_id, original_image_url, original_image_file_id, cropped_image_url, cropped_image_file_id,
      quality_score, brightness_status, blur_status, framing_status, tilt_status, contour_status, retake_decision, crop_points_json,
      ocr_text, ocr_status, ocr_language, ocr_at,
      registered_by, updated_by, delete_flag, deleted_at, deleted_by, search_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, ACTIVE, now, now, 1,
    card.company, card.name, card.kana, card.department, card.position, card.phone, card.email, card.address, card.website,
    card.owner, card.exchangeDate, card.tags, card.group, card.memo,
    imageRefs.imageUrl, imageRefs.imageFileId, imageRefs.originalImageUrl, imageRefs.originalImageFileId, imageRefs.croppedImageUrl, imageRefs.croppedImageFileId,
    card.imageQuality.score, card.imageQuality.brightnessStatus, card.imageQuality.blurStatus, card.imageQuality.framingStatus,
    card.imageQuality.tiltStatus, card.imageQuality.contourStatus, card.imageQuality.retakeDecision, card.imageQuality.cropPointsJson,
    card.ocrText, card.ocrStatus, card.ocrLanguage, card.ocrAt,
    card.registeredBy || actor || source, card.updatedBy || actor || source, '', '', '', searchKey
  ).run();

  return {
    ok: true,
    message: '登録しました。',
    id,
    updatedAt: now,
    revision: '1',
    ...imageRefs,
    qualityScore: card.imageQuality.score || ''
  };
}

export async function updateCard(env: AppEnv, id: string, payload: RawCardPayload, actor: string) {
  const current = await getActiveRow(env, id);
  assertMutationPrecondition(current, payload.expectedUpdatedAt, payload.expectedRevision);

  const card = normalizePayload({ ...payload, id }, actor);
  validateCard(card);
  const now = nowJstText();
  const nextRevision = Number(current.revision || 0) + 1;
  const searchKey = buildSearchKey(card);

  await db(env).prepare(`
    UPDATE business_cards SET
      record_status = ?, updated_at = ?, revision = ?,
      company = ?, name = ?, kana = ?, department = ?, position = ?, phone = ?, email = ?, address = ?, website = ?,
      owner = ?, exchange_date = ?, tags = ?, group_name = ?, memo = ?,
      quality_score = ?, brightness_status = ?, blur_status = ?, framing_status = ?, tilt_status = ?, contour_status = ?, retake_decision = ?, crop_points_json = ?,
      ocr_text = ?, ocr_status = ?, ocr_language = ?, ocr_at = ?,
      updated_by = ?, delete_flag = '', deleted_at = '', deleted_by = '', search_key = ?
    WHERE id = ? AND record_status = ?
  `).bind(
    ACTIVE, now, nextRevision,
    card.company, card.name, card.kana, card.department, card.position, card.phone, card.email, card.address, card.website,
    card.owner, card.exchangeDate, card.tags, card.group, card.memo,
    card.imageQuality.score, card.imageQuality.brightnessStatus, card.imageQuality.blurStatus, card.imageQuality.framingStatus,
    card.imageQuality.tiltStatus, card.imageQuality.contourStatus, card.imageQuality.retakeDecision, card.imageQuality.cropPointsJson,
    card.ocrText, card.ocrStatus, card.ocrLanguage, card.ocrAt,
    card.updatedBy || actor, searchKey, id, ACTIVE
  ).run();

  return { ok: true, id, message: '更新しました。', updatedAt: now, revision: String(nextRevision) };
}

export async function deleteCard(env: AppEnv, id: string, expected: MutationPrecondition, actor: string) {
  const current = await getActiveRow(env, id);
  assertMutationPrecondition(current, expected.expectedUpdatedAt, expected.expectedRevision);
  const now = nowJstText();
  const nextRevision = Number(current.revision || 0) + 1;
  await db(env).prepare(`
    UPDATE business_cards SET
      record_status = ?, updated_at = ?, revision = ?, updated_by = ?, delete_flag = 'TRUE', deleted_at = ?, deleted_by = ?
    WHERE id = ? AND record_status = ?
  `).bind(DELETED, now, nextRevision, actor, now, actor, id, ACTIVE).run();
  return { ok: true, id, message: '削除しました。', updatedAt: now, revision: String(nextRevision) };
}

export async function searchCards(env: AppEnv, criteria: SearchCriteria = {}) {
  const keyword = normalizeText(criteria.keyword || '');
  const owner = normalizeText(criteria.owner || '');
  const tag = normalizeText(criteria.tag || '');
  const limit = clamp(Number(criteria.limit || env.MAX_SEARCH_RESULTS || 100), 1, 500);
  const conditions = ['record_status = ?'];
  const binds: D1Value[] = [ACTIVE];

  if (keyword) {
    conditions.push("search_key LIKE ? ESCAPE '\\'");
    binds.push(`%${escapeLike(keyword)}%`);
  }
  if (owner) {
    conditions.push("lower(owner) LIKE ? ESCAPE '\\'");
    binds.push(`%${escapeLike(owner)}%`);
  }
  if (tag) {
    conditions.push("lower(tags) LIKE ? ESCAPE '\\'");
    binds.push(`%${escapeLike(tag)}%`);
  }
  binds.push(limit);

  const result = await db(env).prepare(`
    SELECT * FROM business_cards
    WHERE ${conditions.join(' AND ')}
    ORDER BY updated_at DESC, created_at DESC
    LIMIT ?
  `).bind(...binds).all<BusinessCardRow>();

  return { ok: true, records: (result.results || []).map(rowToRecord) };
}

async function getActiveRow(env: AppEnv, id: string): Promise<BusinessCardRow> {
  const row = await db(env)
    .prepare('SELECT * FROM business_cards WHERE id = ? AND record_status = ?')
    .bind(id, ACTIVE)
    .first<BusinessCardRow>();
  if (!row) throw new HttpError(404, 'NOT_FOUND', '対象の名刺が見つかりません。');
  return row;
}

function assertMutationPrecondition(row: BusinessCardRow, expectedUpdatedAt?: unknown, expectedRevision?: unknown): void {
  const expectedAt = trim(expectedUpdatedAt);
  const expectedRev = trim(expectedRevision);
  if (expectedAt && expectedAt !== row.updated_at) {
    throw new HttpError(409, 'CONFLICT', '他の利用者により更新されています。検索結果を再読み込みしてから操作してください。');
  }
  if (expectedRev && expectedRev !== String(row.revision)) {
    throw new HttpError(409, 'CONFLICT', '他の利用者により更新されています。検索結果を再読み込みしてから操作してください。');
  }
}

async function saveCardImages(env: AppEnv, card: CardPayload, id: string): Promise<ImageRefs> {
  const refs = emptyImageRefs();
  if (!env.CARD_IMAGES) return refs;

  if (card.originalImage.base64) {
    const saved = await putImage(env, card.originalImage, id, 'original');
    refs.originalImageUrl = saved.url;
    refs.originalImageFileId = saved.key;
  }
  if (card.croppedImage.base64) {
    const saved = await putImage(env, card.croppedImage, id, 'cropped');
    refs.croppedImageUrl = saved.url;
    refs.croppedImageFileId = saved.key;
  }
  if (!refs.originalImageUrl && !refs.croppedImageUrl && card.image.base64) {
    const saved = await putImage(env, card.image, id, 'image');
    refs.imageUrl = saved.url;
    refs.imageFileId = saved.key;
  } else {
    refs.imageUrl = refs.croppedImageUrl || refs.originalImageUrl;
    refs.imageFileId = refs.croppedImageFileId || refs.originalImageFileId;
  }
  return refs;
}

async function putImage(env: AppEnv, image: CardImage, id: string, role: string): Promise<{ key: string; url: string }> {
  const bucket = env.CARD_IMAGES;
  if (!bucket) throw new HttpError(500, 'CONFIG_ERROR', 'R2 binding CARD_IMAGES が未設定です。');
  const mime = image.mimeType || 'image/jpeg';
  const bytes = base64ToBytes(image.base64);
  const maxBytes = Number(env.IMAGE_MAX_BYTES || 8388608);
  if (bytes.byteLength > maxBytes) {
    throw new HttpError(400, 'VALIDATION_ERROR', '画像サイズが大きすぎます。画像を小さくして再度お試しください。');
  }
  const ext = mimeToExtension(mime);
  const key = `${id}_${role}_${Date.now()}.${ext}`;
  await bucket.put(key, bytes, { httpMetadata: { contentType: mime } });
  return { key, url: `/api/images/${encodeURIComponent(key)}` };
}

export function base64ToBytes(base64: string): Uint8Array {
  const clean = String(base64 || '').replace(/^data:[^;]+;base64,/, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function normalizeImage(image: Partial<CardImage>): CardImage {
  return {
    base64: trim(image.base64),
    mimeType: trim(image.mimeType),
    originalName: trim(image.originalName)
  };
}

function emptyImageRefs(): ImageRefs {
  return {
    imageUrl: '',
    imageFileId: '',
    originalImageUrl: '',
    originalImageFileId: '',
    croppedImageUrl: '',
    croppedImageFileId: ''
  };
}

function rowToRecord(row: BusinessCardRow): CardRecord {
  return {
    id: row.id || '',
    registeredAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    revision: String(row.revision || ''),
    company: row.company || '',
    name: row.name || '',
    kana: row.kana || '',
    department: row.department || '',
    position: row.position || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    website: row.website || '',
    owner: row.owner || '',
    exchangeDate: row.exchange_date || '',
    tags: row.tags || '',
    group: row.group_name || '',
    memo: row.memo || '',
    imageUrl: row.image_url || '',
    imageFileId: row.image_file_id || '',
    originalImageUrl: row.original_image_url || '',
    croppedImageUrl: row.cropped_image_url || '',
    qualityScore: String(row.quality_score || ''),
    retakeDecision: row.retake_decision || '',
    ocrText: row.ocr_text || '',
    ocrStatus: row.ocr_status || '',
    registeredBy: row.registered_by || '',
    updatedBy: row.updated_by || ''
  };
}

export function buildSearchKey(card: CardPayload): string {
  return normalizeText(TEXT_FIELDS.map((field: TextField) => card[field] || '').concat(card.ocrText || '').join(' '));
}

function trim(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function sanitizeHttpUrl(value: unknown): string {
  const text = trim(value);
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(text)) return `https://${text}`;
  return '';
}

function normalizeText(value: unknown): string {
  return trim(value).toLowerCase().normalize('NFKC').replace(/\s+/g, ' ');
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function mimeToExtension(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}


function db(env: AppEnv): D1Database {
  if (!env.DB) throw new HttpError(500, 'CONFIG_ERROR', 'D1 binding DB が未設定です。');
  return env.DB;
}
