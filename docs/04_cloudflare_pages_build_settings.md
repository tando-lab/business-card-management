# Cloudflare Pages build error fix

## 発生したエラー

Cloudflare のビルドログで、以下のようなエラーが出る場合があります。

```text
Executing user deploy command: npx wrangler deploy
WARNING: It seems that you have run `wrangler deploy` on a Pages project
ERROR: Missing entry-point to Worker script or to assets directory
```

## 原因

このプロジェクトは Cloudflare Pages / Pages Functions 構成です。

そのため、Workers 単体プロジェクト用の `wrangler deploy` ではなく、Pages 用の `wrangler pages deploy`、または Cloudflare Pages の通常の Git ビルド設定を使います。

## Cloudflare Pages の推奨設定

```text
Framework preset: None
Build command: npm run build
Build output directory: public
Deploy command: 空欄
```

もし Deploy command 欄を使う設定画面の場合は、以下にします。

```text
Deploy command: npx wrangler pages deploy public --project-name business-card-management
```

プロジェクト名が異なる場合は `business-card-management` を実際の Pages project name に置き換えてください。

## package.json 側の対応

`package.json` には以下のスクリプトを用意しています。

```json
{
  "scripts": {
    "build": "npm run build:client && npm run typecheck",
    "deploy": "npm run build && wrangler pages deploy public",
    "deploy:pages": "npm run build && wrangler pages deploy public"
  }
}
```

Cloudflare側で `npx wrangler deploy` を指定している場合は、プロジェクト側の `package.json` よりもCloudflare側の指定が優先されるため、Cloudflareの設定を修正してください。
