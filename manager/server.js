import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BACKUP_DIR,
  CONTAINERS,
  NETWORK,
  VOLUMES,
  applyUpdate,
  configExists,
  cpuInfo,
  effectiveSiteUrl,
  loadConfig,
  mongoImage,
  redact,
  saveConfig,
  tunnelHostname,
} from './lib/config.js'
import {
  buildEnv,
  renderCompose,
  setDockerRoot,
  texliveImages,
  useFullTexlive,
  writeCompose,
} from './lib/compose.js'
import {
  composeArgs,
  containerStatus,
  currentJob,
  dockerAvailable,
  ensureNetwork,
  getJob,
  imageExists,
  listJobs,
  run,
  startJob,
} from './lib/docker.js'
import * as auth from './lib/auth.js'
import { ensureTunnel, verifyToken } from './lib/cloudflare.js'

const PORT = Number(process.env.PORT || 8090)
const OVERLEAF_INTERNAL = process.env.OVERLEAF_INTERNAL_URL || 'http://sharelatex'
const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public')

// ---------------------------------------------------------------- helpers

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body)
  res.writeHead(status, {
    'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  })
  res.end(isJson ? JSON.stringify(body) : body)
}

async function readJson(req) {
  if (!/application\/json/.test(req.headers['content-type'] || '')) {
    throw new HttpError(415, '需要 application/json')
  }
  let size = 0
  const chunks = []
  for await (const c of req) {
    size += c.length
    if (size > 1024 * 1024) throw new HttpError(413, '请求过大')
    chunks.push(c)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  } catch {
    throw new HttpError(400, 'JSON 格式错误')
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1)
  const file = path.normalize(path.join(PUBLIC_DIR, rel))
  if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return send(res, 404, 'Not found')
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  })
  fs.createReadStream(file).pipe(res)
}

async function probeOverleaf() {
  try {
    const r = await fetch(`${OVERLEAF_INTERNAL}/status`, { signal: AbortSignal.timeout(3000) })
    if (!r.ok) return { reachable: false }
    let needsAdmin = null
    try {
      const lp = await fetch(`${OVERLEAF_INTERNAL}/launchpad`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(3000),
      })
      needsAdmin = lp.status === 200
    } catch {}
    return { reachable: true, needsAdmin }
  } catch {
    return { reachable: false }
  }
}

async function detectQuickUrl() {
  const r = await run(['logs', '--tail', '400', CONTAINERS.cloudflared], { timeout: 10000 })
  const text = r.stdout + r.stderr
  const all = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g)
  return all ? all[all.length - 1] : ''
}

