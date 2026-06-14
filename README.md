# business-card-cloudflare-d1-api

Storage JSON Protocol v1 (`bc-storage.v1`) を受け取り、Cloudflare D1 の `business_cards` を操作するAPI専用Workerです。

## エンドポイント

```text
POST /api/storage
GET  /api/health
```

`POST /api/storage` は `Authorization: Bearer` ヘッダー必須です。

```text
Authorization: Bearer <BUSINESS_CARD_API_TOKEN>
```

## 設定

`wrangler.json` の `database_id` をCloudflare画面のD1 database idに置換してください。

```json
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "business-card-management-db",
    "database_id": "..."
  }
]
```

名刺管理D1 API用の共有トークンは、Worker secretとして設定します。Cloudflare管理API用トークンとは別物です。

```bash
npx wrangler secret put BUSINESS_CARD_API_TOKEN
```

## D1 migration

新規作成の場合:

```bash
npx wrangler d1 migrations apply business-card-management-db --remote
```

既存r46の `business_cards` がある場合は、必要に応じて `migrations/0002_add_protocol_json_columns_to_r46.sql` のSQLをD1コンソールで1行ずつ実行してください。

## デプロイ

```bash
npm install
npm run check
npx wrangler deploy
```

## GAS側設定例

GAS `Script Properties`:

```text
STORAGE_BACKEND=cloudflare_d1
CLOUDFLARE_API_BASE_URL=https://<worker-name>.<account>.workers.dev
CLOUDFLARE_D1_API_TOKEN=<BUSINESS_CARD_API_TOKEN>
```
