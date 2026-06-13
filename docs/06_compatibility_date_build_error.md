# compatibility_date による build error 対応

## 発生したエラー

Cloudflare の build log で以下が発生した。

```text
Can't set compatibility date in the future: 2026-06-14
```

## 原因

`wrangler.json` の `compatibility_date` に `2026-06-14` を指定していたが、Cloudflare のビルド環境ではUTC基準で `2026-06-13` と判定され、未来日の compatibility date として拒否された。

## 修正

`wrangler.json` と `wrangler.with-bindings.example.json` の `compatibility_date` を以下へ変更した。

```json
"compatibility_date": "2025-12-01"
```

## 運用ルール

- `compatibility_date` には当日・翌日・未来日を指定しない。
- 日本時間とUTCの差で未来日扱いになる可能性があるため、Cloudflareへdeployする日より十分前の日付を指定する。
- Wrangler更新後に互換性フラグを見直す場合のみ、別途検証して日付を更新する。