const EMAIL_RE = /^[^\s@"'`$\\]+@[^\s@"'`$\\]+\.[^\s@"'`$\\]+$/

function safeBackupName(name) {
  if (!/^[0-9A-Za-z_-]+$/.test(name)) throw new HttpError(400, '无效的备份名')
  const dir = path.join(BACKUP_DIR, name)
  if (!fs.existsSync(dir)) throw new HttpError(404, '备份不存在')
  return dir
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return []
  return fs
    .readdirSync(BACKUP_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const dir = path.join(BACKUP_DIR, d.name)
      const files = fs.readdirSync(dir).map(f => ({
        name: f,
        size: fs.statSync(path.join(dir, f)).size,
      }))
      let meta = {}
      try {
        meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'))
      } catch {}
      delete meta.secrets // never sent to the browser
      return { name: d.name, files, ...meta }
    })
    .sort((a, b) => (a.name < b.name ? 1 : -1))
}

// ---------------------------------------------------------------- jobs

async function detectDockerRoot() {
  const r = await run(['info', '--format', '{{.DockerRootDir}}'], { timeout: 15000 })
  if (r.code === 0) setDockerRoot(r.stdout.trim())
}

const TEXLIVE_MARKER = '.easyovl-image'

/**
 * Copy /usr/local/texlive out of a texlive/texlive image into a named volume
 * (once per image), so the built-in compiler gets the full distribution.
 */
async function ensureFullTexlive(cfg, { log, step }) {
  const img = cfg.compile.fullImage
  const vol = VOLUMES.texlive
  // read the marker with a small image that the stack needs anyway
  if (!(await imageExists(cfg.images.redis))) await step(['pull', cfg.images.redis])
  const r = await run(
    ['run', '--rm', '-v', `${vol}:/t`, '--entrypoint', 'cat', cfg.images.redis, `/t/${TEXLIVE_MARKER}`],
    { timeout: 60000 }
  )
  if (r.code === 0 && r.stdout.trim() === img) {
    log(`完整版 TeX Live 已就绪（${img}）`)
    return
  }

  const hadImage = await imageExists(img)
  if (!hadImage) {
    log(`下载 TeX Live 镜像 ${img}（完整版约 5GB，首次需要较长时间）`)
    await step(['pull', img])
  }
  // the old Overleaf container may still be using the volume
  await step(['rm', '-f', CONTAINERS.sharelatex], { allowFail: true })
  log('正在把 TeX Live 复制到数据卷（约 5~10 分钟，取决于硬盘速度）...')
  await step(
    [
      'run', '--rm', '-e', `IMG=${img}`, '-v', `${vol}:/t`, '--entrypoint', 'sh', img, '-c',
      `find /t -mindepth 1 -delete && cp -a /usr/local/texlive/. /t/ && printf '%s' "$IMG" > /t/${TEXLIVE_MARKER}` +
        ` && echo "已复制：$(ls /t | tr '\\n' ' ')" && du -sh /t`,
    ],
    { label: `复制 ${img} 中的 /usr/local/texlive 到卷 ${vol}` }
  )
  // sandbox is off on this path, so nothing else needs the image
  if (!hadImage) {
    log('删除 TeX Live 镜像以节省磁盘空间（内容已在数据卷中）')
    await step(['image', 'rm', img], { allowFail: true })
  }
}

/** docker run args for a one-off MongoDB tool on the stack network. */
function mongoToolArgs(cfg, tool) {
  return ['run', '--rm', '-i', '--network', NETWORK, '--entrypoint', tool, cfg.images.mongoTools]
}

function logMongoChoice(cfg, log) {
  const img = mongoImage(cfg)
  const cpu = cpuInfo()
  const mode = cfg.images.mongoMode
  if (mode === 'auto' && img !== cfg.images.mongo) {
    log(`CPU（${cpu.model || '未知'}）不支持 AVX，官方 MongoDB 无法运行，自动改用无 AVX 版本：${img}`)
  } else if (mode === 'noavx') {
    log(`使用无 AVX 版本的 MongoDB：${img}`)
  } else if (!cpu.avx) {
    log(`⚠ CPU（${cpu.model || '未知'}）不支持 AVX，${img} 很可能无法启动。可在「高级 → MongoDB」改为“自动”或“无 AVX 版本”。`)
  }
}

/** On a failed `compose up`, print the logs that explain why. */
async function logContainerTails(log) {
  for (const name of [CONTAINERS.mongo, CONTAINERS.mongoInit, CONTAINERS.sharelatex]) {
    const st = await run(['inspect', '--format', '{{.State.Status}} exit={{.State.ExitCode}} restarts={{.RestartCount}}', name], { timeout: 10000 })
    if (st.code !== 0) continue
    log(`---- ${name}（${st.stdout.trim()}）最近日志 ----`)
    const r = await run(['logs', '--tail', '40', name], { timeout: 15000 })
    log((r.stdout + r.stderr).trim() || '(无日志)')
  }
}

function startApplyJob(title = '应用配置并启动') {
  return startJob(title, async ({ log, step }) => {
    let cfg = loadConfig()
    logMongoChoice(cfg, log)
    await ensureNetwork()
    await detectDockerRoot()

    if (cfg.tunnel.mode === 'api') {
      const t = cfg.tunnel
      const result = await ensureTunnel(
        {
          token: t.apiToken,
          accountId: t.accountId,
          zoneId: t.zoneId,
          hostname: tunnelHostname(cfg),
          tunnelName: t.tunnelName || 'easyovl',
          tunnelId: t.tunnelId,
        },
        log
      )
      cfg = loadConfig()
      cfg.tunnel.tunnelId = result.tunnelId
      cfg.tunnel.tunnelToken = result.tunnelToken
      saveConfig(cfg)
    }

    writeCompose(cfg)
    log(`已生成 compose 文件，站点地址：${effectiveSiteUrl(cfg)}`)

    if (cfg.compile.sandbox) {
      for (const img of texliveImages(cfg)) {
        if (await imageExists(img)) {
          log(`TeX Live 镜像已存在：${img}`)
          continue
        }
        log(`下载 TeX Live 镜像 ${img}（完整版约 5GB，首次需要较长时间）`)
        await step(['pull', img])
      }
    }

    if (useFullTexlive(cfg)) await ensureFullTexlive(cfg, { log, step })

    try {
      await step(composeArgs('up', '-d', '--remove-orphans', '--quiet-pull'))
    } catch (err) {
      await logContainerTails(log)
      throw err
    }
    log('容器已启动。Overleaf 首次启动需要 1~3 分钟完成初始化。')
  })
}

// ---------------------------------------------------------------- API routes

const routes = []
const route = (method, pattern, handler, { open = false } = {}) =>
  routes.push({ method, pattern, handler, open })

route('GET', '/api/session', async req => ({
  authenticated: Boolean(auth.sessionFromReq(req)),
  needsSetup: !auth.hasPassword(),
}), { open: true })

route('POST', '/api/setup', async (req, res) => {
  if (auth.hasPassword()) throw new HttpError(403, '已设置过管理密码')
  const { password } = await readJson(req)
  auth.setPassword(password)
  res.setHeader('Set-Cookie', auth.sessionCookie(auth.createSession()))
  if (!configExists()) saveConfig(loadConfig())
  return { ok: true }
}, { open: true })

const loginAttempts = new Map()
route('POST', '/api/login', async (req, res) => {
  const ip = req.socket.remoteAddress
  const a = loginAttempts.get(ip) || { n: 0, until: 0 }
  if (a.until > Date.now()) throw new HttpError(429, '尝试次数过多，请稍后再试')
  const { password } = await readJson(req)
  if (!auth.checkPassword(password)) {
    a.n += 1
    if (a.n >= 5) {
      a.until = Date.now() + 60000
      a.n = 0
    }
    loginAttempts.set(ip, a)
    throw new HttpError(401, '密码错误')
  }
  loginAttempts.delete(ip)
  res.setHeader('Set-Cookie', auth.sessionCookie(auth.createSession()))
  return { ok: true }
}, { open: true })

route('POST', '/api/logout', async (req, res) => {
  const sid = auth.sessionFromReq(req)
  if (sid) auth.destroySession(sid)
  res.setHeader('Set-Cookie', auth.sessionCookie('', 0))
  return { ok: true }
}, { open: true })

route('POST', '/api/password', async req => {
  const { oldPassword, newPassword } = await readJson(req)
  if (!auth.checkPassword(oldPassword)) throw new HttpError(400, '原密码错误')
  auth.setPassword(newPassword)
  return { ok: true, relogin: true }
})

route('GET', '/api/config', async () => {
  const cfg = loadConfig()
  return { config: redact(cfg), siteUrl: effectiveSiteUrl(cfg), cpu: cpuInfo(), mongoImage: mongoImage(cfg) }
})

route('PUT', '/api/config', async req => {
  const body = await readJson(req)
  const next = applyUpdate(loadConfig(), body.config || {})
  // reset cached tunnel credentials when the api target changes
  const prev = loadConfig()
  if (
    prev.tunnel.accountId !== next.tunnel.accountId ||
    prev.tunnel.tunnelName !== next.tunnel.tunnelName
  ) {
    next.tunnel.tunnelId = ''
    next.tunnel.tunnelToken = ''
  }
  saveConfig(next)
  let job = null
  if (body.apply) job = startApplyJob()
  return { config: redact(next), siteUrl: effectiveSiteUrl(next), cpu: cpuInfo(), mongoImage: mongoImage(next), job: job?.id }
})

route('GET', '/api/compose', async () => {
  const cfg = loadConfig()
  // mask secrets: the preview is for reading, not for copying credentials
  const secrets = [
    ...Object.values(cfg.secrets),
    cfg.email.pass, cfg.tunnel.token, cfg.tunnel.tunnelToken, cfg.tunnel.apiToken,
  ].filter(v => v && v.length >= 4)
  const mask = text => secrets.reduce((t, v) => t.split(v).join('******'), text)
  const env = Object.fromEntries(Object.entries(buildEnv(cfg)).map(([k, v]) => [k, mask(String(v))]))
  return { yaml: mask(renderCompose(cfg)), env }
})

route('POST', '/api/apply', async () => ({ job: startApplyJob().id }))

/** compose service name -> container name */
const SERVICE_CONTAINERS = {
  sharelatex: CONTAINERS.sharelatex,
  mongo: CONTAINERS.mongo,
  'mongo-init': CONTAINERS.mongoInit,
  redis: CONTAINERS.redis,
  cloudflared: CONTAINERS.cloudflared,
}

route('POST', '/api/action', async req => {
  const { action, service } = await readJson(req)
  // an unknown service must not silently turn into "all services"
  if (service && !(service in SERVICE_CONTAINERS)) throw new HttpError(400, '未知服务')
  const svc = service ? [service] : []
  const cfg = loadConfig()
  writeCompose(cfg)
  const table = {
    start: ['启动服务', composeArgs('up', '-d', '--remove-orphans', ...svc)],
    stop: ['停止服务', composeArgs('stop', ...svc)],
    restart: ['重启服务', composeArgs('restart', ...svc)],
    down: ['移除容器（保留数据）', composeArgs('down', '--remove-orphans')],
    pull: ['拉取最新镜像', composeArgs('pull')],
  }
  const t = table[action]
  if (!t) throw new HttpError(400, '未知操作')
  const job = startJob(svc.length ? `${t[0]}：${svc[0]}` : t[0], async ({ step }) => {
    await ensureNetwork()
    await step(t[1])
  })
  return { job: job.id }
})

route('GET', '/api/status', async () => {
  const cfg = loadConfig()
  const docker = await dockerAvailable()
  const containers = docker.ok ? await containerStatus() : []
  const running = s => containers.some(c => c.service === s && c.state === 'running')
  const overleaf = running('sharelatex') ? await probeOverleaf() : { reachable: false }

  let quickUrl = cfg.tunnel.quickUrl
  let quickUrlStale = false
  if (cfg.tunnel.mode === 'quick' && running('cloudflared')) {
    const found = await detectQuickUrl()
    if (found && found !== quickUrl) {
      quickUrl = found
      cfg.tunnel.quickUrl = found
      saveConfig(cfg)
    }
    if (cfg.tunnel.useQuickUrlAsSite) {
      const live = containers.length ? buildEnv(cfg).OVERLEAF_SITE_URL : ''
      const r = await run(['inspect', '--format', '{{range .Config.Env}}{{println .}}{{end}}', CONTAINERS.sharelatex])
      const m = /^OVERLEAF_SITE_URL=(.*)$/m.exec(r.stdout)
      quickUrlStale = Boolean(m && live && m[1] !== live)
    }
  }

  const tunnel = {
    mode: cfg.tunnel.mode,
    running: running('cloudflared'),
    publicUrl:
      cfg.tunnel.mode === 'quick'
        ? quickUrl
        : tunnelHostname(cfg)
          ? `https://${tunnelHostname(cfg)}`
          : '',
    quickUrlStale,
  }

  return {
    docker,
    containers,
    overleaf,
    tunnel,
    siteUrl: effectiveSiteUrl(cfg),
    port: cfg.overleaf.port,
    bindAddress: cfg.overleaf.bindAddress,
    image: `${cfg.overleaf.image}:${cfg.overleaf.tag}`,
    configured: configExists(),
    job: currentJob() ? { id: currentJob().id, title: currentJob().title } : null,
  }
})

