# Backend API 测试指南

## 启动服务

```bash
cd backend
npm run step3:start
# 或: node server.js
# 默认 http://localhost:3000
```

## curl 测试

### GET /api/ping

```bash
curl -s http://localhost:3000/api/ping
```

示例返回：

```json
{"msg":"pong"}
```

### POST /api/draw

```bash
curl -s -X POST http://localhost:3000/api/draw \
  -H "Content-Type: application/json" \
  -d "{}"
```

示例返回（成功）：

```json
{
  "id": "S00-5748",
  "type": "Empty",
  "title": "空签",
  "level": 0,
  "description": "所行皆明，所向皆顺。新年快乐！",
  "imageUrl": ""
}
```

示例返回（无库存）：

```json
{"status":"OUT_OF_STOCK"}
```

### 兼容旧前端：POST /draw

```bash
curl -s -X POST http://localhost:3000/draw -H "Content-Type: application/json" -d "{}"
```

返回：`{ "status": "OK", "sign": { "id", "level", "type", "reward_code" } }` 或 `{ "status": "OUT_OF_STOCK" }`。

## Postman

- **GET** `http://localhost:3000/api/ping` → 无 body。
- **POST** `http://localhost:3000/api/draw` → Body 选 raw / JSON，可填 `{}`。

## CORS

- 默认允许：`http://localhost:5173`（前端 dev）。
- 生产：在环境变量中设置 `FRONTEND_ORIGIN` 或 `CORS_ORIGIN`（多个用逗号分隔）。
