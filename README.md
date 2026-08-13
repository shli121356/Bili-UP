# 个人内容整理平台 · B站版

一个面向个人用户的本地内容整理与归纳平台。当前版本以 B 站已关注 UP 主为主要数据源，读取关注列表和公开视频，统一收集最近视频，按主题分类，并计算热度、活跃度和质量指标。

项目默认在本机运行，数据保存在本地 SQLite 数据库中，不上传 B 站登录态或原始账号数据。

## 1. 使用方法

### Windows 快速启动

双击 `start.bat`，脚本会自动：

1. 创建 `.venv` Python 虚拟环境。
2. 安装 `requirements.txt` 中的后端依赖。
3. 构建 `frontend` 前端。
4. 启动 FastAPI 服务。

浏览器打开：

```text
http://127.0.0.1:8765/
```

### Windows PowerShell

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\start-backend.ps1
```

### macOS / Linux

```bash
chmod +x start.sh
./start.sh
```

### 前端开发模式

后端终端：

```bash
.venv/Scripts/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8765
```

macOS / Linux 使用 `.venv/bin/python`。

前端终端：

```bash
cd frontend
npm install
npm run dev
```

开发页面默认是 `http://127.0.0.1:5173/`，生产构建由后端托管在 8765 端口。

### 首次使用

1. 打开“数据接入”。
2. 点击“扫码登录 B站”，使用哔哩哔哩 App 扫码确认。
3. 点击“同步全部关注”，读取当前账号的关注 UP 主。
4. 等待全量同步和本地分析完成。
5. 在“洞察总览”查看主题分布、树状主题关系和博主库。
6. 点击博主卡片查看头像、粉丝量、最近 5 条视频、周更和指标解释。
7. 若历史数据缺少互动字段，在“数据接入”点击“补齐点赞数据”。

## 2. 使用逻辑

```text
B站扫码登录
    ↓
读取当前账号的全部关注 UP 主
    ↓
保存 UID、名称、头像、粉丝量
    ↓
按发布时间抓取每位 UP 主最近 5 条公开视频
    ↓
按 BV 号补齐播放、点赞、评论、分享
    ↓
标题和简介关键词提取
    ↓
主分类 + 细分主题归类
    ↓
计算热度、活跃度、质量
    ↓
总览、主题树、趋势柱状图、博主详情
```

### 数据口径

- 热度：粉丝量 45% + 发布量 25% + 近 7 天活跃度 30%。
- 活跃度：当前日期之前 7 天内发布的视频数量，最多按 7 条归一化为 100。
- 质量：该 UP 主最近视频的平均点赞数，在有样本账号之间归一化。
- 周更：以当前时间往前 7 天为统计窗口。
- 最近视频：统一按最新发布时间取前 5 条。
- 无视频样本：显示为“待同步 / 无样本”，不强行归入生活类。

### 数据存储

默认数据库：

```text
data/creator_manager.db
```

运行时会自动创建 `data/imports/`。这些目录包含个人数据，默认不会提交到 GitHub。

## 3. 框架结构

```text
个人内容整理平台/
├─ backend/
│  ├─ main.py                 FastAPI 应用入口与静态前端托管
│  ├─ config.py               本地数据目录配置
│  ├─ database.py             SQLAlchemy 引擎与数据库初始化
│  ├─ models.py               Creator、Content、SyncTask 等数据模型
│  ├─ schemas.py              Pydantic API 数据结构
│  ├─ analysis.py             关键词、分类、热度、活跃度、质量分析
│  └─ api/
│     ├─ bilibili.py          B站扫码登录、关注列表、视频和互动数据同步
│     ├─ creators.py          博主列表、详情和人工修正
│     ├─ categories.py        主分类与细分主题统计
│     ├─ stats.py             总览统计
│     ├─ analysis.py          手动运行分析
│     ├─ settings.py          抓取和分析设置
│     ├─ imports.py           JSON / CSV 导入
│     ├─ data.py              结果导出和数据管理
│     ├─ environment.py       运行环境检查
│     └─ wechat.py            微信适配边界；当前仅保留安全的本地启动骨架
├─ frontend/
│  ├─ src/App.tsx             React 页面、状态和交互
│  ├─ src/styles.css          暗调轻科技视觉、响应式布局和动效
│  ├─ src/main.tsx            React 入口
│  ├─ package.json            前端依赖和脚本
│  └─ vite.config.ts          Vite 开发服务器配置
├─ requirements.txt           Python 后端依赖
├─ start.bat                  Windows 一键启动
├─ start-backend.ps1          PowerShell 启动后端
├─ start.sh                   macOS / Linux 启动
├─ .env.example               可选环境变量模板
├─ 产品制作需求文档.md         产品需求文档
└─ docs/                      使用、架构和部署说明
```