route('GET', '/api/logs', async (req, res, { query }) => {
  const service = query.get('service') || 'sharelatex'
  const name = SERVICE_CONTAINERS[service]
  if (!name) throw new HttpError(400, '未知服务')
  const tail = Math.min(Math.max(Number(query.get('tail')) || 300, 10), 5000)
  const r = await run(['logs', '--tail', String(tail), '--timestamps', name], { timeout: 15000 })
  return { text: (r.stdout + r.stderr) || '(暂无日志)', ok: r.code === 0 }
})

route('GET', '/api/jobs', async () => ({ jobs: listJobs(), current: currentJob()?.id || null }))

route('GET', /^\/api\/jobs\/(\d+)$/, async (req, res, { params, query }) => {
  const job = getJob(params[0])
  if (!job) throw new HttpError(404, '任务不存在')
  const since = Number(query.get('since')) || 0
  return {
    id: job.id,
    title: job.title,
    status: job.status,
    total: job.lines.length,
    lines: job.lines.slice(since),
  }
})

let tagCache = { at: 0, tags: [] }
route('GET', '/api/tags', async () => {
  if (Date.now() - tagCache.at < 10 * 60 * 1000 && tagCache.tags.length) return { tags: tagCache.tags }
  const image = loadConfig().overleaf.image
  if (!/^[a-z0-9._-]+\/[a-z0-9._-]+$/.test(image)) return { tags: [] }
  try {
    const r = await fetch(
      `https://hub.docker.com/v2/repositories/${image}/tags?page_size=30&ordering=last_updated`,
      { signal: AbortSignal.timeout(10000) }
    )
    const data = await r.json()
    const tags = (data.results || []).map(t => ({ name: t.name, updated: t.last_updated, size: t.full_size }))
    tagCache = { at: Date.now(), tags }
    return { tags }
  } catch (err) {
    return { tags: [], error: err.message }
  }
})

