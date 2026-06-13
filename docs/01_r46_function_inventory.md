# r46 business-card-service 機能構成確認

確認対象: `business-card-management-r46-schema-diagnostics-ocr.zip`

## サーバー側

| r46ファイル | 主な役割 | Cloudflare移植方針 |
|---|---|---|
| `01_WebEntry.ts` | `doGet`, `doPost`, `getInitialData`, `saveCard`, `extractTextFromImage` | UI入口はPagesへ移行。`getInitialData/saveCard`はPages Functions TypeScript化。OCRは当面Apps Script APIとして残す |
| `10_RegisterService.ts` | payload正規化、必須チェック、検索キー生成 | `functions/_lib/cards.ts` に移植 |
| `18_CardCreateUseCase.ts` | 登録ユースケース、ID採番、画像保存、Spreadsheet追記 | D1 INSERT + R2 PUTへ移植 |
| `19_CardUpdateUseCase.ts` | 更新ユースケース、楽観ロック、行更新 | D1 UPDATEへ移植 |
| `21_CardDeleteUseCase.ts` | 論理削除、楽観ロック | D1 UPDATEで `record_status=DELETED` |
| `22_CardSearchUseCase.ts` | キーワード/owner/tag検索、削除行除外 | D1 SELECTへ移植 |
| `20_DriveService.ts` | Drive画像保存 | R2保存へ置換。ただしOCR用DriveはApps Script側に残す |
| `30_OcrService.ts` | Drive API / Docs OCR | Cloudflare側では未移植。`/api/ocr` からApps Scriptへプロキシ |
| `35_CardRecordMapper.ts` | fieldId/ヘッダー/行変換 | D1列名への変換として再設計 |
| `40_SheetRepository.ts` | Spreadsheet構造保証・行操作 | D1 migration + SQLへ置換 |
| `04_SchemaDiagnostics.ts` | Apps Script側スキーマ診断 | D1 migrationとアプリ起動時の簡易API確認へ段階置換 |

## クライアント側

| r46ファイル | 主な役割 | 初期移植での扱い |
|---|---|---|
| `Index.html`, `View_Register.html`, `View_Search.html` | 登録/検索UI | `public/index.html` に最小移植 |
| `Client_ServerApi.ts` | `google.script.run` facade | `fetch('/api/...')` へ置換 |
| `Client_Form.ts` | 登録フォームpayload生成 | `src/app.ts → public/app.js` に最小移植 |
| `Client_Search.ts` | 検索結果表示/更新/削除 | `src/app.ts → public/app.js` に最小移植 |
| `Client_Camera*`, `Client_Crop*`, `Client_Quality*` | 別タブカメラ、切り抜き、品質判定 | 次段階で移植。初期版は画像選択/撮影inputのみ |
| `Client_Ocr.ts` | OCRボタンと結果表示 | `/api/ocr` 呼び出しに置換 |

## OCR以外でCloudflareへ移す対象

1. 静的UI表示
2. 初期データ取得
3. 名刺登録
4. 名刺検索
5. 名刺更新
6. 名刺論理削除
7. D1台帳保存
8. R2画像保存
9. 認証ユーザーの取得とドメイン制御
10. business-card-login相当の静的ランチャー

## 当面Cloudflareへ移さない対象

1. Google Drive API / Docs OCR本体
2. Apps Script Advanced Service依存処理
3. 既存Spreadsheetの自動修復/ヘッダー補正
4. Google Driveフォルダ権限設定
