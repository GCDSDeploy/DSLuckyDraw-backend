# DSLuckyDraw 测试版部署清单

## 阶段 1：准备测试分支 ✅

- [x] backend/frontend `git status` 已检查
- [x] frontend 未提交改动已 commit：`chore: save local changes before staging`
- [x] backend 已创建并切换至 `staging` 分支
- [x] frontend 已创建并切换至 `staging` 分支
- [x] backend `git push origin staging` 已执行
- [x] frontend `git push origin staging` 已执行
- [x] `git ls-remote origin` 已确认远程存在 `staging`

---

## 阶段 2：部署测试后端（Railway）

以下在 **Railway 控制台** 或 Railway CLI 中完成。

### 任务 2.1：创建/确认 Railway 测试项目

- 登录 [Railway](https://railway.app) → 新建项目或选择现有测试项目
- 确认项目状态为 **active**
- 若从 GitHub 部署：在项目设置中连接仓库 `haijingtest/DSLuckyDraw-backend`，分支选择 **staging**

### 任务 2.2：配置环境变量

在 Railway 项目 → Variables 中设置：

| 变量 | 说明 | 示例值 |
|------|------|--------|
| `DB_HOST` | MySQL 主机 | `railway-test.proxy.rlwy.net` 或 Railway MySQL 提供的主机 |
| `DB_PORT` | MySQL 端口 | Railway 提供的端口（如 12345） |
| `DB_USER` | 数据库用户 | 你的 MySQL 用户 |
| `DB_PASSWORD` | 数据库密码 | 你的 MySQL 密码 |
| `DB_NAME` | 数据库名 | `railway_test` 或你的库名 |
| `PORT` | 后端监听端口 | `3000`（Railway 会注入，也可显式设置） |
| `CORS_ORIGIN` | 允许的前端来源 | `https://你的staging前端域名,http://localhost:5173` |

保存后 Railway 会重新部署。

### 任务 2.3：部署后端

- 确保 GitHub 仓库 **staging** 分支已推送（已完成）
- Railway 若已关联 GitHub，推送后会自动部署
- 或：Railway Dashboard → Deploy → 从 GitHub 选择 `DSLuckyDraw-backend`、分支 `staging`
- 部署完成后在 **Logs** 中确认无报错，看到类似：`Step 3 API listening on http://localhost:3000`

### 任务 2.4：测试 API 可达性

部署完成后，在 Railway 项目页获取 **公网 URL**（如 `https://xxx.up.railway.app`），然后执行：

```bash
# 替换为你的 Railway 后端 URL
BACKEND_URL="https://你的后端服务.up.railway.app"

curl -s "$BACKEND_URL/api/ping"
# 预期：{"msg":"pong"}

curl -s -X POST "$BACKEND_URL/api/draw" -H "Content-Type: application/json" -d "{}"
# 预期：签文 JSON 或 {"status":"OUT_OF_STOCK"}
```

---

## 阶段 3：配置并部署测试前端

### 任务 3.1：配置前端 API URL

- 将 **frontend/.env.staging** 中的 `VITE_API_BASE_URL` 改为阶段 2 得到的 **Railway 后端公网 URL**（无尾部斜杠）
- 示例：`VITE_API_BASE_URL=https://dsluckydraw-backend.up.railway.app`

### 任务 3.2：构建前端测试包

```bash
cd frontend
npm install
npm run build:staging
```

- 构建产物在 `frontend/dist/`
- 若报错，检查 `.env.staging` 是否存在且 `VITE_API_BASE_URL` 正确

### 任务 3.3：部署前端

- 将 `frontend/dist/` 内容上传到测试域（如 Vercel / Railway Static / 自有服务器）
- 若用 Vercel：连接 `haijingtest/DSLuckyDraw-frontend`，分支选 **staging**，Build Command 填 `npm run build:staging`，Output Directory 填 `dist`
- 打开浏览器访问配置的 staging 域名，确认页面可访问

---

## 阶段 4：联调验收

### 4.1 功能验证

- 打开 staging 前端 URL → 进入抽签流程 → 打开 `/draw/shake`（摇一摇页）
- 摇一摇或点击「摇一摇 得好礼」
- 打开开发者工具 Console，应看到 `draw result:` 及后端返回的 JSON
- 动画正常、签文展示正常、可跳转结果页

### 4.2 库存耗尽

- 抽完所有签（或后端无库存）后再次抽签
- 应弹窗：「今日签已抽完，请明日再来」
- 动画结束，页面不卡死

### 4.3 网络异常

- 断网或后端不可用时再次抽签
- 应弹窗：「抽签请求失败，请检查网络或稍后重试」
- Console 有 `console.warn` 错误信息

### 4.4 跨端与响应式

- 不同机型/屏幕尺寸下检查布局、插图高度、动画与跳转逻辑

---

## 阶段 5：提交与回退

### 提交

若在 staging 上还有新改动需要推送：

```bash
cd backend   # 或 frontend
git add .
git commit -m "feat: DSLuckyDraw test deployment"
git push origin staging
```

### 回退（出问题时）

```bash
git revert HEAD
git push origin staging
# 或本地回退（未 push 时）：
# git reset --hard HEAD~1
```

- main 分支不操作，保持不受影响

---

## 完成标志

- [ ] 测试版已安全上线（staging 分支 + 测试环境）
- [ ] 前后端联调通过（ping + draw 正常）
- [ ] 核心抽签流程验证完成
- [ ] 前端后续优化可在 staging 上继续迭代

---

**注意**：测试版仅影响 staging 与测试环境；测试数据库与生产隔离；每步可回退；生产上线前需单独执行生产上线清单。