route('POST', '/api/cloudflare/verify', async req => {
  const body = await readJson(req)
  const token = body.apiToken || loadConfig().tunnel.apiToken
  if (!token) throw new HttpError(400, '请先填写 Cloudflare API Token')
  return verifyToken(token)
})

async function getUsers() {
  const r = await run(
    [
      ...mongoToolArgs(loadConfig(), 'mongosh'), 'mongodb://mongo/sharelatex', '--quiet', '--eval',
      'JSON.stringify(db.users.find({}, {email:1,isAdmin:1,first_name:1,last_name:1,signUpDate:1,lastLoggedIn:1}).sort({signUpDate:1}).limit(500).toArray())',
    ],
    { timeout: 20000 }
  )
  if (r.code !== 0) throw new HttpError(503, '无法读取用户列表（MongoDB 是否在运行？）')
  try {
    return JSON.parse(r.stdout.trim().split('\n').pop())
  } catch {
    throw new HttpError(500, '解析用户列表失败')
  }
}

route('GET', '/api/users', async () => ({ users: await getUsers() }))

/** Run one of Overleaf's own admin scripts inside the sharelatex container. */
function overleafScript(script, args, timeout = 120000) {
  return run(
    ['exec', '-w', '/overleaf/services/web', CONTAINERS.sharelatex, 'node', `modules/server-ce-scripts/scripts/${script}`, ...args],
    { timeout }
  )
}

