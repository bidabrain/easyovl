# EasyOVL

一键在本地用 Docker 部署 [Overleaf 扩展社区版 (CE+)](https://github.com/yu-i-i/overleaf-cep)，所有配置都在网页里完成，并且可以通过 **Cloudflare Tunnel** 把 Overleaf 安全地分享到公网。

- 🖱️ **图形化控制台**：站点、注册、编译、邮件、外网访问等全部用网页设置，不用手写 compose / env 文件
- 🚀 **一条命令启动**：控制台自动生成并管理 Overleaf + MongoDB + Redis（+ cloudflared）
- 🌐 **外网访问三种方式**：快速隧道（无需账号）、自动配置（填 API Token 自动建隧道和 DNS）、隧道令牌
- 📦 **沙盒编译**：可选每次编译在独立的 TeX Live 容器中运行，宏包齐全
- 👤 **用户管理**：查看用户、创建用户 / 管理员
- 💾 **备份与恢复**：一键备份数据库和项目文件，迁移到新电脑也方便
- 📜 **日志查看**、版本升级（从 Docker Hub 读取可用版本）

## 快速开始

### 1. 安装 Docker

- **Windows / macOS**：安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)，启动后等待左下角显示 *Engine running*。
  Windows 需要使用 WSL 2 后端（默认就是）。
