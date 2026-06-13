-- business-card-cloudflare initial D1 schema, based on business-card-service r46 sheet_fields.json.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS business_cards (
  id TEXT PRIMARY KEY,
  record_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (record_status IN ('ACTIVE', 'DELETED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),

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

  quality_score REAL NOT NULL DEFAULT 0,
  brightness_status TEXT NOT NULL DEFAULT '',
  blur_status TEXT NOT NULL DEFAULT '',
  framing_status TEXT NOT NULL DEFAULT '',
  tilt_status TEXT NOT NULL DEFAULT '',
  contour_status TEXT NOT NULL DEFAULT '',
  retake_decision TEXT NOT NULL DEFAULT '',
  crop_points_json TEXT NOT NULL DEFAULT '',

  ocr_text TEXT NOT NULL DEFAULT '',
  ocr_status TEXT NOT NULL DEFAULT '',
  ocr_language TEXT NOT NULL DEFAULT 'ja',
  ocr_at TEXT NOT NULL DEFAULT '',

  registered_by TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT '',
  delete_flag TEXT NOT NULL DEFAULT '',
  deleted_at TEXT NOT NULL DEFAULT '',
  deleted_by TEXT NOT NULL DEFAULT '',
  search_key TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_business_cards_active_updated
  ON business_cards(record_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_cards_owner
  ON business_cards(owner);
CREATE INDEX IF NOT EXISTS idx_business_cards_tags
  ON business_cards(tags);
CREATE INDEX IF NOT EXISTS idx_business_cards_search_key
  ON business_cards(search_key);
