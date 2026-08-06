# 🌐 FlowerMUYi Navigation Portal & Web Tools Studio

[![Website Status](https://img.shields.io/badge/Website-flowermuyi.me-blue?style=flat-square&logo=cloudflare)](https://flowermuyi.me)
[![GitHub Pages](https://img.shields.io/badge/Hosted%20With-GitHub%20Pages-blue?style=flat-square&logo=github)](https://Flower-MUYi.github.io)
[![Language](https://img.shields.io/badge/Language-CN%20%7C%20EN-brightgreen?style=flat-square)](https://flowermuyi.me)
[![License](https://img.shields.io/badge/License-MIT-purple?style=flat-square)](LICENSE)

[**FlowerMUYi Navigation Portal**](https://flowermuyi.me) 是一个极简、高性能且现代感十足的个人导航门户与网络工具站，集成了智能双语识别、**EdgeTunnel** 代理节点部署服务、**IP 质量与全量网络威胁检测系统** 以及 **关于我们 (About Us)** 开发者主页。

---

## 🌟 核心特性 (Key Features)

- 🤖 **智能语言识别 (Auto Language Redirection)**:
  - 首次访问自动检测浏览器首选语言（中文 `zh` 自动进入 `cn/` 目录，其他语言自动进入 `en/` 目录）。
  - 支持手动切换语言，并通过 `localStorage` 记忆用户的偏好设置。

- ⚡ **EdgeTunnel 直达 (External Service Link)**:
  - 快捷入口直达 Cloudflare Worker 代理与网络加速控制台: [`edgetunnel.flowermuyi.me/login`](https://edgetunnel.flowermuyi.me/login)。

- 🛡️ **IP 质量与全量网络威胁检测 (IP Quality & Threat Inspection)**:
  - 并发对接权威情报 API (`ipdata.co` 与 `ipapi.is`)。
  - 深度审计 IP 的 ASN/ISP 归属、地理位置 (Leaflet 地图打点)、欺诈风险评分 (Fraud Score)。
  - 识别 Proxy / VPN / Tor / Datacenter 标识以及浏览器 WebRTC 真实 IP 泄漏测试。

- 👤 **关于我们 (About Us Page)**:
  - 展示开发者信息、技术栈、GitHub 开源主页及邮件联系管道。

---

## 📂 项目目录结构 (Directory Structure)

```text
Flower-MUYi.github.io/
├── index.html         # 根入口 (负责浏览器语言识别与重定向)
├── CNAME              # 自定义域名配置 (flowermuyi.me)
├── LICENSE            # MIT 开源许可证
├── README.md          # 项目文档说明
├── cn/                # 中文版本目录
│   ├── index.html     # 中文导航工作台首页
│   ├── ip.html        # 中文 IP 质量与威胁检测系统
│   └── about.html     # 中文 关于我们
└── en/                # 英文版本目录
    ├── index.html     # English Navigation Dashboard
    ├── ip.html        # English IP Quality & Threat Inspection
    └── about.html     # English About Us Page
```

---

## 🛠️ 导航入口与按钮 (Portal Navigation Links)

| 功能模块 (Feature) | 中文链接 | English Link | 说明 (Description) |
| :--- | :--- | :--- | :--- |
| **EdgeTunnel** | [External Link](https://edgetunnel.flowermuyi.me/login) | [External Link](https://edgetunnel.flowermuyi.me/login) | Cloudflare Worker 云加速代理 |
| **IP 检测 (IP Check)** | [`/cn/ip.html`](./cn/ip.html) | [`/en/ip.html`](./en/ip.html) | IP 质量、威胁情报与 WebRTC 检测 |
| **关于我们 (About Us)** | [`/cn/about.html`](./cn/about.html) | [`/en/about.html`](./en/about.html) | GitHub: [Flower-MUYi](https://github.com/Flower-MUYi) / Email: [PineMuyi@gmail.com](mailto:PineMuyi@gmail.com) |

---

## 👤 联系方式 & 开发者 (Contact & Developer)

- **官方域名**: [flowermuyi.me](https://flowermuyi.me)
- **GitHub 主页**: [https://github.com/Flower-MUYi](https://github.com/Flower-MUYi)
- **电子邮箱**: [PineMuyi@gmail.com](mailto:PineMuyi@gmail.com)

---

## 🚀 本地开发与测试 (Local Development)

使用任意静态文件服务器（如 Python 或 Node.js）本地开启预览：

```bash
# 使用 Python 3 本地启动 8080 端口
python -m http.server 8080

# 或使用 Node.js
npx serve .
```

访问 `http://localhost:8080` 即可体验自动语言识别及完整导航服务。
