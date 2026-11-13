import crypto from 'node:crypto'
import { t } from './lang.js'

const API = 'https://api.cloudflare.com/client/v4'

async function cf(token, method, path, body) {
  let res
  try {
    res = await fetch(API + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    })
  } catch (err) {
    throw new Error(t('无法连接 Cloudflare API：{error}', { error: err.message }))
  }
  let data
  try {
    data = await res.json()
  } catch {
    throw new Error(t('Cloudflare API 返回了无效响应 (HTTP {status})', { status: res.status }))
  }
  if (!data.success) {
    const msg = (data.errors || []).map(e => `${e.code}: ${e.message}`).join('; ')
    throw new Error(t('Cloudflare API 错误：{error}', { error: msg || 'HTTP ' + res.status }))
  }
  return data.result
}

export async function verifyToken(token) {
  // works for both user and account tokens: list what the token can see
  const accounts = await cf(token, 'GET', '/accounts?per_page=50')
  const zones = await cf(token, 'GET', '/zones?per_page=50&status=active')
  return {
    accounts: accounts.map(a => ({ id: a.id, name: a.name })),
    zones: zones.map(z => ({ id: z.id, name: z.name, accountId: z.account?.id })),
  }
}

/**
 * Create (or reuse) a remotely managed tunnel, route hostname -> sharelatex,
 * create the proxied DNS CNAME, and return the connector token.
 */
export async function ensureTunnel({ token, accountId, zoneId, hostname, tunnelName, tunnelId }, log = () => {}) {
  if (!token || !accountId || !zoneId || !hostname) {
    throw new Error(t('Cloudflare 配置不完整（需要 API Token、账户、域名和子域名）'))
  }
  const acc = `/accounts/${accountId}/cfd_tunnel`

  let tunnel = null
  if (tunnelId) {
    try {
      tunnel = await cf(token, 'GET', `${acc}/${tunnelId}`)
      if (tunnel.deleted_at) tunnel = null
    } catch {
      tunnel = null
    }
  }
  if (!tunnel) {
    const found = await cf(
      token,
      'GET',
      `${acc}?is_deleted=false&name=${encodeURIComponent(tunnelName)}`
    )
    tunnel = found[0] || null
  }
  if (tunnel) {
    log(t('使用已有隧道 {name} ({id})', { name: tunnel.name, id: tunnel.id }))
  } else {
    log(t('创建隧道 {name} ...', { name: tunnelName }))
    tunnel = await cf(token, 'POST', acc, {
      name: tunnelName,
      config_src: 'cloudflare',
      tunnel_secret: crypto.randomBytes(32).toString('base64'),
    })
    log(t('隧道已创建 ({id})', { id: tunnel.id }))
  }

  log(t('配置隧道入口：{hostname} → http://sharelatex:80', { hostname }))
  await cf(token, 'PUT', `${acc}/${tunnel.id}/configurations`, {
    config: {
      ingress: [
        { hostname, service: 'http://sharelatex:80', originRequest: {} },
        { service: 'http_status:404' },
      ],
    },
  })

  const target = `${tunnel.id}.cfargotunnel.com`
  const existing = await cf(
    token,
    'GET',
    `/zones/${zoneId}/dns_records?name=${encodeURIComponent(hostname)}`
  )
  const record = { type: 'CNAME', name: hostname, content: target, proxied: true, ttl: 1, comment: 'easyovl overleaf tunnel' }
  if (existing.length) {
    const r = existing[0]
    if (r.type !== 'CNAME' && existing.length) {
      throw new Error(t('{hostname} 已存在 {type} 记录，请先在 Cloudflare 删除它或换一个子域名', { hostname, type: r.type }))
    }
    if (r.content !== target || !r.proxied) {
      log(t('更新 DNS 记录 {hostname}', { hostname }))
      await cf(token, 'PUT', `/zones/${zoneId}/dns_records/${r.id}`, record)
    } else {
      log(t('DNS 记录 {hostname} 已正确', { hostname }))
    }
  } else {
    log(t('创建 DNS 记录 {hostname} → {target}', { hostname, target }))
    await cf(token, 'POST', `/zones/${zoneId}/dns_records`, record)
  }

  const connectorToken = await cf(token, 'GET', `${acc}/${tunnel.id}/token`)
  return { tunnelId: tunnel.id, tunnelToken: connectorToken }
}
