import fs from 'node:fs'
import path from 'node:path'
import {
  CONTAINERS,
  NETWORK,
  PROJECT,
  STACK_DIR,
  VOLUMES,
  effectiveSiteUrl,
  parseEnvLines,
  splitList,
} from './config.js'

export const COMPOSE_FILE = path.join(STACK_DIR, 'docker-compose.yml')

// ---------- tiny YAML emitter (enough for compose files) ----------

function scalar(v) {
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v === null || v === undefined) return 'null'
  // compose interpolates ${VAR}; escape every literal $ as $$
  return JSON.stringify(String(v).replace(/\$/g, '$$$$'))
}

function key(k) {
  return /^[A-Za-z0-9_.-]+$/.test(k) ? k : JSON.stringify(k)
}

export function toYaml(value, indent = 0) {
  const pad = '  '.repeat(indent)
  if (Array.isArray(value)) {
    if (!value.length) return `${pad}[]\n`
    return value
      .map(item => {
        if (item && typeof item === 'object') {
          const inner = toYaml(item, indent + 1).replace(/^\s+/, '')
          return `${pad}- ${inner}`
        }
        return `${pad}- ${scalar(item)}\n`
      })
      .join('')
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).filter(k => value[k] !== undefined)
    if (!keys.length) return `${pad}{}\n`
    return keys
      .map(k => {
        const v = value[k]
        if (v && typeof v === 'object') {
          const empty = Array.isArray(v) ? !v.length : !Object.keys(v).length
          if (empty) return `${pad}${key(k)}: ${Array.isArray(v) ? '[]' : '{}'}\n`
          return `${pad}${key(k)}:\n${toYaml(v, indent + 1)}`
        }
        return `${pad}${key(k)}: ${scalar(v)}\n`
      })
      .join('')
  }
  return `${pad}${scalar(value)}\n`
}

// ---------- environment for the sharelatex container ----------

const bool = b => (b ? 'true' : 'false')

/** Host path of the overleaf_data volume, as seen by the Docker daemon. */
export function dataVolumeHostPath() {
  return `/var/lib/docker/volumes/${VOLUMES.data}/_data`
}

export function texliveImages(cfg) {
  return splitList(cfg.compile.images)
}

export function buildEnv(cfg) {
  const o = cfg.overleaf
  const f = cfg.features
  const c = cfg.compile
  const e = cfg.email
  const env = {
    OVERLEAF_APP_NAME: o.appName,
    OVERLEAF_NAV_TITLE: o.navTitle || o.appName,
    OVERLEAF_SITE_URL: effectiveSiteUrl(cfg),
    OVERLEAF_MONGO_URL: 'mongodb://mongo/sharelatex',
    OVERLEAF_REDIS_HOST: 'redis',
    REDIS_HOST: 'redis',
    OVERLEAF_BEHIND_PROXY: bool(o.behindProxy),
    ENABLED_LINKED_FILE_TYPES: f.linkedFileTypes,
    ENABLE_CONVERSIONS: bool(f.conversions),
    EMAIL_CONFIRMATION_DISABLED: bool(f.emailConfirmationDisabled),
    OVERLEAF_ENABLE_REGISTRATION_PAGE: bool(f.registration),
    OVERLEAF_HISTORY_RESTORE: bool(f.historyRestore),
    ENABLE_PANDOC_CONVERSIONS: bool(f.pandoc),
    MAX_UPLOAD_SIZE: String(f.maxUploadSize),
    COMPILE_TIMEOUT: String(c.timeout),
  }
  if (o.secureCookie) env.OVERLEAF_SECURE_COOKIE = 'true'
  if (o.adminEmail) env.OVERLEAF_ADMIN_EMAIL = o.adminEmail
  if (f.allowedDomains) {
    env.OVERLEAF_ALLOWED_REGISTRATION_EMAIL_DOMAINS = f.allowedDomains
  }
  if (c.shellEscape) env.TEX_COMPILER_EXTRA_FLAGS = '-shell-escape'

  if (c.sandbox) {
    const images = texliveImages(cfg)
    const host = dataVolumeHostPath()
    Object.assign(env, {
      SANDBOXED_COMPILES: 'true',
      SANDBOXED_COMPILES_SIBLING_CONTAINERS: 'true',
      DOCKER_RUNNER: 'true',
      SANDBOXED_COMPILES_HOST_DIR_COMPILES: `${host}/data/compiles`,
      SANDBOXED_COMPILES_HOST_DIR_OUTPUT: `${host}/data/output`,
      ALL_TEX_LIVE_DOCKER_IMAGES: images.join(','),
    })
    const names = splitList(c.imageNames)
    if (names.length === images.length) {
      env.ALL_TEX_LIVE_DOCKER_IMAGE_NAMES = names.join(',')
    }
    const def = c.defaultImage && images.includes(c.defaultImage)
      ? c.defaultImage
      : images[0]
    if (def) env.TEX_LIVE_DOCKER_IMAGE = def
  }

  if (e.enabled) {
    Object.assign(env, {
      OVERLEAF_EMAIL_FROM_ADDRESS: e.fromAddress,
      OVERLEAF_EMAIL_SMTP_HOST: e.host,
      OVERLEAF_EMAIL_SMTP_PORT: String(e.port),
      OVERLEAF_EMAIL_SMTP_SECURE: bool(e.secure),
      OVERLEAF_EMAIL_SMTP_IGNORE_TLS: bool(e.ignoreTls),
      OVERLEAF_EMAIL_SMTP_TLS_REJECT_UNAUTH: bool(e.rejectUnauthorized),
    })
    if (e.user) env.OVERLEAF_EMAIL_SMTP_USER = e.user
    if (e.pass) env.OVERLEAF_EMAIL_SMTP_PASS = e.pass
    if (e.footer) env.OVERLEAF_CUSTOM_EMAIL_FOOTER = e.footer
  }

  // user supplied variables win
  Object.assign(env, parseEnvLines(cfg.extraEnv))
  return env
}

