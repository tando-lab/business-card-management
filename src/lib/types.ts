export interface AppEnv {
  ASSETS?: Fetcher;
  DB?: D1Database;
  CARD_IMAGES?: R2Bucket;
  APP_TITLE?: string;
  ALLOWED_EMAIL_DOMAINS?: string;
  ALLOWED_ORIGINS?: string;
  ALLOW_DEV_USER_HEADER?: string;
  MAX_SEARCH_RESULTS?: string;
  IMAGE_MAX_BYTES?: string;
  OCR_API_URL?: string;
  OCR_API_TOKEN?: string;
}

export interface AuthUser {
  email: string;
  authenticated: boolean;
  allowed: boolean;
}

export interface CardImage {
  base64: string;
  mimeType: string;
  originalName: string;
}

export interface ImageQuality {
  score: number;
  brightnessStatus: string;
  blurStatus: string;
  framingStatus: string;
  tiltStatus: string;
  contourStatus: string;
  retakeDecision: string;
  cropPointsJson: string;
}

export interface CardPayload {
  id: string;
  expectedUpdatedAt: string;
  expectedRevision: string;
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
  ocrText: string;
  ocrStatus: string;
  ocrLanguage: string;
  ocrAt: string;
  registeredBy: string;
  updatedBy: string;
  image: CardImage;
  originalImage: CardImage;
  croppedImage: CardImage;
  imageQuality: ImageQuality;
}

export interface RawCardPayload {
  [key: string]: unknown;
  image?: Partial<CardImage> | null;
  originalImage?: Partial<CardImage> | null;
  croppedImage?: Partial<CardImage> | null;
  imageQuality?: Partial<Record<keyof ImageQuality, unknown>> | null;
}

export interface ImageRefs {
  imageUrl: string;
  imageFileId: string;
  originalImageUrl: string;
  originalImageFileId: string;
  croppedImageUrl: string;
  croppedImageFileId: string;
}

export interface SearchCriteria {
  keyword?: string;
  owner?: string;
  tag?: string;
  limit?: number;
}

export interface BusinessCardRow {
  id: string;
  record_status: string;
  created_at: string;
  updated_at: string;
  revision: number;
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
  exchange_date: string;
  tags: string;
  group_name: string;
  memo: string;
  image_url: string;
  image_file_id: string;
  original_image_url: string;
  original_image_file_id: string;
  cropped_image_url: string;
  cropped_image_file_id: string;
  quality_score: number;
  brightness_status: string;
  blur_status: string;
  framing_status: string;
  tilt_status: string;
  contour_status: string;
  retake_decision: string;
  crop_points_json: string;
  ocr_text: string;
  ocr_status: string;
  ocr_language: string;
  ocr_at: string;
  registered_by: string;
  updated_by: string;
  delete_flag: string;
  deleted_at: string;
  deleted_by: string;
  search_key: string;
}

export interface CardRecord {
  id: string;
  registeredAt: string;
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
  imageFileId: string;
  originalImageUrl: string;
  croppedImageUrl: string;
  qualityScore: string;
  retakeDecision: string;
  ocrText: string;
  ocrStatus: string;
  registeredBy: string;
  updatedBy: string;
}

export type D1Value = string | number | null | ArrayBuffer | Uint8Array;
