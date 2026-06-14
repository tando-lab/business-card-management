-- Storage JSON Protocol v1 用のD1スキーマです。
-- 既存の r46 business_cards と共存しやすいように旧主要列も保持し、正準レコード全体は data_json に保存します。
CREATE TABLE IF NOT EXISTS business_cards (
  id TEXT PRIMARY KEY,
  record_status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,

  company TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  kana TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  position TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  exchange_date TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  group_name TEXT NOT NULL DEFAULT '',
  memo TEXT NOT NULL DEFAULT '',

  image_url TEXT NOT NULL DEFAULT '',
  image_file_id TEXT NOT NULL DEFAULT '',
  original_image_url TEXT NOT NULL DEFAULT '',
  original_image_file_id TEXT NOT NULL DEFAULT '',
  cropped_image_url TEXT NOT NULL DEFAULT '',
  cropped_image_file_id TEXT NOT NULL DEFAULT '',

  quality_score TEXT NOT NULL DEFAULT '',
  retake_decision TEXT NOT NULL DEFAULT '',
  ocr_text TEXT NOT NULL DEFAULT '',
  ocr_status TEXT NOT NULL DEFAULT '',
  ocr_language TEXT NOT NULL DEFAULT 'ja',
  ocr_at TEXT NOT NULL DEFAULT '',

  registered_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  deleted_at TEXT NOT NULL DEFAULT '',
  deleted_by TEXT NOT NULL DEFAULT '',
  search_key TEXT NOT NULL DEFAULT '',
  search_text TEXT NOT NULL DEFAULT '',
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_business_cards_active_updated ON business_cards(record_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_cards_search_key ON business_cards(search_key);
CREATE INDEX IF NOT EXISTS idx_business_cards_search_text ON business_cards(search_text);
