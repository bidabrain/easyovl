// Shared i18n for the EasyOVL console (browser + server).
// Chinese is the source language: strings are written in Chinese in the code
// and looked up here for English. A missing entry falls back to Chinese.
// Placeholders use {name} and are filled from the vars object.

export const LANGS = ['zh', 'en']

export const EN = {
  // ---------------------------------------------------------------- shell
  'EasyOVL 控制台': 'EasyOVL Console',
  '管理密码': 'Console password',
  '再次输入': 'Repeat password',
  '登录': 'Sign in',
  '概览': 'Overview',
  '站点': 'Site',
  '功能': 'Features',
  '编译': 'Compiling',
  '邮件': 'Email',
  '外网访问': 'Public access',
  '用户': 'Users',
  '日志': 'Logs',
  '备份': 'Backups',
  '高级': 'Advanced',
  '切换主题': 'Theme',
  '退出': 'Sign out',
  '首次使用，请设置控制台管理密码。': 'First time here: set a password for this console.',
  '请输入控制台管理密码。': 'Enter the console password.',
  '设置密码并进入': 'Set password and continue',
  '两次输入的密码不一致': 'The passwords do not match',
  '请先登录': 'Please sign in first',

  // ---------------------------------------------------------------- overview
  '启动 / 应用配置': 'Start / apply settings',
  '重启': 'Restart',
  '停止': 'Stop',
  '还没有启动过 Overleaf。先看看': 'Overleaf has not been started yet. Check the',
  '和': 'and',
  '设置，然后点击右上角「启动 / 应用配置」。首次启动需要下载约 2–3 GB 的镜像。':
    'settings, then click “Start / apply settings” at the top right. The first start downloads about 2–3 GB of images.',
  '快速隧道地址已变化，但 Overleaf 的站点地址还是旧的。点击「启动 / 应用配置」更新。':
    'The quick tunnel address changed, but Overleaf still uses the old site URL. Click “Start / apply settings” to update it.',
  '访问地址': 'Addresses',
  '容器': 'Containers',
  '服务': 'Service',
  '状态': 'Status',
  '镜像': 'Image',
  '尚未创建容器': 'No containers yet',
  '拉取镜像更新': 'Pull image updates',
  '移除容器（保留数据）': 'Remove containers (keep data)',
  '运行中': 'Running',
  '已停止': 'Stopped',
  '已创建': 'Created',
  '重启中': 'Restarting',
  '已暂停': 'Paused',
  '异常': 'Dead',
  'MongoDB 初始化': 'MongoDB init',
  '已连接': 'Connected',
  '未连接': 'Not connected',
  '未部署': 'Not deployed',
  '正在启动…': 'Starting…',
  '已关闭': 'Off',
  '（未运行）': ' (not running)',
  '（启动后显示）': '(shown after start)',
  '本机': 'This machine',
  '公网': 'Public',
  '站点地址': 'Site URL',
  '未知': 'unknown',
  '未知错误': 'unknown error',
  '无法连接 Docker：<code>{error}</code><br>请确认 Docker Desktop 已启动，并且控制台容器挂载了 <code>/var/run/docker.sock</code>。':
    'Cannot connect to Docker: <code>{error}</code><br>Make sure Docker is running and the console container mounts <code>/var/run/docker.sock</code>.',
  'Overleaf 已就绪！还没有管理员账号，请打开 {link} 创建第一个管理员。':
    'Overleaf is ready! There is no admin account yet. Open {link} to create the first admin.',
  '已完成（一次性任务，退出是正常的）': 'Completed (one-shot task, exiting is expected)',
  '初始化失败：{status}': 'Initialization failed: {status}',
  '正在初始化数据库…': 'Initializing the database…',
  '重新运行': 'Run again',
  '移除全部容器？数据卷会保留，之后可以重新启动。': 'Remove all containers? Data volumes are kept and you can start again later.',
  '停止 Overleaf？正在编辑的用户会断开连接。': 'Stop Overleaf? Users who are editing will be disconnected.',
  '有未保存的修改，是否先保存再应用？': 'You have unsaved changes. Save them before applying?',

  // ---------------------------------------------------------------- site
  '基本信息': 'Basics',
  '站点名称': 'Site name',
  '导航栏标题': 'Navigation bar title',
  '管理员联系邮箱': 'Admin contact email',
  '站点地址（留空自动）': 'Site URL (leave empty for automatic)',
  '当前生效：': 'In effect:',
  '端口与网络': 'Port and network',
  '本机端口': 'Host port',
  '监听范围': 'Listen on',
  '局域网可访问 (0.0.0.0)': 'Reachable from LAN (0.0.0.0)',
  '仅本机 (127.0.0.1)': 'This machine only (127.0.0.1)',
  '位于反向代理 / 隧道之后（推荐开启）': 'Behind a reverse proxy / tunnel (recommended)',
  '仅 HTTPS Cookie（开启后无法通过本地 http 地址登录）': 'HTTPS-only cookies (you can no longer sign in via a local http address)',
  'Overleaf 版本': 'Overleaf version',
  '镜像仓库': 'Image repository',
  '版本标签': 'Version tag',
  '正在从 Docker Hub 读取版本列表…': 'Loading versions from Docker Hub…',
  '升级前请先在「备份」页做一次备份。CE+ 6.x 之前的版本需按官方说明先升级到 5.5.6。':
    'Make a backup on the Backups page before upgrading. Versions older than CE+ 6.x must first be upgraded to 5.5.6 following the official notes.',
  '最新版本：{name}（点击输入框可选择）': 'Latest version: {name} (click the field to choose)',
  '无法读取版本列表': 'Could not load the version list',
  '无法读取版本列表：{error}': 'Could not load the version list: {error}',

  // ---------------------------------------------------------------- features
  '注册与账户': 'Registration and accounts',
  '开放注册页面（任何人可以自行注册）': 'Open registration page (anyone can sign up)',
  '允许注册的邮箱域名（逗号分隔，可用 *.example.com，留空不限制）':
    'Email domains allowed to register (comma separated, *.example.com allowed, empty = any)',
  '不要求邮箱验证': 'Do not require email confirmation',
  '编辑器功能': 'Editor features',
  '允许从历史版本恢复文件 / 项目': 'Allow restoring files / projects from history',
  'Word / Markdown 导入导出（Pandoc）': 'Word / Markdown import and export (Pandoc)',
  '生成图片缩略图': 'Generate image previews',
  '可链接的文件类型': 'Linkable file types',
  '可选：project_file, project_output_file, url, zotero': 'Options: project_file, project_output_file, url, zotero',
  '最大上传大小 (MB)': 'Max upload size (MB)',

  // ---------------------------------------------------------------- compile
  '编译方式': 'Compile mode',
  '内置编译': 'Built-in',
  '直接在 Overleaf 容器里编译，速度最快。默认是精简 TeX Live，可在下方换成完整版。所有用户共享同一个容器。':
    'Compiles inside the Overleaf container, the fastest option. Uses a minimal TeX Live by default; switch to the full one below. All users share one container.',
  '沙盒编译（推荐）': 'Sandboxed (recommended)',
  '每次编译在独立的 TeX Live 容器中运行，宏包齐全、更安全。首次需下载 TeX Live 镜像（完整版约 5 GB）。':
    'Every compile runs in its own TeX Live container: all packages, and safer. The TeX Live image (about 5 GB for the full one) is downloaded once.',
  '内置 TeX Live': 'Built-in TeX Live',
  '使用完整版 TeX Live（宏包齐全，支持 ctex 中文）': 'Use the full TeX Live (all packages, including ctex for Chinese)',
  '应用时会下载下方的 TeX Live 镜像（完整版约 5 GB），把其中的 TeX Live 复制到数据卷':
    'When applied, the TeX Live image below (about 5 GB for the full one) is downloaded and its TeX Live is copied into the volume',
  '并挂载给 Overleaf，之后删除镜像以节省空间。只在首次或更换镜像时进行，约需 10~30 分钟。':
    'which is mounted into Overleaf; the image is then deleted to save space. This happens only the first time or when the image changes, and takes about 10–30 minutes.',
  'TeX Live 来源镜像': 'TeX Live source image',
  'texlive/texlive:latest-full（完整，含中文）、texlive/texlive:latest-medium（较小，不含中文宏包）、texlive/texlive:TL2024-historic（固定年份）':
    'texlive/texlive:latest-full (full, includes Chinese), texlive/texlive:latest-medium (smaller, no Chinese packages), texlive/texlive:TL2024-historic (fixed year)',
  'TeX Live 镜像': 'TeX Live images',
  '镜像列表（逗号分隔）': 'Images (comma separated)',
  '例：texlive/texlive:latest-full, texlive/texlive:TL2024-historic': 'e.g. texlive/texlive:latest-full, texlive/texlive:TL2024-historic',
  '显示名称（与镜像一一对应）': 'Display names (one per image)',
  '默认镜像（留空用第一个）': 'Default image (empty = first)',
  '编译选项': 'Compile options',
  '允许 -shell-escape（minted 等宏包需要；仅在信任所有用户时开启）':
    'Allow -shell-escape (needed by minted etc.; only enable if you trust every user)',
  '编译超时（秒）': 'Compile timeout (seconds)',

  // ---------------------------------------------------------------- email
  '启用 SMTP 发信（用于邀请协作者、找回密码）': 'Send email via SMTP (for invites and password resets)',
  '发件地址': 'From address',
  'SMTP 服务器': 'SMTP server',
  '端口': 'Port',
  '用户名': 'Username',
  '密码': 'Password',
  '邮件页脚': 'Email footer',
  '使用 SSL/TLS 直连（端口 465 时勾选）': 'Use SSL/TLS directly (tick for port 465)',
  '不使用 STARTTLS': 'Do not use STARTTLS',
  '校验服务器证书': 'Verify the server certificate',
  '已设置（留空保持不变）': 'Set (leave empty to keep)',

  // ---------------------------------------------------------------- tunnel
  '通过 Cloudflare Tunnel 把 Overleaf 安全地发布到公网，不需要公网 IP，也不需要在路由器上开端口。':
    'Publish Overleaf to the internet safely through Cloudflare Tunnel: no public IP and no router port forwarding needed.',
  '关闭': 'Off',
  '只在本机 / 局域网访问。': 'Access from this machine / LAN only.',
  '快速隧道': 'Quick tunnel',
  '无需账号，随机分配 *.trycloudflare.com 地址，每次重启都会变。适合临时使用。':
    'No account needed. Gets a random *.trycloudflare.com address that changes on every restart. Good for temporary use.',
  '自动配置（推荐）': 'Automatic (recommended)',
  '填写 API Token，自动创建隧道和 DNS，固定使用你自己的域名。':
    'Enter an API token; the tunnel and DNS are created automatically on your own domain.',
  '隧道令牌': 'Tunnel token',
  '已在 Cloudflare 控制台建好隧道，只需粘贴令牌。': 'You already created a tunnel in the Cloudflare dashboard; just paste its token.',
  '当前地址：': 'Current address:',
  '把隧道地址设为 Overleaf 的站点地址（邀请邮件等链接会使用它；地址变化后需重新应用）':
    'Use the tunnel address as Overleaf’s site URL (used in invite links etc.; re-apply after it changes)',
  '自动配置': 'Automatic',
  '打开': 'Open',
  'Cloudflare → API 令牌': 'Cloudflare → API Tokens',
  '，点击「创建令牌」→「创建自定义令牌」。': ', click “Create Token” → “Create Custom Token”.',
  '添加权限：': 'Add these permissions:',
  '帐户 · Cloudflare Tunnel · 编辑': 'Account · Cloudflare Tunnel · Edit',
  '帐户 · 帐户设置 · 读取': 'Account · Account Settings · Read',
  '区域 · DNS · 编辑': 'Zone · DNS · Edit',
  '区域 · 区域 · 读取': 'Zone · Zone · Read',
  '把生成的令牌粘贴到下面，点击「验证并读取域名」。': 'Paste the new token below and click “Verify and load domains”.',
  '验证并读取域名': 'Verify and load domains',
  'Cloudflare 帐户': 'Cloudflare account',
  '域名': 'Domain',
  '子域名': 'Subdomain',
  '隧道名称': 'Tunnel name',
  '将发布到：': 'Will be published at:',
  '在': 'In',
  '→ 网络 → 隧道，创建一个 Cloudflared 隧道。': '→ Networks → Tunnels, create a Cloudflared tunnel.',
  '在隧道的「路由 → 添加路由 → 已发布的应用程序」（旧版界面叫「公共主机名」）中添加你的域名，服务填':
    'Under the tunnel’s “Routes → Add route → Published application” (called “Public hostname” in the old UI), add your domain with the service',
  '。注意是': '. Note: it is',
  '不是 https，主机是': 'not https, and the host is',
  '不是': 'not',
  '。': '.',
  '在隧道「概览」页的安装命令里，复制': 'From the install command on the tunnel’s “Overview” page, copy the string after',
  '后面的那一串，粘贴到下面，并在「公网域名」填同一个域名。': ', paste it below, and enter the same domain under “Public domain”.',
  '公网域名': 'Public domain',
  '正在验证…': 'Verifying…',
  '令牌看不到任何帐户，请检查「帐户设置 · 读取」权限': 'The token cannot see any account. Check the “Account Settings · Read” permission.',
  '令牌看不到任何域名，请检查「区域 · 区域 · 读取」权限，并确认域名已接入 Cloudflare':
    'The token cannot see any domain. Check the “Zone · Zone · Read” permission and that the domain is on Cloudflare.',
  '验证成功：{accounts} 个帐户，{zones} 个域名。选择后点击「保存并应用」。':
    'Verified: {accounts} account(s), {zones} domain(s). Choose them, then click “Save and apply”.',

  // ---------------------------------------------------------------- users
  '刷新': 'Refresh',
  '创建用户': 'Create user',
  '管理员': 'Admin',
  '创建': 'Create',
  '创建后会得到一个设置密码的链接（7 天内有效），发给对方即可。链接过期或忘记密码时，在下方列表点「密码链接」重新生成。没有配置邮件时 Overleaf 不会发邮件，请手动把链接发给对方。':
    'Creating a user gives you a set-password link (valid for 7 days) to send to them. If it expires or they forget their password, click “Password link” in the list below for a new one. Without email set up, Overleaf sends no mail, so send the link yourself.',
  '用户列表': 'Users',
  '邮箱': 'Email',
  '姓名': 'Name',
  '角色': 'Role',
  '注册时间': 'Signed up',
  '最近登录': 'Last sign-in',
  '加载中…': 'Loading…',
  '还没有用户': 'No users yet',
  '密码链接': 'Password link',
  '删除': 'Delete',
  '已创建': 'Created',
  '已为': 'New link for',
  '设置密码链接（7 天内有效，发给对方）：': 'Set-password link (valid for 7 days, send it to them):',
  '本机访问：': 'From this machine:',
  '该用户的项目如何处理': 'What to do with this user’s projects',
  '项目一并删除': 'Delete their projects too',
  '项目转给 {email}': 'Give projects to {email}',
  '确认删除': 'Confirm delete',
  '取消': 'Cancel',
  '项目将转给 {email}': 'Their projects will be given to {email}',
  '该用户的所有项目也会被删除': 'All of their projects will be deleted too',
  '确定删除用户 {email}？\n{what}。': 'Delete user {email}?\n{what}.',
  '已删除 {email}': 'Deleted {email}',
  '，项目已转给 {email}': ', projects given to {email}',

  // ---------------------------------------------------------------- logs
  '自动刷新': 'Auto refresh',

  // ---------------------------------------------------------------- backups
  '立即备份': 'Back up now',
  '备份包含 MongoDB 数据库和全部项目文件，保存在本项目的': 'A backup contains the MongoDB database and all project files, stored in the project’s',
  '目录。迁移到新电脑时，把备份目录复制过去，在这里点击「恢复」即可。':
    'folder. To move to a new machine, copy the backup folder over and click “Restore” here.',
  '时间': 'Time',
  '版本': 'Version',
  '文件': 'Files',
  '暂无备份': 'No backups yet',
  '恢复': 'Restore',
  '用备份 {name} 覆盖当前全部数据？\n\n当前的数据库和项目文件会被替换，无法撤销。建议先做一次新备份。':
    'Overwrite all current data with backup {name}?\n\nThe current database and project files will be replaced. This cannot be undone. Consider making a new backup first.',
  '永久删除备份 {name}？此操作无法撤销。': 'Permanently delete backup {name}? This cannot be undone.',

  // ---------------------------------------------------------------- advanced
  '自定义环境变量': 'Custom environment variables',
  '每行一个': 'One',
  '，会覆盖上面的设置。LDAP / SAML / OIDC 登录、Git 集成等 CE+ 功能都可以在这里配置，参见':
    'per line; these override the settings above. CE+ features such as LDAP / SAML / OIDC login and Git integration are configured here, see the',
  '# 例：OIDC 登录 # EXTERNAL_AUTH=oidc # OVERLEAF_OIDC_ISSUER=https://accounts.example.com':
    '# e.g. OIDC login\n# EXTERNAL_AUTH=oidc\n# OVERLEAF_OIDC_ISSUER=https://accounts.example.com',
  '自动（推荐）': 'Automatic (recommended)',
  'CPU 支持 AVX 时用官方 MongoDB，不支持时自动改用无 AVX 版本。':
    'Uses official MongoDB when the CPU has AVX, and the no-AVX build otherwise.',
  '官方 MongoDB': 'Official MongoDB',
  '始终使用官方镜像。需要 CPU 支持 AVX，否则数据库无法启动。':
    'Always use the official image. Needs a CPU with AVX, otherwise the database will not start.',
  '无 AVX 版本': 'No-AVX build',
  '始终使用社区编译的无 AVX 版本（第三方构建，非 MongoDB 官方），适合赛扬 / 凌动等 NAS CPU。':
    'Always use the community no-AVX build (third-party, not official MongoDB), for NAS CPUs such as Celeron / Atom.',
  '官方镜像': 'Official image',
  '无 AVX 版本镜像': 'No-AVX image',
  '工具镜像（mongosh / 备份）': 'Tools image (mongosh / backups)',
  '数据格式相同，切换后保存并应用即可，数据不会丢失。工具镜像只用于初始化、查看用户和备份，不需要 AVX。':
    'The data format is the same: switch, then save and apply; no data is lost. The tools image is only used for setup, the user list and backups, and does not need AVX.',
  '检测到 CPU：{model}，{avx} AVX。当前将使用：{image}。{warn}': 'Detected CPU: {model}, {avx} AVX. Will use: {image}.{warn}',
  '支持': 'with',
  '不支持': 'without',
  ' ⚠ 这台机器无法运行官方 MongoDB。': ' ⚠ This machine cannot run official MongoDB.',
  '依赖镜像': 'Other images',
  '生成的 docker-compose.yml': 'Generated docker-compose.yml',
  '预览（基于已保存的配置）': 'Preview (from saved settings)',
  '修改控制台密码': 'Change console password',
  '原密码': 'Current password',
  '新密码（至少 6 位）': 'New password (at least 6 characters)',
  '修改': 'Change',
  '密码已修改，请重新登录': 'Password changed. Please sign in again.',

  // ---------------------------------------------------------------- save bar / jobs
  '修改尚未保存': 'Unsaved changes',
  '所有修改已保存': 'All changes saved',
  '保存': 'Save',
  '保存并应用': 'Save and apply',
  '已保存': 'Saved',
  '已保存，正在应用…': 'Saved, applying…',
  '收起': 'Collapse',
  '展开': 'Expand',
  '自动': 'Auto',
  '进行中…': 'Running…',
  '已完成': 'Done',
  '失败': 'Failed',
  '{title}：失败，请查看日志': '{title}: failed, see the log',
  '{title}：完成': '{title}: done',

  // ================================================================ server
  '需要 application/json': 'application/json required',
  '请求过大': 'Request too large',
  'JSON 格式错误': 'Invalid JSON',
  '无效的备份名': 'Invalid backup name',
  '备份不存在': 'Backup not found',
  '无效文件名': 'Invalid file name',
  '文件不存在': 'File not found',
  '缺少请求头': 'Missing request header',
  '已设置过管理密码': 'The console password is already set',
  '尝试次数过多，请稍后再试': 'Too many attempts, try again later',
  '密码错误': 'Wrong password',
  '原密码错误': 'Current password is wrong',
  '密码至少 6 位': 'The password must have at least 6 characters',
  '未知服务': 'Unknown service',
  '未知操作': 'Unknown action',
  '任务不存在': 'Job not found',
  '请先填写 Cloudflare API Token': 'Enter a Cloudflare API token first',
  '无法读取用户列表（MongoDB 是否在运行？）': 'Cannot read the user list (is MongoDB running?)',
  '解析用户列表失败': 'Could not parse the user list',
  '邮箱格式不正确': 'Invalid email address',
  '创建用户失败': 'Could not create the user',
  '用户不存在': 'User not found',
  '不能删除唯一的管理员，请先把其他用户设为管理员': 'Cannot delete the only admin. Make another user an admin first.',
  '不能把项目转移给被删除的用户自己': 'Cannot give the projects to the user being deleted',
  '接收项目的用户不存在': 'The user receiving the projects does not exist',
  '转移项目失败，用户未删除：{output}': 'Transferring projects failed; the user was not deleted: {output}',
  '删除失败：{output}': 'Delete failed: {output}',
  '已有任务正在运行：{title}': 'Another job is running: {title}',
  '命令失败 (exit {code})': 'Command failed (exit {code})',
  '✔ 完成': '✔ Done',

  // job titles
  '应用配置并启动': 'Apply settings and start',
  '启动服务': 'Start services',
  '停止服务': 'Stop services',
  '重启服务': 'Restart services',
  '拉取最新镜像': 'Pull latest images',
  '{action}：{service}': '{action}: {service}',
  '备份数据': 'Back up data',
  '恢复备份 {name}': 'Restore backup {name}',

  // job log lines
  '已生成 compose 文件，站点地址：{url}': 'Generated the compose file, site URL: {url}',
  'TeX Live 镜像已存在：{image}': 'TeX Live image already present: {image}',
  '下载 TeX Live 镜像 {image}（完整版约 5GB，首次需要较长时间）':
    'Downloading TeX Live image {image} (about 5 GB for the full one; the first time takes a while)',
  '容器已启动。Overleaf 首次启动需要 1~3 分钟完成初始化。': 'Containers started. Overleaf needs 1–3 minutes to initialize on first start.',
  '完整版 TeX Live 已就绪（{image}）': 'Full TeX Live is ready ({image})',
  '正在把 TeX Live 复制到数据卷（约 5~10 分钟，取决于硬盘速度）...':
    'Copying TeX Live into the volume (about 5–10 minutes depending on disk speed)...',
  '复制 {image} 中的 /usr/local/texlive 到卷 {volume}': 'Copy /usr/local/texlive from {image} into volume {volume}',
  '删除 TeX Live 镜像以节省磁盘空间（内容已在数据卷中）': 'Deleting the TeX Live image to save disk space (its contents are in the volume)',
  'CPU（{model}）不支持 AVX，官方 MongoDB 无法运行，自动改用无 AVX 版本：{image}':
    'The CPU ({model}) has no AVX, so official MongoDB cannot run; using the no-AVX build: {image}',
  '使用无 AVX 版本的 MongoDB：{image}': 'Using the no-AVX MongoDB build: {image}',
  '⚠ CPU（{model}）不支持 AVX，{image} 很可能无法启动。可在「高级 → MongoDB」改为“自动”或“无 AVX 版本”。':
    '⚠ The CPU ({model}) has no AVX, so {image} will most likely not start. Switch to “Automatic” or “No-AVX build” under Advanced → MongoDB.',
  '---- {name}（{state}）最近日志 ----': '---- {name} ({state}) recent logs ----',
  '(无日志)': '(no logs)',
  '(暂无日志)': '(no logs yet)',
  '导出 MongoDB 数据库 ...': 'Exporting the MongoDB database ...',
  'mongodump 失败：{error}': 'mongodump failed: {error}',
  '打包项目文件（overleaf_data，不含编译缓存）...': 'Packing project files (overleaf_data, without compile caches)...',
  '打包失败：{error}': 'Packing failed: {error}',
  '备份完成：data/backups/{name}': 'Backup finished: data/backups/{name}',
  '已从备份恢复 Overleaf 密钥': 'Restored the Overleaf secrets from the backup',
  '停止 Overleaf ...': 'Stopping Overleaf ...',
  '等待 MongoDB 就绪 ...': 'Waiting for MongoDB ...',
  '恢复 MongoDB（覆盖现有数据）...': 'Restoring MongoDB (overwriting current data)...',
  'mongorestore 失败': 'mongorestore failed',
  '恢复项目文件 ...': 'Restoring project files ...',
  '解包失败：{error}': 'Unpacking failed: {error}',
  '重新启动全部服务 ...': 'Starting all services again ...',

  // cloudflare
  '无法连接 Cloudflare API：{error}': 'Cannot reach the Cloudflare API: {error}',
  'Cloudflare API 返回了无效响应 (HTTP {status})': 'The Cloudflare API returned an invalid response (HTTP {status})',
  'Cloudflare API 错误：{error}': 'Cloudflare API error: {error}',
  'Cloudflare 配置不完整（需要 API Token、账户、域名和子域名）':
    'Cloudflare settings are incomplete (API token, account, domain and subdomain are required)',
  '使用已有隧道 {name} ({id})': 'Using existing tunnel {name} ({id})',
  '创建隧道 {name} ...': 'Creating tunnel {name} ...',
  '配置隧道入口：{hostname} → http://sharelatex:80': 'Configuring tunnel ingress: {hostname} → http://sharelatex:80',
  '隧道已创建 ({id})': 'Tunnel created ({id})',
  '{hostname} 已存在 {type} 记录，请先在 Cloudflare 删除它或换一个子域名':
    '{hostname} already has a {type} record. Delete it in Cloudflare or use another subdomain.',
  '更新 DNS 记录 {hostname}': 'Updating DNS record {hostname}',
  'DNS 记录 {hostname} 已正确': 'DNS record {hostname} is already correct',
  '创建 DNS 记录 {hostname} → {target}': 'Creating DNS record {hostname} → {target}',
}

/** Translate a Chinese source string into `lang`, filling {placeholders}. */
export function translate(lang, s, vars) {
  let out = lang === 'en' && Object.hasOwn(EN, s) ? EN[s] : s
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
  return out
}
