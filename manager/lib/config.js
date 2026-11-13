import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export const DATA_DIR = process.env.DATA_DIR || path.resolve('data')
export const STACK_DIR = path.join(DATA_DIR, 'stack')
export const BACKUP_DIR = path.join(DATA_DIR, 'backups')
const CONFIG_FILE = path.join(DATA_DIR, 'config.json')

export const PROJECT = 'overleaf'
export const NETWORK = 'overleaf-net'
export const VOLUMES = {
  data: 'overleaf_data',
  mongo: 'overleaf_mongo',
  redis: 'overleaf_redis',
  texlive: 'overleaf_texlive',
}
export const CONTAINERS = {
  sharelatex: 'overleaf-sharelatex',
  mongo: 'overleaf-mongo',
  mongoInit: 'overleaf-mongo-init',
  redis: 'overleaf-redis',
  cloudflared: 'overleaf-cloudflared',
}

export const DEFAULTS = {
  overleaf: {
    image: 'overleafcep/sharelatex',
    tag: '6.3.0-ext-v5.1',
    appName: 'Overleaf',
    navTitle: 'Overleaf',
    siteUrl: '',
    adminEmail: '',
    bindAddress: '0.0.0.0',
    port: 8080,
    behindProxy: true,
    secureCookie: false,
  },
  features: {
    registration: false,
    allowedDomains: '',
    emailConfirmationDisabled: true,
    historyRestore: true,
    pandoc: true,
    conversions: true,
    linkedFileTypes: 'project_file,project_output_file,url',
    maxUploadSize: 50,
  },
  compile: {
    sandbox: false,
    // built-in compile with a full TeX Live copied from a texlive image
    fullTexlive: false,
    fullImage: 'texlive/texlive:latest-full',
    images: 'texlive/texlive:latest-full',
    imageNames: 'TeX Live (latest-full)',
    defaultImage: '',
    shellEscape: false,
    timeout: 180,
  },
  email: {
    enabled: false,
    fromAddress: '',
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    ignoreTls: false,
    rejectUnauthorized: true,
    footer: '',
  },
  tunnel: {
    // off | quick | token | api
    mode: 'off',
    token: '',
    hostname: '',
    apiToken: '',
    accountId: '',
    zoneId: '',
    zoneName: '',
    subdomain: 'overleaf',
    tunnelName: 'easyovl',
    tunnelId: '',
    tunnelToken: '',
    quickUrl: '',
    useQuickUrlAsSite: false,
  },
  images: {
    // auto: official image if the CPU has AVX, otherwise mongoNoAvx
    // official: always images.mongo / noavx: always images.mongoNoAvx
    mongoMode: 'auto',
    mongo: 'mongo:8.0',
    // community build of MongoDB 8.0 without AVX (mongod only)
    mongoNoAvx: 'devferris/mongodb-no-avx:8.0.17-nehalem',
    // provides mongosh / mongodump / mongorestore / tar for maintenance tasks
    mongoTools: 'mongo:8.0',
    redis: 'redis:7.4',
    cloudflared: 'cloudflare/cloudflared:latest',
  },
  extraEnv: '',
  // Overleaf secrets that must stay stable across restarts/upgrades.
  // Generated once, stored in config.json, never sent to the browser.
  secrets: {
    OVERLEAF_INVITE_TOKEN_SECRET: '',
  },
}

function isObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v)
}

/** Deep merge `src` onto `base`, only keeping keys that exist in `base` (schema). */
export function mergeKnown(base, src) {
  const out = Array.isArray(base) ? [...base] : { ...base }
  if (!isObj(src)) return out
  for (const k of Object.keys(base)) {
    if (!(k in src)) continue
    const b = base[k]
    const s = src[k]
    if (isObj(b)) out[k] = mergeKnown(b, s)
    else if (typeof b === 'number') {
      const n = Number(s)
      if (Number.isFinite(n)) out[k] = n
    } else if (typeof b === 'boolean') out[k] = s === true || s === 'true'
    else if (typeof b === 'string') out[k] = s == null ? '' : String(s)
  }
  return out
}

// keeps generated secrets stable until the config is first saved
const pendingSecrets = {}

