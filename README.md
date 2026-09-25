# 📖 北地书阁

<div align="center">
  <img src="https://raw.githubusercontent.com/WYC-win/resource-sharing-platform/main/client/public/cugb-badge.png" width="110" alt="北地书阁" />
  <p><strong>中国地质大学（北京）学子专属的学习资料分享平台</strong></p>
  <p>消除信息差，让每个同学都能平等地拿到复习资料。</p>
</div>

---

## 🔗 立即访问

<div align="center">

### 👉 **[https://cugbshare.asia](https://cugbshare.asia)**

**用学号登录即可 —— 无需注册、无需密码、永久免费**

</div>

> 首次登录需阅读并确认免责声明。资料均来自同学分享与公开渠道，仅供校内学习交流使用。

---

## ✨ 这是什么

每年期末，复习资料散落在各个班级群里 —— 有人手里有往年真题，有人有学长整理的笔记，但更多的人什么都拿不到。

北地书阁想解决的就是这个问题：把资料集中到一个地方，按课程归类，谁都能查、谁都能下。**你只需要知道自己的学号，就能进来。**

目前已收录 **33 门课程、320+ 份资料**，覆盖公共基础课与海洋、地学相关专业课。

<details>
<summary><strong>📚 点此查看已收录课程</strong></summary>

| 课程 | 份数 | 课程 | 份数 |
|------|------|------|------|
| 高等数学（上） | 26 | 大学英语 | 11 |
| 高等数学（下） | 19 | 信号与系统 | 19 |
| 线性代数 | 17 | 高频电子线路 | 10 |
| 大学化学 | 36 | 单片机原理及接口技术 | 10 |
| 中国近现代史纲要 | 27 | 复变函数与积分变换 | 8 |
| 概率论与数理统计 | 27 | 海洋科学概论 | 12 |
| 马克思主义基本原理 | 16 | 工程图学 | 5 |
| 地球科学概论 | 23 | 电路分析基础 | 5 |
| 大学物理（上） | 8 | 毛泽东思想和中国特色社会主义理论体系概论 | 4 |
| 大学物理（下） | 15 | 军事理论 | 3 |
| 数字电子技术 | 2 | 古生物与地史 | 2 |
| C语言程序设计 | 2 | 岩石学 | 3 |
| 计算机语言程序设计 | 2 | 沉积岩与沉积相 | 2 |
| 大学计算机 | 1 | 海底与沉积盆地构造分析 | 3 |
| 海洋化学 | 1 | 海洋地质学 | 2 |
| 海洋生物 | 1 | 海洋调查技术 | 3 |
| 结晶学与矿物学 | 2 | | |

> 数量持续增长中。找不到你要的课？上传一份就有了。

</details>

---

## 🎯 功能

### 学生端

| 功能 | 说明 |
|------|------|
| **学号一键登录** | 无需注册、无需密码，首次登录自动建号 |
| **课程文件夹** | 首页按课程展示卡片，直接看到每门课有多少份资料 |
| **模糊搜索** | 按字序匹配 —— 搜「马原」也能命中「马克思主义基本原理」 |
| **类型筛选** | 真题 / 复习资料 / 课件 / 实验报告 等分类快速过滤 |
| **在线预览** | PDF 直接在浏览器打开；Word / PPT / Excel 自动转换后预览，不用先下载 |
| **下载** | 文件名还原为原始标题，非 PDF 也能正确保存成 `.docx` / `.pptx` |
| **资料上传** | 把自己的真题和笔记传上来，经审核后其他同学就能看到 |
| **手机适配** | 登录页、课程卡片、资源列表全端自适应，手机浏览器直接可用 |

### 管理端

| 功能 | 说明 |
|------|------|
| **数据仪表盘** | 资源数、用户数、下载量、访问量一屏概览 |
| **审核队列** | 审核上传内容，可重命名、指定课程与分类后放行 |
| **用户管理** | 账号列表（注册时间 / 最近访问时间），支持启用与禁用 |
| **课程与分类管理** | 维护课程目录与资料分类 |
| **公告管理** | 发布站内公告 |
| **访问统计** | 今日访问人数 / 访问量 / 累计访问量（同 IP 60 秒去重） |
| **实时日志** | 后台实时查看服务运行日志 |
| **移动端管理** | 手机访问后台自动跳转精简版，可直接审核与查看统计 |

---

## 🛠 技术栈

| 层面 | 技术 |
|------|------|
| 后端 | Node.js + Express |
| 前端 | Vue 3 + Element Plus + Vite |
| 数据库 | SQLite（sql.js，WAL 模式） |
| 认证 | JWT（Access Token + Refresh Token） |
| 部署 | Nginx + PM2 |
| CDN / HTTPS | Cloudflare |

**为低配服务器优化**：整套服务跑在一台 2C2G 的小机器上，堆内存限制 256MB、PM2 超 300MB 自动重启、SQLite WAL 读写不互斥、Nginx Gzip + 静态资源长缓存、下载限速 600KB/s 防止带宽被单个用户吃满。

