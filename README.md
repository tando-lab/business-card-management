# business-card-cloudflare

`business-card-management-r46-schema-diagnostics-ocr.zip` を基準に、OCR以外の名刺管理機能を Cloudflare Pages / Pages Functions / D1 / R2 へ段階移植するための TypeScript 初期プロジェクトです。

## 目的

Apps Script Webアプリをユーザーが直接開くと、Chromeで複数Googleアカウントを使っている環境において `script.google.com/macros/u/N/s/...` へ寄せられ、権限のないアカウント側で「現在、ファイルを開くことができません」画面になることがあります。

この初期版では、ユーザーが直接開く入口を Cloudflare Pages に移し、Apps Script は当面 OCR JSON API としてだけ残せる構成にします。

## TypeScript構成

```text
business-card-cloudflare/
  public/                  # Cloudflare Pagesで配信する静的UI
    index.html
    launcher.html
    app.js                 # src/app.ts から生成
    app.js.map
    styles.css
  src/
    app.ts                 # フロントUI TypeScript
  functions/               # Cloudflare Pages Functions TypeScript
    _middleware.ts
    _lib/
      cards.ts             # CRUD / 正規化 / D1 / R2保存
      http.ts              # JSON応答 / エラー / 認証補助
      types.ts             # AppEnv / payload / record 型
    api/
      initial.ts
      cards/index.ts
      cards/[id].ts
      images/[key].ts
      ocr.ts
  types/
    cloudflare-pages.d.ts  # 最小のPages/D1/R2型定義
  migrations/
    0001_init.sql
  docs/
    01_r46_function_inventory.md
    02_cloudflare_min_architecture.md
    03_migration_plan.md
    04_cloudflare_pages_build_settings.md
  package.json
  tsconfig.json
  tsconfig.client.json
  wrangler.toml
```

## r46から移植した機能

- 登録: `saveCard` / `registerCard_` / `executeCreateCardUseCase_` 相当
- 検索: `searchCards` / `executeSearchCardsUseCase_` 相当
- 更新: `updateCard` / `executeUpdateCardUseCase_` 相当
- 削除: `deleteCard` / `executeDeleteCardUseCase_` 相当
- 論理削除: `recordStatus=DELETED` / `deleteFlag=TRUE`
- 楽観ロック: `expectedUpdatedAt` / `expectedRevision`
- 画像保存: Google Drive ではなく R2 に保存
- 台帳保存: Google Spreadsheet ではなく D1 に保存
- OCR: Cloudflare側では直接OCRせず、`/api/ocr` から Apps Script OCR API へプロキシする口を用意

## 初期セットアップ

```bash
cd business-card-cloudflare
npm install
npm run d1:create
```

作成された D1 database id を `wrangler.toml` の `database_id` に反映します。

```toml
[[d1_databases]]
binding = "DB"
database_name = "business-card-db"
database_id = "実際のD1_DATABASE_ID"
```

## ローカル検証

```bash
npm run build
npm run d1:migrate:local
npm run dev
```

`dev` は `src/app.ts` を `public/app.js` にビルドしてから `wrangler pages dev` を起動します。

## デプロイ

### Cloudflare Pages の Git 連携でデプロイする場合

Cloudflare Pages のビルド設定は以下にします。

```text
Build command: npm run build
Build output directory: public
Deploy command: 空欄、または npx wrangler pages deploy public --project-name <Pages project name>
```

`npx wrangler deploy` は Workers 用のデプロイコマンドです。このプロジェクトは Pages / Pages Functions 構成のため、`npx wrangler deploy` を指定すると `Missing entry-point to Worker script or to assets directory` で失敗します。

### CLI から直接デプロイする場合

```bash
npm run build
npm run d1:migrate:remote
npx wrangler pages deploy public --project-name <Pages project name>
```

`package.json` の `npm run deploy` は `wrangler pages deploy public` を実行します。プロジェクト名の選択を求められる場合は、上記のように `--project-name` を付けて実行してください。

本番では Cloudflare Access を Pages プロジェクトに設定し、Google認証で以下ドメインを許可してください。

```text
nextbrain.pro
nextbrain.biz
```

## OCR API連携

Apps Script 側に OCR JSON API を用意した後、`wrangler.toml` または Cloudflare Pages の環境変数に以下を設定します。

```toml
OCR_API_URL = "https://script.google.com/macros/s/xxxxx/exec"
OCR_API_TOKEN = "任意の共有トークン"
```

Cloudflare UIから `/api/ocr` を呼ぶと、Worker/Pages Functions側が Apps Script OCR API へサーバー間通信します。ユーザーが直接Apps Script WebアプリURLを開かない構成にするため、`/macros/u/N/s/...` 問題を回避しやすくなります。

## 補足

`types/cloudflare-pages.d.ts` は、初期検証をZIP単体でも読みやすくするための最小型です。実プロジェクトでは `npm run types:cloudflare` で Wrangler 生成型を作成し、必要に応じてそちらへ置換してください。
