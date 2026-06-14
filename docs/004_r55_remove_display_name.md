# r55 display_name削除

## 概要

r55では、GAS側の正準項目変更に合わせて、Cloudflare D1 API側の `business_cards` テーブルから `display_name` 列を削除した。

## 変更点

- `CardStorageRecord.displayName` を削除
- `DbRow.display_name` を削除
- `migrations/0001_init.sql` から `display_name` 列を削除
- INSERT/UPSERT対象列から `display_name` を削除
- `data_json` にも `displayName` を含めない
- `name_sort_key` は `lastName + firstName`、または `lastNameKana + firstNameKana` から生成
- 検索テキストは `lastName`、`firstName`、`lastNameKana`、`firstNameKana` を利用

## 注意事項

`0001_init.sql` は `DROP TABLE IF EXISTS business_cards` を含むため、既存データを保持する場合は事前退避が必要。
