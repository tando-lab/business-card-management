# r0.3 次の移行単位

## 完了

- Worker + Static Assets構成でビルド可能な状態を維持
- `index.html` をログイン/ランチャー画面へ変更
- 旧登録・検索画面を `register.html` へ分離
- `landing.ts` を追加し、ログイン画面で `/api/initial` と `/api/diagnostics` を確認
- `/api/diagnostics` を追加し、D1/R2/OCR設定状態を見える化

## 次候補

1. D1 bindingを本番設定し、登録・検索CRUDを実DBで確認する
2. R2 bucketを作成し、画像アップロードと画像表示を確認する
3. Apps Script側OCR APIをJSON専用APIに整理する
4. Cloudflareの `/api/ocr` からApps Script OCR APIを呼び出す
5. r46の `Client_Camera*` / `Client_Crop*` / `Client_Quality*` をCloudflareクライアントTSへ移植する

## 構成方針

当面はCloudflareで動く構成を優先し、境界が固まってから以下へ整理する。

```text
src/
  client/
  domain/
  usecases/
  repositories/
  services/
  shared/
```
