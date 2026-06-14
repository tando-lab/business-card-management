# Storage JSON Protocol v1

`business-card-service` の `StorageJsonProtocol` と同じ形式を受け取る。

## 要求例

```json
{
  "apiVersion": "bc-storage.v1",
  "operation": "card.search",
  "requestId": "req_20260614_000001",
  "client": {
    "app": "business-card-service",
    "version": "r47",
    "source": "web-ui"
  },
  "payload": {
    "criteria": {
      "keyword": "山田",
      "limit": 100
    }
  }
}
```

## 応答例

```json
{
  "ok": true,
  "apiVersion": "bc-storage.v1",
  "operation": "card.search",
  "requestId": "req_20260614_000001",
  "data": {
    "backend": "cloudflare_d1",
    "records": []
  }
}
```
