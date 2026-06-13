# Cloudflare最小構成設計

## 採用構成

```text
Cloudflare Pages
  public/index.html        登録・検索UI
  public/launcher.html     ログインランチャー

Cloudflare Pages Functions
  /api/initial             初期表示データ
  /api/cards               検索・登録
  /api/cards/:id           更新・論理削除
  /api/images/:key         R2画像取得
  /api/ocr                 Apps Script OCR APIプロキシ

Cloudflare D1
  business_cards           名刺台帳

Cloudflare R2
  business-card-images     名刺画像

Apps Script
  OCR JSON API             当面残置
```

## API一覧

| Method | Path | 内容 |
|---|---|---|
| GET | `/api/initial` | アプリ名、ユーザー、日付、メタデータ |
| GET | `/api/cards?keyword=&owner=&tag=` | 名刺検索 |
| POST | `/api/cards` | 名刺登録 |
| PUT/PATCH | `/api/cards/:id` | 名刺更新 |
| DELETE | `/api/cards/:id` | 名刺論理削除 |
| GET | `/api/images/:key` | R2画像取得 |
| POST | `/api/ocr` | Apps Script OCR APIプロキシ |

## データモデル

D1の `business_cards` は r46 の `sheet_fields.json` を元に、SpreadsheetヘッダーではなくSQL向けsnake_case列へ変換しています。

主な対応は以下です。

| r46 fieldId | D1列 |
|---|---|
| `recordStatus` | `record_status` |
| `createdAt` | `created_at` |
| `updatedAt` | `updated_at` |
| `exchangeDate` | `exchange_date` |
| `group` | `group_name` |
| `qualityScore` | `quality_score` |
| `ocrText` | `ocr_text` |
| `searchKey` | `search_key` |

## 認証・認可

Cloudflare AccessでGoogle認証をかけ、許可ドメインを以下に限定します。

```text
nextbrain.pro
nextbrain.biz
```

Functionsは `Cf-Access-Authenticated-User-Email` を読み取り、`ALLOWED_EMAIL_DOMAINS` と照合します。未認証でも初期検証は可能ですが、本番ではAccess側の保護を必須とします。

## OCR連携

`/api/ocr` は画像payloadをApps Script OCR APIへPOSTし、JSON応答をそのままUIへ返します。

```text
Browser
  -> Cloudflare /api/ocr
      -> Apps Script OCR API
          -> Google Drive API / Docs OCR
      <- OCR JSON
  <- OCR JSON
```

この方式により、ユーザーはApps Script URLを直接開かないため、`/macros/u/N/s/...` 表示問題の影響を受けにくくなります。

## 今回の初期版で割り切った点

- UIはr46の完全移植ではなく、CRUD疎通用の最小UIです。
- 画像切り抜きは未実装です。選択画像を `originalImage` として保存します。
- 品質判定は仮値です。r46の `Client_Quality*` は次段階で移植します。
- D1検索は `LIKE` ベースです。件数増加後はFTS5等の検討余地があります。
