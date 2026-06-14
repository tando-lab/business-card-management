# r56 Cloudflare入口ランチャー

## 概要

Cloudflare Workerに、GAS Webアプリへ誘導する入口ランチャーを追加した。
D1 APIは従来どおり `POST /api/storage` で提供し、画面表示とGoogleログインセッションはGAS側に任せる。

## 追加ルート

| パス | 用途 |
| --- | --- |
| `/` | アカウント選択ランチャーHTMLを返す |
| `/REGISTER_BC` | 登録画面入口。メール未指定時はランチャー、指定時はGASへリダイレクト |
| `/QUERY_BC` | 検索画面入口。メール未指定時はランチャー、指定時はGASへリダイレクト |
| `/OPEN_BC` | `email` と `view` を検証し、GAS Webアプリへ302リダイレクト |
| `/api/health` | D1 APIとランチャー設定の簡易診断 |

## リダイレクト先

```text
<GAS_WEB_APP_URL>?authuser=<email>&view=register
<GAS_WEB_APP_URL>?authuser=<email>&view=search
```

## 設定

`GAS_WEB_APP_URL` をWorkerのruntime variableとして設定できる。
未設定の場合は既存のGAS WebアプリURLを既定値として使用する。

## ドメイン制限

メールアドレスのドメインは以下のみ許可する。

```text
nextbrain.pro
nextbrain.biz
```
