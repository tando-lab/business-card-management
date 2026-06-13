# 05 Worker Deploy Layout

## 変更理由

Cloudflare build log では次が実行されていた。

```text
Executing user deploy command: npx wrangler deploy
```

この場合、Cloudflare Pages Functions の `/functions` 構成ではなく、Worker の entry point が必要になる。

## 対応

`jl-api.zip` に合わせ、次の構成へ変更した。

```text
src/index.ts
src/router.ts
wrangler.json
```

`wrangler.json` には次を追加する。

```json
{
  "main": "src/index.ts",
  "assets": {
    "directory": "./public",
    "binding": "ASSETS"
  }
}
```

これにより `npx wrangler deploy` で Worker 本体と静的assetsをまとめて扱う。

## 旧構成との差分

| 旧 | 新 |
|---|---|
| `functions/api/*.ts` | `src/router.ts` のHTTPルート |
| Pages Functions | Workers fetch handler |
| `wrangler pages deploy public` | `wrangler deploy` |
| `pages_build_output_dir` | `main` + `assets.directory` |