---

## 🚀 本地开发

```bash
# 1. 后端
cd server
npm install
cp .env.example .env    # 按需修改 JWT_SECRET、DB_PATH 等
npm run seed            # 初始化数据库、初始管理员与默认分类
npm run dev             # → http://localhost:3000

# 2. 前端（另开一个终端）
cd client
npm install
npm run dev             # → http://localhost:5173
```

前端开发服务器已配置代理，直接访问 `http://localhost:5173` 即可。

> **初始管理员账号由 `server/seeds/seed.js` 创建**，请在生产部署后立即登录修改密码。

## ☁️ 部署

前置要求：Ubuntu 22.04 LTS、2C2G 或以上、root 或 sudo 权限。

```bash
# 一键部署（自动完成系统依赖安装、Swap 配置、前端构建、Nginx 反代、PM2 托管）
sudo chmod +x deploy/setup.sh
sudo ./deploy/setup.sh

# 配置 HTTPS（推荐）
sudo certbot --nginx -d your-domain.com
```

关键路径与产物：

- 后端由 PM2 托管，进程名 `resource-api`
- 上传文件存储在 `server/uploads/`，数据库为 `server/data/database.sqlite`
- 修改后端代码后执行 `pm2 restart resource-api`

## 📁 项目结构

```
resource-sharing-platform/
├── server/                    # Express 后端
│   ├── src/
│   │   ├── config/            # 配置与数据库（sql.js）
│   │   ├── middleware/        # 认证、上传、错误处理
│   │   ├── models/            # 数据模型
│   │   ├── routes/            # API 路由
│   │   ├── services/          # 业务逻辑
│   │   └── utils/             # 工具函数
│   ├── seeds/                 # 数据库种子（管理员、分类）
│   ├── data/                  # SQLite 数据库文件
│   └── uploads/               # 上传文件与预览缓存
├── client/                    # Vue 3 前端
│   ├── public/
│   └── src/
│       ├── api/               # 接口封装
│       ├── components/        # 通用组件
│       ├── layouts/           # 页面布局
│       ├── router/            # 路由（含移动端后台分流）
│       ├── stores/            # Pinia 状态管理
│       └── views/             # 页面（student / admin / login）
├── deploy/                    # 部署配置
│   ├── nginx.conf
│   ├── ecosystem.config.js
│   └── setup.sh
└── cugbshare-desktop/         # Windows 桌面客户端（pywebview + WebView2）
    ├── app.py                 #   主程序：窗口、下载引擎、JS 桥
    ├── ui.js                  #   注入到页面的下载管理面板
    ├── build.py               #   PyInstaller 打包脚本
    └── README.md              #   用法与排查
```

> 原微信小程序端（`mp/`，uni-app）已于 2026-09-25 移除，不再维护；
> 源码在 git 历史里（`git log -- mp` 可查）。

## 🔌 API 概览

所有接口以 `/api/v1` 为前缀，除登录外均需携带 JWT。

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/auth/login` | 登录 | 公开 |
| GET | `/auth/profile` | 个人信息 | 登录 |
| POST | `/auth/refresh` | 刷新 Token | 登录 |
| PUT | `/auth/password` | 修改密码 | 登录 |
| GET | `/resources` | 资源列表（支持搜索、筛选、分页） | 登录 |
| GET | `/resources/:id` | 资源详情 | 登录 |
| POST | `/resources` | 上传资源 | 登录 |
| GET | `/resources/:id/preview` | 在线预览 | 登录 |
| GET | `/resources/:id/download` | 下载 | 登录 |
| POST | `/resources/:id/review` | 审核资源 | 管理员 |
| GET | `/courses` | 课程列表 | 登录 |
| GET | `/categories` | 分类列表 | 登录 |
| GET | `/announcements` | 公告列表 | 登录 |
| GET | `/users` | 用户列表 | 管理员 |
| POST | `/users` | 创建用户 | 管理员 |
| GET | `/stats/overview` | 数据概览 | 管理员 |

---

## 🤝 参与贡献

欢迎提交 Issue 和 PR。如果你想为**自己的学校或班级**搭一个类似的平台，直接 Fork 本项目自建即可 —— 把课程目录、分类和页面文案换成你们学校的就行。

## ⚠️ 免责声明

- 本站资料来自同学分享与公开渠道，**不保证内容的真实性与准确性**，请自行甄别
- 所有资料**仅供校内学习交流使用，禁止任何商业用途**
- 本平台**永久免费**，为爱发电
- 如内容侵犯了您的合法权益，请通过站内联系方式告知，我们将在核实后尽快处理

---

<div align="center">
  <sub>Made with ❤️ by 北地同学 · <a href="https://cugbshare.asia">cugbshare.asia</a></sub>
</div>
