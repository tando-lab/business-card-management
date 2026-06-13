# r0.3 画面分割：index.htmlをログイン、register.htmlを登録・検索へ変更

## 目的

Cloudflare版では、Apps Script版のログインランチャー問題を回避するため、入口をCloudflare側に固定する。
そのため、`index.html` はログイン/ランチャー画面として扱い、業務画面は別ファイルへ分離する。

## 変更後のURL

| URL | 役割 |
|---|---|
| `/` または `/index.html` | Cloudflare版ログイン/ランチャー |
| `/register.html` | 名刺登録・検索画面 |
| `/launcher.html` | 旧ランチャーURL互換用 |

## 追加API

`GET /api/diagnostics` を追加した。

返却する主な情報は以下。

- Cloudflare Access由来のユーザー情報
- D1 binding `DB` の有無
- R2 binding `CARD_IMAGES` の有無
- OCR API URL設定の有無
- 主要ルート一覧

## 今回まだ行っていないこと

- Cloudflare Access自体の設定
- D1/R2 bindingの本番値設定
- r46の別タブカメラ、OpenCV切り抜き、詳細画質判定の完全移植
