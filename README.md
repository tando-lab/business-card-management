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

`wrangler.json` には、今回のCloudflare buildログで確認できたD1 database idを設定済みです。D1を作り直した場合だけ置換してください。

```json
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "business-card-management-db",
    "database_id": "f0f4b0db-c142-4d62-a4fb-c97eccb335a3"
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

## r49: Cloudflare build の npm clean-install 対策

Cloudflare build で `npm clean-install --progress=false` が長時間経過後に `Exit handler never called!` で失敗する場合、`package-lock.json` の `resolved` URL が内部レジストリを指していないか確認してください。

r49では `package-lock.json` の `resolved` URL を `https://registry.npmjs.org/` に統一し、`.npmrc` でも public npm registry を明示しています。


## r50: D1 database_id placeholder 修正

Cloudflare build で次のエラーが出る場合、`wrangler.json` の `d1_databases[].database_id` がプレースホルダーのままです。

```text
binding DB of type d1 must have a valid `database_id` specified [code: 10021]
```

r50では、ログ上の既存D1 database idに合わせて以下へ修正しています。

```text
name: business-card-management
D1 binding: DB
D1 database_name: business-card-management-db
D1 database_id: f0f4b0db-c142-4d62-a4fb-c97eccb335a3
```

Cloudflareの「ユーザー API トークン」はデプロイやCloudflare管理API用です。名刺管理アプリの `BUSINESS_CARD_API_TOKEN` は別の共有秘密トークンとしてWorker secretに設定してください。
