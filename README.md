# 📖 北地书阁

> 中国地质大学（北京）学子专属的往年真题与学习资料分享平台。

基于 Node.js + Vue 3 的全栈项目，支持学号登录、课程文件夹浏览、在线预览、下载限速、移动端适配。适合部署在低配云服务器上供校内同学使用。

---

## 功能特点

- **🔐 学号登录**：学生输入学号即可登录（支持模糊验证），管理员密码登录
- **📁 课程文件夹**：首页按课程展示卡片，点击进入该课程资源列表
- **🔍 模糊搜索**：课程和资源都支持模糊匹配（搜"马原"找"马克思主义基本原理"）
- **📄 在线预览**：PDF 直接浏览器打开，Office 文件通过 LibreOffice 转 PDF 预览
- **⬇️ 限速下载**：每线程 600KB/s，防止服务器被打满
- **📱 移动端适配**：学生端和管理端都有对应的手机版页面
- **👮 审核流程**：学生上传 → 管理员审核（可重命名、选课程、选分类）→ 发布
- **📊 管理后台**：数据仪表盘、资源审核、课程/分类/用户管理、访问统计
- **🔒 登录限流**：每 IP 错误 5 次锁定 30 分钟
- **🖼️ 资料分类**：考试真题 / 复习资料 / 其他资料

---

## 技术栈

| 层面 | 技术 |
|------|------|
| 后端框架 | Node.js + Express 4.x |
| 数据库 | SQLite（sql.js，WASM 版，无需编译） |
| 认证 | JWT（access 2h + refresh 7d） |
| 文件上传 | Multer（UUID 重命名，磁盘存储） |
| Office 预览 | LibreOffice 7.3（doc/docx/ppt/pptx/xls/xlsx → PDF） |
| 前端框架 | Vue 3 + Vite 6 |
| UI 组件 | Element Plus（中文语言包） |
| 状态管理 | Pinia |
| 图表 | ECharts（管理后台仪表盘） |
| 反向代理 | Nginx |
| 进程管理 | systemd |
| SSL | Let's Encrypt（Certbot 自动续期） |

---

## 快速开始

### 开发环境

```bash
# 1. 安装后端依赖
cd server
npm install
cp .env.example .env
# 编辑 .env 配置数据库路径等

# 2. 初始化数据库和管理员账号
npm run seed

# 3. 启动后端
npm run dev

# 4. 新终端窗口 - 前端
cd client
npm install
npm run dev
```

后端运行在 `http://localhost:3000`，前端运行在 `http://localhost:5173`。

### 默认管理员

| 用户名 | 密码 |
|--------|------|
| `admin` | `admin123456` |

> ⚠️ 首次登录后请立即修改密码！

---

## 部署到服务器

### 前置要求

- Ubuntu 22.04 LTS
- Node.js 18+
- Nginx
- 建议 2C2G 或以上

### 手动部署

```bash
# 1. 上传项目到服务器
# 2. 安装后端依赖
cd /opt/resource-platform/server
npm install --production
mkdir -p data uploads/{pending,approved,rejected}

# 3. 配置环境变量
cp .env.example .env
# 修改 JWT_SECRET 等配置

# 4. 初始化数据库
npm run seed

# 5. 构建前端
cd /opt/resource-platform/client
npm install
npm run build

# 6. 配置 Nginx（参考 deploy/nginx.conf）
# 7. 配置 systemd 服务或 PM2 管理后端进程
```

### LibreOffice 预览支持（可选）

如果需要在线预览 Office 文件：

```bash
apt-get install -y libreoffice-writer libreoffice-calc libreoffice-impress fonts-wqy-zenhei fonts-noto-cjk
```

---

## 项目结构