### 主要 API

| API | 作用 |
|---|---|
| `GET /api/health` | 服务健康检查 |
| `GET /api/bilibili/status` | B站连接状态 |
| `POST /api/bilibili/login/qr` | 生成扫码登录二维码 |
| `GET /api/bilibili/login/status` | 查询扫码状态 |
| `POST /api/bilibili/sync/start` | 启动全部关注同步 |
| `GET /api/bilibili/sync/status` | 查询同步进度 |
| `POST /api/bilibili/metrics/backfill` | 补齐历史视频互动字段 |
| `GET /api/creators/?platform=bilibili` | 获取博主库 |
| `GET /api/creators/{id}` | 获取博主详情和最近视频 |
| `POST /api/analysis/run?platform=bilibili` | 运行本地分析 |
| `GET /api/categories/?platform=bilibili` | 获取主题与子主题 |

## 4. 注意事项

1. 本项目面向个人本地整理，不要把 `data/`、B站登录会话、导入文件或 `.env` 上传到公开仓库。
2. B站扫码登录只保存本地会话文件；退出账号或删除 `data/bilibili_session.json` 即可清除本地会话。
3. B站接口可能受到网络、频率和登录状态影响。同步失败时先检查“数据接入”状态，再重新扫码或稍后重试。
4. 互动数据补齐使用公开视频详情接口，任务会限速执行；不要连续重复点击补齐按钮。
5. 没有视频样本的账号会显示“待同步 / 无样本”，这不是内容分类结果。
6. 微信适配当前只提供本地客户端启动和授权边界，未实现聊天记录、联系人或私密内容读取。
7. 不要把二维码、Cookie、Token、API Key、个人导出 CSV 或数据库文件提交到 GitHub。
8. 本地服务默认绑定 `127.0.0.1`，不建议直接暴露到公网；如需远程访问，应增加身份认证、HTTPS 和访问控制。

## 5. 部署需要的环境

### 必需环境

- Windows 10 / 11、macOS 或 Linux。
- Python 3.11+，推荐 Python 3.12。
- Node.js 18+，推荐 Node.js 20 LTS。
- npm 9+。
- 可访问 B 站 API 的网络环境。
- B站账号需要能够完成扫码登录。

### 后端依赖

由 `requirements.txt` 安装：

- FastAPI / Uvicorn
- SQLAlchemy / Pydantic
- curl-cffi
- qrcode
- python-multipart
- python-dotenv

### 前端依赖

由 `frontend/package.json` 安装：

- React 18
- TypeScript
- Vite
- Motion
- Lucide React

### 可选环境变量

复制模板：

```bash
cp .env.example .env
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env
```

当前支持：

```env
# 微信客户端路径，仅用于本地启动骨架；不需要微信功能可留空
CREATOR_MANAGER_WECHAT_PATH=
```

### 生产构建检查

```bash
cd frontend
npm run build
cd ..
python -m compileall -q backend
```

启动后检查：

```text
http://127.0.0.1:8765/api/health
```

预期返回：

```json
{"status":"ok","service":"creator-manager"}
```

## 文档索引

- [完整项目指南](docs/PROJECT_GUIDE.md)
- [框架结构与数据流](docs/ARCHITECTURE.md)
- [产品需求文档](产品制作需求文档.md)

## License

MIT