function fillSecrets(cfg) {
  let changed = false
  for (const k of Object.keys(cfg.secrets)) {
    if (cfg.secrets[k]) continue
    pendingSecrets[k] ??= crypto.randomBytes(32).toString('base64')
    cfg.secrets[k] = pendingSecrets[k]
    changed = true
  }
  return changed
}

export function loadConfig() {
  let cfg
  try {
    cfg = mergeKnown(DEFAULTS, JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')))
  } catch {
    cfg = structuredClone(DEFAULTS)
  }
  if (fillSecrets(cfg) && configExists()) {
    try {
      saveConfig(cfg)
    } catch {}
  }
  return cfg
}

export function saveConfig(cfg) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const tmp = CONFIG_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2))
  fs.renameSync(tmp, CONFIG_FILE)
}

export function configExists() {
  return fs.existsSync(CONFIG_FILE)
}

/** Secrets are never sent back to the browser; '' means "unchanged" on save. */
export const SECRET_PATHS = [
  ['email', 'pass'],
  ['tunnel', 'token'],
  ['tunnel', 'apiToken'],
  ['tunnel', 'tunnelToken'],
]

export function redact(cfg) {
  const c = structuredClone(cfg)
  delete c.secrets
  for (const [a, b] of SECRET_PATHS) {
    c[a][`${b}Set`] = Boolean(c[a][b])
    c[a][b] = ''
  }
  return c
}

export function applyUpdate(current, incoming) {
  const next = mergeKnown(current, incoming)
  next.secrets = structuredClone(current.secrets) // never changed from the browser
  for (const [a, b] of SECRET_PATHS) {
    const sent = incoming?.[a]?.[b]
    const clear = incoming?.[a]?.[`${b}Clear`]
    if (clear) next[a][b] = ''
    else if (!sent) next[a][b] = current[a][b]
  }
  return next
}

/** Parse KEY=VALUE lines (comments with #). */
export function parseEnvLines(text) {
  const env = {}
  for (const line of String(text || '').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i <= 0) continue
    const key = t.slice(0, i).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    let val = t.slice(i + 1).trim()
    if (
      val.length >= 2 &&
      ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'")))
    ) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

export function splitList(s) {
  return String(s || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
}

/** Public URL Overleaf should consider its own address. */
export function effectiveSiteUrl(cfg) {
  const t = cfg.tunnel
  if (cfg.overleaf.siteUrl) return cfg.overleaf.siteUrl.replace(/\/+$/, '')
  if (t.mode === 'api' && t.subdomain && t.zoneName) {
    return `https://${t.subdomain}.${t.zoneName}`
  }
  if (t.mode === 'token' && t.hostname) return `https://${t.hostname}`
  if (t.mode === 'quick' && t.useQuickUrlAsSite && t.quickUrl) return t.quickUrl
  return `http://localhost:${cfg.overleaf.port}`
}

/**
 * Whether the host CPU has AVX (needed by official MongoDB >= 5.0 builds).
 * /proc/cpuinfo inside a container shows the host CPU.
 */
let avxCache
export function cpuInfo() {
  if (avxCache) return avxCache
  avxCache = { avx: true, model: '' }
  if (process.arch !== 'x64') return avxCache
  try {
    const info = fs.readFileSync('/proc/cpuinfo', 'utf8')
    const flags = /^flags\s*:(.*)$/m.exec(info)?.[1]
    if (flags) avxCache.avx = /\bavx\b/.test(flags)
    avxCache.model = /^model name\s*:\s*(.*)$/m.exec(info)?.[1] || ''
  } catch {}
  return avxCache
}

/** Image actually used for the mongo service. */
export function mongoImage(cfg) {
  const { mongoMode, mongo, mongoNoAvx } = cfg.images
  if (mongoMode === 'noavx') return mongoNoAvx || mongo
  if (mongoMode === 'official') return mongo
  return !cpuInfo().avx && mongoNoAvx ? mongoNoAvx : mongo
}

export function tunnelHostname(cfg) {
  const t = cfg.tunnel
  if (t.mode === 'api' && t.subdomain && t.zoneName) {
    return `${t.subdomain}.${t.zoneName}`
  }
  if (t.mode === 'token') return t.hostname
  return ''
}