```
resource-sharing-platform/
├── server/                        # Express 后端
│   ├── src/
│   │   ├── config/                # 配置 + 数据库初始化
│   │   ├── middleware/             # 中间件（JWT、上传、错误处理）
│   │   ├── models/                # 数据模型（User/Course/Category/Resource/DownloadLog）
│   │   ├── routes/                # API 路由
│   │   │   ├── auth.routes.js     # 登录（含限流）+ 学号登录
│   │   │   ├── resources.routes.js# 资源 CRUD + 预览 + 限速下载 + 审核
│   │   │   ├── courses.routes.js  # 课程管理
│   │   │   ├── categories.routes.js
│   │   │   ├── users.routes.js    # 用户管理
│   │   │   └── stats.routes.js    # 统计 + 访问量
│   │   ├── services/              # 业务逻辑
│   │   └── utils/                 # 工具函数
│   ├── uploads/{pending,approved,preview_cache}/
│   └── seeds/seed.js              # 初始管理员 + 分类
├── client/                        # Vue 3 前端
│   ├── src/
│   │   ├── api/                   # API 调用（含 JWT 拦截器）
│   │   ├── components/            # 通用组件
│   │   ├── layouts/               # 布局（学生端 / 管理端）
│   │   ├── router/                # 路由（含移动端检测）
│   │   ├── stores/                # Pinia 状态管理
│   │   └── views/                 # 页面
│   │       ├── login/             # 双 Tab 登录页
│   │       ├── student/           # 课程目录 → 资源列表 → 详情
│   │       └── admin/             # 仪表盘、审核、管理 + 手机版
│   └── public/cugb-badge.png      # 校徽
└── deploy/
    └── setup.sh                   # 部署脚本
```

---

## API 概览

所有接口以 `/api/v1` 为前缀。

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /auth/login | 管理员密码登录 | 公开 |
| POST | /auth/student-login | 学生学号登录（自动创建） | 公开 |
| GET | /auth/profile | 当前用户信息 | 登录 |
| POST | /auth/refresh | 刷新 Token | 登录 |
| PUT | /auth/password | 修改密码 | 登录 |
| GET | /resources | 已审核资源列表（支持搜索/筛选/分页） | 登录 |
| GET | /resources/mine | 我的上传 | 登录 |
| GET | /resources/admin | 全部资源（管理员） | 管理员 |
| POST | /resources | 上传资源 | 登录 |
| GET | /resources/:id | 资源详情 | 登录 |
| GET | /resources/:id/preview | 在线预览（PDF inline / Office 转 PDF） | 登录 |
| GET | /resources/:id/download | 下载（限速 600KB/s） | 登录 |
| POST | /resources/:id/review | 审核通过/驳回 | 管理员 |
| PUT | /resources/:id | 更新资源信息 | 管理员 |
| DELETE | /resources/:id | 删除资源 | 管理员/上传者 |
| GET | /courses | 课程列表（含资源数） | 登录 |
| GET | /courses/all | 全部课程 | 登录 |
| POST/PUT/DELETE | /courses | 课程管理 | 管理员 |
| GET | /categories | 分类列表 | 登录 |
| POST/PUT/DELETE | /categories | 分类管理 | 管理员 |
| GET | /users | 用户列表 | 管理员 |
| POST/PUT/DELETE | /users | 用户管理 | 管理员 |
| GET | /stats/overview | 仪表盘数据 | 管理员 |
| GET | /stats/category-distribution | 分类分布 | 管理员 |

---

## 学生登录说明

- 学生输入 **10 位学号**即可登录，无需密码
- 首次登录自动创建账号
- 验证规则（**不对外公开**，防校外人员猜测）：
  - 前 4 位：1000–1030
  - 后 2 位：00–36
- 错误统一提示「学号错误」，不暴露格式

---

## 服务器优化（2C2G）

| 优化项 | 说明 |
|--------|------|
| Node.js 内存 | `--max-old-space-size=256` |
| systemd 自动重启 | `Restart=always` |
| SQLite WAL 模式 | 读写不互斥 |
| 2GB Swap | 内存尖峰缓冲 |
| Gzip 压缩 | 前端资源减少 ~70% |
| 并发上传限制 | 最多 10 人同时上传 |
| 下载限速 | 每线程 600KB/s |
| LibreOffice 预览缓存 | 同名文件不重复转换 |

---

## License

MIT
