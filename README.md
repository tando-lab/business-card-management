# business-card-cloudflare-d1-api

Storage JSON Protocol v1 (`bc-storage.v1`) を受け取り、Cloudflare D1 の `business_cards` を操作するAPI専用Workerです。

## エンドポイント

```text
POST /api/storage
GET  /api/health
GET  /
GET  /REGISTER_BC
GET  /QUERY_BC
GET  /OPEN_BC
```

`POST /api/storage` は `X-API-Key` ヘッダー必須です。

```text
X-API-Key: <BUSINESS_CARD_API_KEY>
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
npx wrangler secret put BUSINESS_CARD_API_KEY
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
CLOUDFLARE_D1_API_KEY=<BUSINESS_CARD_API_KEY>
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

Cloudflareの「ユーザー API トークン」はデプロイやCloudflare管理API用です。名刺管理アプリの `BUSINESS_CARD_API_KEY` は別の共有秘密キーとしてWorker secretに設定してください。

## r53: X-API-Key 認証ヘッダー統一

Cloudflare D1 API の認証は次に統一しています。

```text
X-API-Key: <BUSINESS_CARD_API_KEY>
```

`Authorization: Bearer` は使用しません。GAS の `CLOUDFLARE_D1_API_KEY` と Worker の `BUSINESS_CARD_API_KEY` には、Cloudflare管理用APIトークンではなく、名刺管理アプリ用に作成した同じ共有キーを設定してください。前後空白はGAS側・Worker側の双方でtrimします。

認証エラー時は、キー値を返さず、ヘッダー有無・受信キー長・期待キー長のみを診断情報として返します。

`business-card-service` manifest includes `https://www.googleapis.com/auth/script.external_request` for `UrlFetchApp.fetch()`。


## r56: Cloudflare入口ランチャー

Cloudflare Workerを安定した入口URLとして利用し、GAS Webアプリへ誘導するランチャーを追加しました。

```text
GET /
GET /REGISTER_BC
GET /QUERY_BC
GET /OPEN_BC?email=<Googleアカウント>&view=register|search
```

`/OPEN_BC` は `nextbrain.pro` / `nextbrain.biz` のメールアドレスだけを許可し、GAS Webアプリへ次のパラメータ付きで302リダイレクトします。

```text
?authuser=<email>&view=register
?authuser=<email>&view=search
```

GAS WebアプリURLはWorkerのruntime variableで変更できます。

```text
GAS_WEB_APP_URL=https://script.google.com/macros/s/<deployment-id>/exec
```