// ---------- compose document ----------

export function buildCompose(cfg) {
  const o = cfg.overleaf
  const services = {
    mongo: {
      image: cfg.images.mongo,
      container_name: CONTAINERS.mongo,
      restart: 'unless-stopped',
      command: '--replSet overleaf --bind_ip_all',
      environment: { MONGO_INITDB_DATABASE: 'sharelatex' },
      extra_hosts: ['mongo:127.0.0.1'],
      volumes: [`${VOLUMES.mongo}:/data/db`],
      // initiates the single-node replica set on first boot
      healthcheck: {
        test: [
          'CMD',
          'mongosh',
          '--quiet',
          '--eval',
          "try { rs.status().ok } catch (e) { rs.initiate({ _id: 'overleaf', members: [{ _id: 0, host: 'mongo:27017' }] }).ok }",
        ],
        interval: '10s',
        timeout: '10s',
        retries: 10,
        start_period: '20s',
      },
    },
    redis: {
      image: cfg.images.redis,
      container_name: CONTAINERS.redis,
      restart: 'unless-stopped',
      volumes: [`${VOLUMES.redis}:/data`],
    },
    sharelatex: {
      image: `${o.image}:${o.tag}`,
      container_name: CONTAINERS.sharelatex,
      restart: 'unless-stopped',
      depends_on: {
        mongo: { condition: 'service_healthy' },
        redis: { condition: 'service_started' },
      },
      stop_grace_period: '60s',
      ports: [`${o.bindAddress}:${o.port}:80`],
      volumes: [`${VOLUMES.data}:/var/lib/overleaf`],
      environment: buildEnv(cfg),
    },
  }

  if (cfg.compile.sandbox) {
    services.sharelatex.volumes.push('/var/run/docker.sock:/var/run/docker.sock')
  }

  const t = cfg.tunnel
  const cf = {
    image: cfg.images.cloudflared,
    container_name: CONTAINERS.cloudflared,
    restart: 'unless-stopped',
    depends_on: ['sharelatex'],
  }
  if (t.mode === 'quick') {
    services.cloudflared = {
      ...cf,
      command: 'tunnel --no-autoupdate --url http://sharelatex:80',
    }
  } else if (t.mode === 'token' && t.token) {
    services.cloudflared = {
      ...cf,
      command: 'tunnel --no-autoupdate run',
      environment: { TUNNEL_TOKEN: t.token },
    }
  } else if (t.mode === 'api' && t.tunnelToken) {
    services.cloudflared = {
      ...cf,
      command: 'tunnel --no-autoupdate run',
      environment: { TUNNEL_TOKEN: t.tunnelToken },
    }
  }

  return {
    name: PROJECT,
    services,
    volumes: {
      [VOLUMES.data]: { name: VOLUMES.data },
      [VOLUMES.mongo]: { name: VOLUMES.mongo },
      [VOLUMES.redis]: { name: VOLUMES.redis },
    },
    networks: { default: { name: NETWORK, external: true } },
  }
}

export function renderCompose(cfg) {
  return (
    '# Generated by easyovl manager - edits will be overwritten.\n' +
    toYaml(buildCompose(cfg))
  )
}

export function writeCompose(cfg) {
  fs.mkdirSync(STACK_DIR, { recursive: true })
  const text = renderCompose(cfg)
  fs.writeFileSync(COMPOSE_FILE, text)
  return text
}
