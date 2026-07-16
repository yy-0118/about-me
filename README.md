# 知识库 RAG 问答系统

> 基于个人文档的检索增强生成（Retrieval-Augmented Generation）问答系统。文档上传、向量化、检索、调用大模型一站式完成；管理员可在后台管理文档、查看用户对话、动态切换 LLM/Embedding 服务。

![tech](https://img.shields.io/badge/python-3.12-blue) ![tech](https://img.shields.io/badge/fastapi-0.110%2B-green) ![tech](https://img.shields.io/badge/react-18-61dafb) ![tech](https://img.shields.io/badge/vite-6-646cff) ![tech](https://img.shields.io/badge/typescript-5-3178c6)

---

## ✨ 核心功能

### 用户端
- 💬 **流式问答**：基于检索结果调用 LLM，SSE 逐字返回
- 📚 **会话持久化**：每条对话自动入库，支持多会话切换
- 🔍 **向量检索**：用户问题 → Embedding → 余弦相似度 → Top-K chunks → 注入 LLM 上下文
- 📄 **多格式支持**：PDF / DOCX / Markdown / TXT 自动分块

### 管理后台
- 📊 **系统概览**：文档 / chunk / 会话 / 消息实时统计
- 📁 **文档管理**：拖拽上传、列表展示、删除（含向量索引级联清理）
- 💬 **用户对话**：列表 + 主从详情，完整 Q&A + 引用源展示
- 🤖 **LLM / Embedding 凭证**：API Key、Base URL、模型、回复风格**运行时**可改
  - 支持 LLM 与 Embedding **走不同 provider**（如 DeepSeek 聊天 + OpenAI/Ollama 向量）
  - 内置「测试连接」按钮 + 内联状态徽章
  - 支持 5 种 AI 回复风格预设（专业/友好/简洁/详细/自由）
- ⚠️ **危险操作**：一键清空所有会话、重置系统设置

---

## 🏗️ 架构

```
┌────────────────────────────────────────────────────────────┐
│                        用户浏览器                            │
│   React 18 + Vite + TypeScript                              │
│   ┌─────────────────┐  ┌─────────────────────┐              │
│   │  聊天页 (Rag)    │  │  管理后台 (Admin)     │              │
│   │  流式 SSE 接收   │  │  文档/对话/设置      │              │
│   └────────┬────────┘  └──────────┬──────────┘              │
└────────────┼─────────────────────┼────────────────────────┘
             │ /api/chat (SSE)      │ /api/admin/* (JSON)
             ▼                       ▼
┌────────────────────────────────────────────────────────────┐
│                     FastAPI 后端 (8000)                      │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐     │
│   │ 文档 API     │  │  问答 API    │  │  管理 API        │     │
│   │ upload/list  │  │ SSE 检索生成 │  │ 文档/对话/设置  │     │
│   │ /del         │  │             │  │ /stats/reset    │     │
│   └──────┬──────┘  └──────┬──────┘  └────────┬────────┘     │
│          │                │                  │              │
│   ┌──────▼─────────────────▼──────────────────▼────────┐    │
│   │  Services                                             │    │
│   │  · DocumentProcessor (extract + chunk)                │    │
│   │  · EmbeddingService (Qwen3-Embedding-8B)             │    │
│   │  · LLMService (DeepSeek-V4-Flash)                   │    │
│   │  · VectorSearch (numpy cosine sim)                   │    │
│   │  · SettingService (DB KV + .env fallback)            │    │
│   └──────┬────────────────────────────────────┬─────────┘    │
│          │                                    │              │
│   ┌──────▼────────┐                  ┌────────▼─────────┐    │
│   │  MySQL/SQLite │                  │  Gitee 模力方舟   │    │
│   │  documents    │                  │  / DeepSeek      │    │
│   │  chunks      │                  │  / OpenAI / Ollama│    │
│   │  chat_*      │                  │                   │    │
│   │  settings    │                  │                   │    │
│   │  admin_*     │                  │                   │    │
│   └──────────────┘                  └───────────────────┘    │
└────────────────────────────────────────────────────────────┘
```

### 数据流（一次问答）

```
用户问题 ─► EmbeddingService.embed() ─► query vector
                                              │
                                              ▼
                              chunks.embedding JSON → numpy cosine
                                              │ (top_k=5)
                                              ▼
                              ChatSource + chunk_text
                                              │
                                              ▼
                              LLMService.chat_stream()
                              (system_prompt + 检索内容 + history)
                                              │
                                              ▼
                                       SSE 逐 chunk 返回
```

---

## 🚀 快速开始

### 0. 准备
- Python 3.12
- Node.js 18+
- （可选）MySQL 8.0+ 或直接用 SQLite
- 一个 LLM provider 的 API key（推荐 Gitee 模力方舟：自带 chat + embedding）

### 1. 启动后端
```powershell
cd backend
python -m venv venv
.\venv\Scripts\pip install -r requirements.txt

# 复制环境变量并填好
copy .env.example .env
# 编辑 .env 填入 ADMIN_PASSWORD / DEEPSEEK_API_KEY 等

# 启动（带 reload 模式方便开发）
.\start.bat
# 或手动：.\venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

后端启动在 `http://localhost:8000`，API 文档在 `http://localhost:8000/docs`。

### 2. 启动前端
```powershell
cd frontend
npm install
npm run dev
```

前端启动在 `http://localhost:3000`，vite 自动代理 `/api/*` 到后端 8000。

### 3. 一键配置 Gitee 模力方舟（推荐）
```powershell
cd backend
$env:PYTHONIOENCODING="utf-8"
$env:GITEE_API_KEY="sk-你的Gitee密钥"
.\venv\Scripts\python scripts/setup_gitee.py
```

这一步会把 `https://ai.gitee.com/v1` 配为 base URL，`DeepSeek-V4-Flash` 为 LLM，`Qwen3-Embedding-8B` 为 embedding。Key 走环境变量，不会硬编码到任何文件。

### 4. 灌入示例文档
```powershell
# 上传 6 份示例 markdown 到 backend/uploads/samples/
# 然后入库（一次性操作）
.\venv\Scripts\python scripts/ingest_samples.py

# 切换 provider 后，重新生成向量
.\venv\Scripts\python scripts/ingest_samples.py --re-embed
```

6 份示例文档覆盖：基本信息、教育、项目、技能、职业规划、性格社交（围绕虚构人物"林知行"）。

### 5. 浏览器访问
- 打开 `http://localhost:3000`
- 点「Click any to enter」进聊天页
- 问 "你是 INTJ 吗"、"你做过哪些项目"
- 点左下角「管理员登录」→ 输 `ADMIN_PASSWORD` → 跳管理后台

---

## ⚙️ 配置

### `.env`（最小集）
```env
DB_TYPE=mysql                 # 或 sqlite
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_pwd
DB_NAME=knowledge_rag

# LLM/Embedding（可被 admin 后台覆盖）
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-flash
EMBEDDING_MODEL=deepseek-embedding

# 管理员
ADMIN_PASSWORD=change_me
```

### 管理后台覆盖
在管理后台「LLM API」页签填的设置**入库** `settings` 表，**优先级高于** `.env`：
- `deepseek_api_key`（LLM key）
- `deepseek_base_url`（LLM endpoint）
- `llm_model`
- `embedding_base_url`（**独立**于 LLM 的 base URL）
- `embedding_api_key`（**独立**于 LLM 的 key；留空 → 复用 LLM key）
- `embedding_model`
- `temperature` / `top_k` / `system_prompt` / `ai_style`

切换 embedding provider 后必须 `--re-embed` 重建向量。

---

## 🗂️ 项目结构

```
.
├── backend/                     # FastAPI 后端
│   ├── app/
│   │   ├── api/                 # 路由
│   │   │   ├── auth.py          # 管理员登录
│   │   │   ├── chat.py          # /api/chat (SSE 流式)
│   │   │   ├── sessions.py      # 用户会话 CRUD
│   │   │   ├── documents.py     # 文档上传/列表/删除
│   │   │   ├── settings.py      # 公共设置读取
│   │   │   └── admin.py         # 管理 API（设置/统计/对话/重置）
│   │   ├── models/              # SQLAlchemy ORM
│   │   ├── schemas/             # Pydantic
│   │   ├── services/            # 业务逻辑
│   │   │   ├── document_processor.py
│   │   │   ├── embedding_service.py
│   │   │   ├── llm_service.py
│   │   │   ├── vector_search.py
│   │   │   └── setting_service.py
│   │   ├── auth.py              # 管理员 token 鉴权
│   │   ├── config.py            # pydantic-settings
│   │   ├── database.py          # SQLAlchemy 引擎
│   │   └── main.py              # FastAPI app + 路由注册
│   ├── uploads/
│   │   └── samples/             # 示例 markdown 文档
│   ├── scripts/
│   │   ├── setup_gitee.py       # 一次性配置 Gitee 凭据
│   │   └── ingest_samples.py    # 灌库 / re-embed
│   ├── sql/init.sql              # MySQL 建表脚本
│   ├── start.bat                 # Windows 一键启动
│   └── requirements.txt
│
├── frontend/                    # React + Vite 前端
│   ├── src/
│   │   ├── pages/
│   │   │   ├── CoverPage.tsx    # 入口封面
│   │   │   ├── RagPage.tsx      # 用户聊天
│   │   │   └── AdminPage.tsx    # 管理后台外壳
│   │   ├── components/
│   │   │   ├── Sidebar.tsx      # 用户侧会话列表
│   │   │   ├── ChatPanel.tsx    # 聊天气泡流
│   │   │   ├── ChatInput.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── SourceCard.tsx
│   │   │   ├── TopBar.tsx
│   │   │   ├── SettingsModal.tsx # 只读
│   │   │   ├── AdminLoginModal.tsx
│   │   │   └── admin/
│   │   │       ├── AdminSidebar.tsx
│   │   │       ├── AdminTopBar.tsx
│   │   │       └── tabs/
│   │   │           ├── DashboardTab.tsx
│   │   │           ├── DocumentsTab.tsx
│   │   │           ├── UserConversationsTab.tsx
│   │   │           ├── LLMApiTab.tsx
│   │   │           └── DangerZoneTab.tsx
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx
│   │   │   └── ThemeContext.tsx
│   │   └── lib/
│   │       ├── api.ts           # fetch 封装 + SSE parser
│   │       ├── auth.ts          # token 持久化
│   │       └── types.ts
│   ├── public/                  # 静态资源
│   └── vite.config.ts           # dev proxy /api → :8000
│
├── .env.example
├── deploy.sh
└── docker-compose.yml
```

---

## 🛠️ 常用 API

### 用户端
| Method | Path | 说明 |
|---|---|---|
| `GET` | `/api/settings` | 读取非敏感设置 |
| `GET` | `/api/documents` | 文档列表 |
| `POST` | `/api/chat` | **SSE** 流式问答（body: `{question, session_id?, top_k?}`） |
| `*` | `/api/chat/sessions` | 会话 CRUD |

### 管理端（需 `Authorization: Bearer <token>`）
| Method | Path | 说明 |
|---|---|---|
| `POST` | `/api/auth/admin` | 登录拿 token |
| `GET` / `PUT` | `/api/admin/settings` | 完整设置读写 |
| `POST` | `/api/admin/test-llm` | 测试 LLM/Embedding 连接 |
| `POST` | `/api/admin/reset-settings` | 重置（非 api_key） |
| `GET` | `/api/admin/stats` | 概览统计 |
| `GET` | `/api/admin/questions` | 用户提问摘要 |
| `GET` / `DELETE` | `/api/admin/sessions` & `/sessions/{id}` | 用户会话管理 |

完整 OpenAPI 文档：`http://localhost:8000/docs`

---

## 🧰 维护脚本

| 脚本 | 用途 |
|---|---|
| `backend/scripts/setup_gitee.py` | 一次性把 Gitee 凭据写 DB（Key 走 `GITEE_API_KEY` 环境变量） |
| `backend/scripts/ingest_samples.py` | 灌入 `backend/uploads/samples/` 下的 markdown |
| `backend/scripts/ingest_samples.py --re-embed` | 对已入库 chunk 重新生成向量 |
| `backend/start.bat` | Windows 一键启动后端（先 taskkill 旧进程） |

---

## 🔐 安全提示

- 管理员 password 务必修改 `.env` 里的 `ADMIN_PASSWORD`
- API Key **只**通过管理后台或 `GITEE_API_KEY` 环境变量配置，**不入库任何源码文件**
- 建议在 Gitee/OpenAI 控制台对 key 启用 IP 白名单
- 数据库中的 `admin_tokens` 表记录已签发的 token，可定期 `DELETE FROM admin_tokens WHERE expires_at < NOW()` 清理

---

## 📝 开发说明

### 后端热重载
```powershell
.\venv\Scripts\python -m uvicorn app.main:app --reload
```

### 前端热重载
`npm run dev` 已默认开启 HMR；改了 `api.ts` / `ChatPanel.tsx` 等无需手动刷新。

### 调试技巧
- 后端：`--log-level debug` 看 SSE 字节
- 前端：DevTools Console 过滤 `[chatStream]` 和 `[RagPage.send]`，能定位到具体哪个 event 没解析或没渲染
- curl SSE：
  ```powershell
  curl -N -X POST http://localhost:8000/api/chat -H "Content-Type: application/json" -d '{\"question\":\"test\"}'
  ```

### 已知坑
- **DeepSeek 官方没有 embedding 模型**：DEEPSEEK_API_KEY 配 DeepSeek 后 embedding 会失败。需用 Gitee/OpenAI/Ollama 替代
- **切换 embedding 模型后必须 re-embed**：旧向量维度不兼容
- **前端 dev 时硬刷（Ctrl+Shift+R）**：HMR 偶尔有 stale 模块引用

---

## 📜 License

MIT
