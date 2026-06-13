# Cloudflare移行計画書

## Phase 0: 初期土台作成（今回）

成果物:

- `business-card-cloudflare/public` 静的UI
- `functions/api` CRUD API
- `migrations/0001_init.sql` D1スキーマ
- `launcher.html` business-card-login相当の静的ランチャー
- `/api/ocr` Apps Script OCR APIプロキシ枠

完了条件:

- Pages上でUIが表示できる
- D1に名刺を登録できる
- D1から検索できる
- 更新・論理削除ができる
- R2 binding設定後、画像を保存・取得できる

## Phase 1: ログイン/登録/検索UIのCloudflare化

作業:

1. Cloudflare Pagesプロジェクト作成
2. Cloudflare Access + Google IdP設定
3. 許可ドメインを `nextbrain.pro`, `nextbrain.biz` に限定
4. `launcher.html` を既存Apps Scriptランチャーの代替入口にする
5. `index.html` を登録/検索の新入口にする

注意:

- `authuser` パラメータによる回避は検証済みで効果がないため、入口自体を `script.google.com` から外します。

## Phase 2: CRUD API移植

作業:

1. `saveCard` 相当を `/api/cards POST` に固定
2. `searchCards` 相当を `/api/cards GET` に固定
3. `updateCard` 相当を `/api/cards/:id PUT` に固定
4. `deleteCard` 相当を `/api/cards/:id DELETE` に固定
5. r46と同じ `expectedUpdatedAt` / `expectedRevision` 楽観ロックを維持

注意:

- Apps Script `google.script.run` は廃止し、ブラウザから同一オリジン `fetch` に統一します。

## Phase 3: D1移行

作業:

1. 既存SpreadsheetをCSV出力
2. CSV -> D1 import用スクリプト作成
3. `sheet_fields.json` のfieldId対応を検証
4. レコード件数、削除フラグ、revision、検索キーを照合
5. 移行後にApps Script本体登録を停止または読み取り専用化

## Phase 4: R2画像保存

作業:

1. R2バケット作成
2. 既存Drive画像の扱いを決定
   - 既存Drive URLをそのまま保持
   - またはR2へ移送してURLを置換
3. 新規登録分はR2へ保存
4. 画像アクセスは `/api/images/:key` 経由に統一

## Phase 5: OCR残置・API化

作業:

1. Apps Script側にOCR専用 `doPost` を追加
2. token検証を必須化
3. Cloudflare `OCR_API_URL` / `OCR_API_TOKEN` を設定
4. ブラウザからApps Scriptへ直接アクセスしないことを確認

## Phase 6: r46クライアント機能の段階移植

優先順:

1. 別タブカメラUI
2. 画像圧縮
3. OpenCV.js輪郭検出
4. 切り抜き画像生成
5. 品質スコア計算
6. 低スコア時の登録抑制
7. OCR結果からフォーム候補値を補助入力する機能

## リスクと対策

| リスク | 対策 |
|---|---|
| Access未設定でAPIが公開される | Cloudflare AccessをPages全体に適用。Functions側でもドメイン検査 |
| OCR API token漏洩 | tokenはCloudflare env varsにのみ保存。ブラウザへ返さない |
| D1移行時に列対応を誤る | `fieldId` ベースの変換表を作り、件数・主要列・revisionを照合 |
| R2画像URLの公開範囲 | R2は非公開にし、`/api/images/:key` でAccess認証後に返す |
| r46の画質判定劣化 | 初期版では仮値。次段階で `Client_Quality*` を移植 |