route('POST', '/api/users', async req => {
  const { email, admin } = await readJson(req)
  if (!EMAIL_RE.test(email || '')) throw new HttpError(400, '邮箱格式不正确')
  // also used to issue a new set-password link for an existing user
  // (the script reuses the account); keep the admin flag as given
  const r = await overleafScript('create-user.mjs', [...(admin ? ['--admin'] : []), `--email=${email}`])
  const output = (r.stdout + r.stderr).trim()
  if (r.code !== 0) throw new HttpError(500, output.slice(-1500) || '创建用户失败')
  // The script may first print the activation e-mail (HTML with w3.org DTD
  // links) when SMTP is not configured; the real link follows this sentence.
  const after = output.split(/Please visit the following URL[^\n]*\n/).pop()
  const m =
    after.match(/https?:\/\/\S+\/user\/\S+/) ||
    output.match(/https?:\/\/[^\s"'<>]+\/user\/(?:activate|password\/set)\?[^\s"'<>]+/)
  return { output, setPasswordUrl: m ? m[0] : '' }
})

route('DELETE', '/api/users', async req => {
  const { email, transferTo } = await readJson(req)
  if (!EMAIL_RE.test(email || '')) throw new HttpError(400, '邮箱格式不正确')
  const users = await getUsers()
  const target = users.find(u => u.email === email)
  if (!target) throw new HttpError(404, '用户不存在')
  if (target.isAdmin && users.filter(u => u.isAdmin).length <= 1) {
    throw new HttpError(400, '不能删除唯一的管理员，请先把其他用户设为管理员')
  }
  const out = []
  if (transferTo) {
    if (transferTo === email) throw new HttpError(400, '不能把项目转移给被删除的用户自己')
    if (!users.some(u => u.email === transferTo)) throw new HttpError(400, '接收项目的用户不存在')
    const t = await overleafScript('transfer-all-projects-to-user.mjs', [`--from-user=${email}`, `--to-user=${transferTo}`], 300000)
    out.push((t.stdout + t.stderr).trim())
    if (t.code !== 0) throw new HttpError(500, `转移项目失败，用户未删除：${out.join('\n').slice(-1500)}`)
  }
  const d = await overleafScript('delete-user.mjs', ['--skip-email', `--email=${email}`], 300000)
  out.push((d.stdout + d.stderr).trim())
  if (d.code !== 0) throw new HttpError(500, `删除失败：${out.join('\n').slice(-1500)}`)
  return { ok: true, output: out.join('\n') }
})

route('GET', '/api/backups', async () => ({ backups: listBackups() }))

route('POST', '/api/backups', async () => {
  const cfg = loadConfig()
  const name = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
  const dir = path.join(BACKUP_DIR, name)
  const job = startJob('备份数据', async ({ log }) => {
    fs.mkdirSync(dir, { recursive: true })
    log('导出 MongoDB 数据库 ...')
    const m = await run(
      [...mongoToolArgs(cfg, 'mongodump'), '--host', 'mongo', '--db', 'sharelatex', '--archive', '--gzip'],
      { timeout: 0, stdoutFile: path.join(dir, 'mongo.archive.gz') }
    )
    if (m.code !== 0) throw new Error(`mongodump 失败：${m.stderr.slice(-500)}`)
    log('打包项目文件（overleaf_data，不含编译缓存）...')
    const t = await run(
      [
        'run', '--rm', '-v', `${VOLUMES.data}:/v:ro`, '--entrypoint', 'tar', cfg.images.mongoTools,
        'czf', '-', '--numeric-owner',
        '--exclude=./data/compiles', '--exclude=./data/output', '--exclude=./data/cache', '--exclude=./tmp',
        '-C', '/v', '.',
      ],
      { timeout: 0, stdoutFile: path.join(dir, 'overleaf_data.tar.gz') }
    )
    if (t.code !== 0) throw new Error(`打包失败：${t.stderr.slice(-500)}`)
    fs.writeFileSync(
      path.join(dir, 'meta.json'),
      JSON.stringify({ createdAt: new Date().toISOString(), image: `${cfg.overleaf.image}:${cfg.overleaf.tag}`, secrets: cfg.secrets }, null, 2)
    )
    log(`备份完成：data/backups/${name}`)
  })
  return { job: job.id, name }
})

route('POST', /^\/api\/backups\/([^/]+)\/restore$/, async (req, res, { params }) => {
  const dir = safeBackupName(params[0])
  const cfg = loadConfig()
  const job = startJob(`恢复备份 ${params[0]}`, async ({ log, step }) => {
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'))
      if (meta.secrets) {
        for (const [k, v] of Object.entries(meta.secrets)) if (k in cfg.secrets && v) cfg.secrets[k] = v
        saveConfig(cfg)
        log('已从备份恢复 Overleaf 密钥')
      }
    } catch {}
    writeCompose(cfg)
    await ensureNetwork()
    log('停止 Overleaf ...')
    await step(composeArgs('stop', 'sharelatex', 'cloudflared'), { allowFail: true })
    await step(composeArgs('up', '-d', 'mongo', 'mongo-init', 'redis'))
    log('等待 MongoDB 就绪 ...')
    for (let i = 0; i < 30; i++) {
      const r = await run([...mongoToolArgs(cfg, 'mongosh'), '--host', 'mongo', '--quiet', '--eval', 'db.hello().isWritablePrimary'])
      if (r.stdout.trim() === 'true') break
      await new Promise(r => setTimeout(r, 2000))
    }
    const mongoFile = path.join(dir, 'mongo.archive.gz')
    if (fs.existsSync(mongoFile)) {
      log('恢复 MongoDB（覆盖现有数据）...')
      const r = await run(
        [...mongoToolArgs(cfg, 'mongorestore'), '--host', 'mongo', '--archive', '--gzip', '--drop'],
        { timeout: 0, input: fs.createReadStream(mongoFile) }
      )
      log(r.stderr.split('\n').slice(-5).join('\n'))
      if (r.code !== 0) throw new Error('mongorestore 失败')
    }
    const dataFile = path.join(dir, 'overleaf_data.tar.gz')
    if (fs.existsSync(dataFile)) {
      log('恢复项目文件 ...')
      const r = await run(
        [
          'run', '--rm', '-i', '-v', `${VOLUMES.data}:/v`, '--entrypoint', 'sh', cfg.images.mongoTools,
          '-c', 'find /v -mindepth 1 -maxdepth 1 -exec rm -rf {} + && tar xzf - --numeric-owner -C /v',
        ],
        { timeout: 0, input: fs.createReadStream(dataFile) }
      )
      if (r.code !== 0) throw new Error(`解包失败：${r.stderr.slice(-500)}`)
    }
    log('重新启动全部服务 ...')
    await step(composeArgs('up', '-d', '--remove-orphans'))
  })
  return { job: job.id }
})

route('DELETE', /^\/api\/backups\/([^/]+)$/, async (req, res, { params }) => {
  const dir = safeBackupName(params[0])
  fs.rmSync(dir, { recursive: true, force: true })
  return { ok: true }
})

route('GET', /^\/api\/backups\/([^/]+)\/([^/]+)$/, async (req, res, { params }) => {
  const dir = safeBackupName(params[0])
  if (!/^[\w.-]+$/.test(params[1])) throw new HttpError(400, '无效文件名')
  const file = path.join(dir, params[1])
  if (!fs.existsSync(file)) throw new HttpError(404, '文件不存在')
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Length': fs.statSync(file).size,
    'Content-Disposition': `attachment; filename="${params[0]}_${params[1]}"`,
  })
  fs.createReadStream(file).pipe(res)
  return undefined
})

// ---------------------------------------------------------------- server

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  const { pathname } = url
  if (!pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed')
    return serveStatic(req, res, pathname)
  }
  for (const r of routes) {
    if (r.method !== req.method) continue
    let params = []
    if (typeof r.pattern === 'string') {
      if (r.pattern !== pathname) continue
    } else {
      const m = r.pattern.exec(pathname)
      if (!m) continue
      params = m.slice(1).map(decodeURIComponent)
    }
    try {
      if (!r.open && !auth.sessionFromReq(req)) throw new HttpError(401, '请先登录')
      // CSRF: state-changing requests must come from our own page
      if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'easyovl') {
        throw new HttpError(403, '缺少请求头')
      }
      const result = await r.handler(req, res, { params, query: url.searchParams })
      if (result !== undefined && !res.headersSent) send(res, 200, result)
    } catch (err) {
      const status = err.status || 500
      if (status >= 500) console.error(err)
      if (!res.headersSent) send(res, status, { error: err.message })
    }
    return
  }
  send(res, 404, { error: 'Not found' })
})

server.listen(PORT, () => {
  console.log(`easyovl manager listening on http://0.0.0.0:${PORT}`)
  ensureNetwork().catch(() => {})
  detectDockerRoot().catch(() => {})
})
