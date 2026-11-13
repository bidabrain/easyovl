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

控制台镜像由 GitHub Actions 自动构建并发布在 `ghcr.io/bidabrain/easyovl`，不需要自己编译，**只需要一个 `docker-compose.yml` 文件**。

新建一个空文件夹（例如 NAS 上的 `/volume1/docker/easyovl`），进入后下载 compose 文件并启动：

```bash
curl -fsSLO https://raw.githubusercontent.com/bidabrain/easyovl/main/docker-compose.yml
```

```bash
docker compose up -d
```

> 群晖等 NAS 上命令前通常要加 `sudo`；Windows PowerShell 里请把 `curl` 写成 `curl.exe`。

然后打开 `http://本机或NAS的IP:8090`，第一次进入时设置一个**控制台管理密码**。配置、生成的 compose 文件和备份都存放在同一文件夹下的 `data/`。

- 也可以在群晖 Container Manager / 威联通 Container Station / Portainer 里「新建项目」，把 `docker-compose.yml` 的内容粘贴进去。
- Windows 也可以克隆本仓库后双击 `start.bat`，macOS / Linux 运行 `./start.sh`（同样是拉取镜像，不编译）。
- 控制台默认允许局域网访问。只想让本机访问时，在同一文件夹建 `.env` 写入 `EASYOVL_BIND=127.0.0.1`；改端口用 `EASYOVL_PORT=`。
- NAS / 服务器需要 **x86_64（amd64）** 架构：控制台镜像支持 ARM，但 Overleaf 镜像只有 amd64 版本。
- 群晖的 Docker 数据目录（`/volume1/@docker`）会被自动识别，沙盒编译无需额外设置。

**升级控制台**：

```bash
docker compose pull && docker compose up -d
```

自己修改控制台代码时，用开发版 compose 在本地编译：

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

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

**隧道令牌**模式下，请在 Cloudflare 隧道的「路由 → 已发布的应用程序」（旧版界面叫「公共主机名」）里添加域名，服务填 `http://sharelatex:80`。注意：

- 是 `http` 不是 `https`：Overleaf 本身只提供 HTTP，HTTPS 由 Cloudflare 负责，填 https 会出现 502。
- 主机是 `sharelatex` 不是 `localhost`：cloudflared 运行在自己的容器里，`localhost` 指的是它自己。
- 控制台「外网访问」页的「公网域名」要填同一个域名，Overleaf 的站点地址才会正确。

如果你是在宿主机上自己运行 cloudflared（「外网访问」选关闭），服务则填 `http://localhost:8080`，并在「站点」页手动填写站点地址。

> ⚠️ 公网开放后任何人都能看到登录页。建议保持「开放注册」关闭，只由管理员创建账号；或者用「允许注册的邮箱域名」做限制。

## 编译方式

- **内置编译**（默认）：直接在 Overleaf 容器里编译，速度最快。默认使用镜像自带的精简 TeX Live，缺少很多宏包（比如 ctex 中文支持）。
  - 勾选「使用完整版 TeX Live」后，应用时控制台会下载 `texlive/texlive:latest-full`，把其中的 TeX Live 复制到数据卷 `overleaf_texlive` 并挂载给 Overleaf，然后删除镜像节省空间。只在首次或更换来源镜像时执行一次（约 10–30 分钟），之后编译和精简版一样快，宏包齐全。
  - 注意内置编译不隔离用户，开启 `-shell-escape` 时相当于让所有用户能在 Overleaf 容器里执行命令。
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

**NAS 的 CPU 不支持 AVX（赛扬 J4125、J3455 等）？** 官方 MongoDB 5.0 以上需要 AVX，而 Overleaf 要求 MongoDB 8.0。在「高级 → MongoDB」有三种选择：

- **自动（推荐，默认）**：CPU 支持 AVX 时用官方 `mongo:8.0`，不支持时自动改用无 AVX 版本。
- **官方 MongoDB**：始终用官方镜像。
- **无 AVX 版本**：始终用社区编译的 [`devferris/mongodb-no-avx`](https://hub.docker.com/r/devferris/mongodb-no-avx)（基于 [Axcient/mongod-avx](https://github.com/Axcient/mongod-avx) 补丁构建，**非 MongoDB 官方**）。不放心的话可以把镜像名换成自己构建的镜像。

页面上会显示检测到的 CPU 型号、是否支持 AVX，以及实际会使用的镜像。两种镜像的数据格式相同，切换后保存并应用即可。

**忘记控制台密码？** 删除 `data/auth.json`，然后重启控制台：

```bash
docker restart easyovl-manager
```

**只想让本机打开控制台？** 在 `docker-compose.yml` 同一文件夹建 `.env`，写入 `EASYOVL_BIND=127.0.0.1`，再运行 `docker compose up -d`。（Overleaf 本身也默认允许局域网访问，可以在「站点」页改为仅本机。）

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

> 控制台能操作 Docker，相当于拥有本机管理员权限，所以必须设置密码登录（连续输错会被临时锁定）。外网隧道只转发 Overleaf，不会暴露控制台；请不要在路由器上把控制台端口（8090）映射到公网。

## 许可

本项目以 AGPL-3.0 发布。Overleaf 及 Overleaf CE+ 版权归其各自作者所有。
