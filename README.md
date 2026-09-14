# 📖 北地书阁

北地（中国地质大学北京）学子专属的往年真题与学习资料分享平台。

## 功能特点

- **用户管理**：管理员预创建学生账号，安全可控
- **资源上传**：学生可以上传 PDF、Word、PPT、Excel 文档
- **审核流程**：上传后需管理员审核通过才可被其他同学看到
- **分类浏览**：按课件、试卷、实验报告等分类查看资源
- **搜索筛选**：支持按标题搜索和分类/格式筛选
- **下载统计**：记录每个资源的下载次数
- **管理后台**：数据仪表盘、审核队列、用户和分类管理

## 技术栈

| 层面 | 技术 |
|------|------|
| 后端 | Node.js + Express |
| 前端 | Vue 3 + Element Plus + Vite |
| 数据库 | SQLite (sql.js) |
| 认证 | JWT (Access Token + Refresh Token) |
| 部署 | Nginx + PM2 |

## 快速开始

### 开发环境

```bash
# 1. 安装后端依赖
cd server
npm install
cp .env.example .env

# 2. 初始化数据库和管理员账号
npm run seed

# 3. 启动后端（开发模式，热重载）
npm run dev

# 4. 新终端窗口 - 安装前端依赖并启动
cd client
npm install
npm run dev
```

后端运行在 `http://localhost:3000`，前端运行在 `http://localhost:5173`。

### 默认管理员账号

- 用户名：`admin`
- 密码：`admin123456`
- ⚠️ 首次登录后请立即修改密码！

## 部署到服务器

### 前置要求

- Ubuntu 22.04 LTS
- 2C2G 或以上配置
- root 或 sudo 权限

### 一键部署

```bash
# 将项目上传到服务器后
sudo chmod +x deploy/setup.sh
sudo ./deploy/setup.sh
```

部署脚本会自动完成：
1. 安装系统依赖（Nginx、Node.js）
2. 优化内存（关闭非必要服务、配置 Swap）
3. 安装项目依赖并构建前端
4. 配置 Nginx 反向代理
5. 使用 PM2 管理后端进程

### 手动部署关键步骤

```bash
# 1. 上传项目到服务器
scp -r resource-sharing-platform user@your-server:/opt/

# 2. 运行部署脚本
ssh user@your-server
sudo /opt/resource-platform/deploy/setup.sh

# 3. 配置 SSL（可选，推荐）
sudo certbot --nginx -d your-domain.com
```

## 项目结构

```
resource-sharing-platform/
├── server/                # Express 后端
│   ├── src/
│   │   ├── config/        # 配置 + 数据库
│   │   ├── middleware/     # 中间件（认证、上传、错误处理）
│   │   ├── models/         # 数据模型
│   │   ├── routes/         # API 路由
│   │   ├── services/       # 业务逻辑
│   │   └── utils/          # 工具函数
│   ├── seeds/              # 数据库种子
│   └── uploads/            # 文件存储
├── client/                # Vue 3 前端
│   └── src/
│       ├── api/            # API 调用
│       ├── components/     # 通用组件
│       ├── layouts/        # 页面布局
│       ├── router/         # 路由配置
│       ├── stores/         # 状态管理
│       └── views/          # 页面
└── deploy/                # 部署配置
    ├── nginx.conf
    ├── ecosystem.config.js
    └── setup.sh
```

## API 概览

所有接口以 `/api/v1` 为前缀。

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /auth/login | 登录 | 公开 |
| GET | /auth/profile | 个人信息 | 登录 |
| POST | /auth/refresh | 刷新 Token | 登录 |
| PUT | /auth/password | 修改密码 | 登录 |
| GET | /resources | 资源列表 | 登录 |
| GET | /resources/:id | 资源详情 | 登录 |
| POST | /resources | 上传资源 | 登录 |
| GET | /resources/:id/download | 下载 | 登录 |
| POST | /resources/:id/review | 审核 | 管理员 |
| GET | /users | 用户列表 | 管理员 |
| POST | /users | 创建用户 | 管理员 |
| GET | /categories | 分类列表 | 登录 |
| GET | /stats/overview | 数据概览 | 管理员 |

## 优化说明（2C2G 服务器）

| 优化项 | 说明 |
|--------|------|
| Node.js 内存限制 | `--max-old-space-size=256`，堆内存不超过 256MB |
| PM2 自动重启 | 内存超过 300MB 自动重启 |
| SQLite WAL 模式 | 读写不互斥，低配服务器并发更好 |
| 2GB Swap | 内存尖峰时缓冲，防止 OOM |
| 关闭 snapd | 释放 ~100MB 内存 |
| Gzip 压缩 | 前端资源传输体积减少 ~70% |
