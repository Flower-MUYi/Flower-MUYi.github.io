# 🌐 FlowerMUYi Navigation Portal & Web Tools Studio

[![Website Status](https://img.shields.io/badge/Website-flowermuyi.me-blue?style=flat-square&logo=cloudflare)](https://flowermuyi.me)
[![GitHub Pages](https://img.shields.io/badge/Hosted%20With-GitHub%20Pages-blue?style=flat-square&logo=github)](https://Flower-MUYi.github.io)
[![Language](https://img.shields.io/badge/Language-Chinese%20(CN)-brightgreen?style=flat-square)](https://flowermuyi.me)
[![License](https://img.shields.io/badge/License-MIT-purple?style=flat-square)](LICENSE)

[**FlowerMUYi Navigation Portal**](https://flowermuyi.me) 是一个极简、高性能且现代感十足的中文个人导航门户与网络工具站，集成了手机/电脑/平板智能终端识别、**EdgeTunnel** 代理节点部署服务、**IP 质量与全量网络威胁检测系统** 以及 **关于我们 (About Us)** 开发者主页。

---

## 🌟 核心特性 (Key Features)

- 📱 **多端终端与设备识别 (Device Recognition)**:
  - 智能识别访客终端类型：**手机 (Mobile / Phone)**、**电脑 (Desktop / PC)** 与 **平板 (Tablet / iPad)**。
  - 深度检测触控交互支持（多点触控点数）、操作系统版本细分、浏览器内核与屏幕 DPR 分辨率。

- 🧮 **多功能科学计算器 (Multi-function Calculator)**:
  - 基于 MathLive 所见即所得公式输入与 KaTeX 渲染。
  - 集成 Nerdamer 符号代数 CAS 引擎，支持代数运算、微积分、方程求解、动态参数滑块与 2D 函数绘图。

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
├── index.html         # 根入口 (多端终端设备识别与分发)
├── CNAME              # 自定义域名配置 (flowermuyi.me)
├── LICENSE            # MIT 开源许可证
├── README.md          # 项目文档说明
├── pc/                # 电脑端 (PC / Desktop) 版本目录
│   ├── index.html     # 电脑端导航工作台首页
│   ├── calculator.html# 多功能科学计算器 (CAS & 绘图)
│   ├── ip.html        # 电脑端 IP 质量与设备审计系统
│   └── about.html     # 电脑端 关于我们
├── mobile/            # 手机端 (Mobile / Phone) 版本目录 (预留)
└── tablet/            # 平板端 (Tablet / iPad) 版本目录 (预留)
```

---

## 🛠️ 导航入口与按钮 (Portal Navigation Links)

| 功能模块 (Feature) | 链接 | 说明 (Description) |
| :--- | :--- | :--- |
| **多功能计算器** | [`/pc/calculator.html`](./pc/calculator.html) | MathLive + CAS 符号计算 + 2D 函数绘图 |
| **EdgeTunnel** | [External Link](https://edgetunnel.flowermuyi.me/login) | Cloudflare Worker 云加速代理 |
| **IP 检测 (IP Check)** | [`/pc/ip.html`](./pc/ip.html) | IP 质量、威胁情报、多端设备与 WebRTC 检测 |
| **关于我们 (About Us)** | [`/pc/about.html`](./pc/about.html) | GitHub: [Flower-MUYi](https://github.com/Flower-MUYi) / Email: [PineMuyi@gmail.com](mailto:PineMuyi@gmail.com) |

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
