-- r46版の business_cards を既に作成済みの場合だけ、必要に応じて1行ずつ実行してください。
-- D1/SQLiteの ALTER TABLE ADD COLUMN は同名列があるとエラーになるため、自動一括適用ではなく手動確認用です。
ALTER TABLE business_cards ADD COLUMN search_text TEXT NOT NULL DEFAULT '';
ALTER TABLE business_cards ADD COLUMN data_json TEXT NOT NULL DEFAULT '{}';