- **Linux**：安装 [Docker Engine](https://docs.docker.com/engine/install/) 和 compose 插件。

建议给 Docker 至少分配 4 GB 内存。

### 2. 启动控制台

```bash
git clone https://github.com/bidabrain/easyovl.git
```

```bash
cd easyovl
```

- **Windows**：双击 `start.bat`
- **macOS / Linux**：

```bash
./start.sh
```

浏览器会自动打开 <http://localhost:8090>。第一次进入时设置一个**控制台管理密码**。

### 在 NAS / 服务器上部署

群晖、威联通、Unraid、普通 Linux 服务器都可以，要求 **x86_64（amd64）** 架构（Overleaf 镜像没有 ARM 版本）以及 Docker + compose 插件。SSH 登录后：

```bash
git clone https://github.com/bidabrain/easyovl.git && cd easyovl
```

控制台默认只允许本机访问，NAS 上需要让局域网能打开：

```bash
echo "EASYOVL_BIND=0.0.0.0" > .env
```

```bash
sudo docker compose up -d --build
```

然后在局域网电脑上打开 `http://NAS的IP:8090`。群晖的 Docker 数据目录（`/volume1/@docker`）会被自动识别，沙盒编译无需额外设置。

### 3. 启动 Overleaf

1. 在「站点」页确认端口（默认 `8080`），在「编译」页选择编译方式。
2. 回到「概览」，点击 **启动 / 应用配置**。首次启动要下载约 2–3 GB 的镜像，底部会显示实时进度。
3. 启动完成后（Overleaf 初始化约需 1–3 分钟），概览页会提示打开 `http://localhost:8080/launchpad` 创建**第一个管理员账号**。
4. 之后用这个账号登录 Overleaf 即可。

## 外网访问（Cloudflare Tunnel）

在「外网访问」页选择一种方式，然后点「保存并应用」：

| 方式 | 需要什么 | 地址 | 适合 |
| --- | --- | --- | --- |
| 快速隧道 | 什么都不需要 | 随机的 `xxx.trycloudflare.com`，每次重启都会变 | 临时给别人看一下 |
| 自动配置（推荐） | 托管在 Cloudflare 的域名 + API Token | 固定，例如 `https://overleaf.example.com` | 长期使用 |
| 隧道令牌 | 在 Zero Trust 控制台手动建好的隧道 | 固定 | 已经熟悉 Cloudflare 的用户 |

**自动配置**所需的 API Token 权限（在 [API 令牌](https://dash.cloudflare.com/profile/api-tokens) 页「创建自定义令牌」）：

- 帐户 · Cloudflare Tunnel · 编辑
- 帐户 · 帐户设置 · 读取
- 区域 · DNS · 编辑
- 区域 · 区域 · 读取

控制台会自动创建隧道、配置入口规则（`你的域名 → http://sharelatex:80`）并添加 DNS 记录，Overleaf 的站点地址也会自动设为该域名。

**隧道令牌**模式下，请在 Cloudflare 隧道的「公共主机名」里把服务设为 `HTTP`，URL 填 `sharelatex:80`。

> ⚠️ 公网开放后任何人都能看到登录页。建议保持「开放注册」关闭，只由管理员创建账号；或者用「允许注册的邮箱域名」做限制。

## 编译方式

- **内置编译**（默认）：使用 Overleaf 镜像自带的精简 TeX Live，启动快，但缺少很多宏包（比如 ctex 中文支持）。
- **沙盒编译**（推荐）：每次编译在独立的 `texlive/texlive` 容器中运行，宏包齐全，用户之间也互相隔离。首次需要下载 TeX Live 镜像（`latest-full` 约 5 GB）。可以同时配置多个 TeX Live 版本，用户在项目菜单中选择。

写中文文档时请在 Overleaf 的项目菜单里把编译器设为 **XeLaTeX** 或 **LuaLaTeX**。

## 数据存放

| 内容 | 位置 |
| --- | --- |
| 控制台配置、生成的 compose 文件、备份 | 本项目的 `data/` 目录 |
| 项目文件 | Docker 卷 `overleaf_data` |
| 数据库 | Docker 卷 `overleaf_mongo` |
| Redis | Docker 卷 `overleaf_redis` |

「移除容器」**不会**删除数据卷。要彻底删除数据，需要手动执行 `docker volume rm overleaf_data overleaf_mongo overleaf_redis`。

### 备份与迁移

在「备份」页点击「立即备份」，会在 `data/backups/<时间>/` 下生成：

- `mongo.archive.gz`：数据库
- `overleaf_data.tar.gz`：项目文件（不含编译缓存）

迁移到新电脑：在新电脑上部署本项目，把备份目录复制到 `data/backups/` 下，在「备份」页点击「恢复」。

## 常见问题

**忘记控制台密码？** 删除 `data/auth.json`，然后重启控制台：

```bash
docker restart easyovl-manager
```

**想让局域网内其他电脑也能打开控制台？** 复制 `.env.example` 为 `.env`，设置 `EASYOVL_BIND=0.0.0.0`，然后重新运行启动脚本。（Overleaf 本身默认就允许局域网访问，可以在「站点」页改为仅本机。）

**沙盒编译报找不到目录？** 沙盒编译依赖 Docker 守护进程能访问 `<Docker 数据目录>/volumes/overleaf_data/_data`，控制台会通过 `docker info` 自动识别数据目录。如果你使用的是 rootless Docker 等特殊环境，请在「高级」页用 `SANDBOXED_COMPILES_HOST_DIR_COMPILES` / `SANDBOXED_COMPILES_HOST_DIR_OUTPUT` 覆盖为实际路径。

**LDAP / SAML / OIDC 登录、Git 集成等功能？** 在「高级 → 自定义环境变量」里按 [CE+ Wiki](https://github.com/yu-i-i/overleaf-cep/wiki) 添加对应变量。

**升级 Overleaf？** 先备份，然后在「站点 → Overleaf 版本」选择新版本，保存并应用。

## 工作原理

```
浏览器 ──► easyovl-manager (控制台, :8090)
                │  通过 /var/run/docker.sock 调用 docker compose
                ▼
        compose 项目 "overleaf"（网络 overleaf-net）
        ├── sharelatex  (overleafcep/sharelatex, :8080)
        ├── mongo       (单节点副本集)
        ├── redis
        └── cloudflared (可选) ──► Cloudflare ──► 公网
```

控制台本身是一个无第三方依赖的 Node.js 程序（`manager/`），配置保存在 `data/config.json`，每次应用时生成 `data/stack/docker-compose.yml`。

> 控制台能操作 Docker，相当于拥有本机管理员权限，因此默认只监听 `127.0.0.1`，并且需要密码登录。不要把控制台端口暴露到公网。

## 许可

本项目以 AGPL-3.0 发布。Overleaf 及 Overleaf CE+ 版权归其各自作者所有。
