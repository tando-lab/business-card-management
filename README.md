# business-card-cloudflare-worker

名刺管理アプリ r46 を、Cloudflare Workers + Static Assets + D1 + R2 向けに移植する初期TypeScript版です。

前回版の Cloudflare Pages Functions 構成ではなく、添付された `jl-api.zip` と同じく `wrangler deploy` でビルド・デプロイできる Worker 構成に寄せています。

## 構成

```text
business-card-cloudflare-worker/
  public/                 # 静的HTML/CSS/JS。Workers Static Assetsで配信
  src/
    index.ts              # Worker entry point
    router.ts             # /api/* と静的assetsの振り分け
    app.ts                # フロントTypeScript元ファイル
    lib/                  # D1/R2/HTTP/型
  migrations/             # D1 schema
  wrangler.json           # wrangler deploy 用。初期状態ではD1/R2 binding未設定
  wrangler.with-bindings.example.json
```

## Cloudflare の設定

Cloudflare の Deploy command が次のままでも動く構成です。

```bash
npx wrangler deploy
```

Build command は空欄、または任意で次にします。

```bash
npm run build
```

## D1/R2 binding

初回ビルドを通しやすくするため、`wrangler.json` には D1/R2 binding を直接書いていません。
D1/R2を作成後、`wrangler.with-bindings.example.json` を参考に `wrangler.json` へ追記してください。

```bash
npm run d1:create
npm run d1:migrate:remote
```

必要なbinding名は以下です。

| binding | 用途 |
|---|---|
| `DB` | D1 名刺台帳 |
| `CARD_IMAGES` | R2 画像保存 |
| `ASSETS` | public配信 |

## API

| API | 内容 |
|---|---|
| `GET /api/initial` | 初期表示情報 |
| `GET /api/cards` | 検索 |
| `POST /api/cards` | 登録 |
| `PUT/PATCH /api/cards/:id` | 更新 |
| `DELETE /api/cards/:id` | 論理削除 |
| `GET /api/images/:key` | R2画像取得 |
| `POST /api/ocr` | Apps Script OCR APIプロキシ |

## 注意

この版は「Cloudflareでビルド・デプロイできる初期土台」を優先しています。D1/R2/OCR/API境界が固まった後、GAS r46 の設計思想に近い `domain / usecase / repository / service / client` へ再分割する前提です。


## 直近のCloudflare build error対応

Cloudflare のビルドログで次のエラーが出る場合があります。

```text
Can't set compatibility date in the future
```

Cloudflare のビルド環境はUTC日時で判定されるため、日本時間では当日でも、Cloudflare側では前日扱いになり、`compatibility_date` が未来日として拒否されることがあります。

この版では `wrangler.json` と `wrangler.with-bindings.example.json` の `compatibility_date` を `2025-12-01` に固定しています。
Cloudflare側の日時に左右されにくくするため、当日や未来日ではなく、確実に過去日の安定した日付を指定してください。


## r0.3 画面分割

`index.html` はログイン/ランチャー画面に変更しました。登録・検索画面は以下です。

```text
/register.html
```

互換用に `/launcher.html` も残していますが、新しい入口は `/` または `/index.html` です。

追加確認用APIとして以下を用意しています。

```text
/api/diagnostics
```

このAPIで、D1 binding `DB`、R2 binding `CARD_IMAGES`、OCR API URL設定、Cloudflare Access由来のユーザー情報を確認できます。
