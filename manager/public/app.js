// EasyOVL manager front-end (vanilla JS, no build step)

const $ = (s, el = document) => el.querySelector(s)
const $$ = (s, el = document) => [...el.querySelectorAll(s)]

// ------------------------------------------------------------------ api

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: {
      'X-Requested-With': 'easyovl',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  let data = {}
  try {
    data = await res.json()
  } catch {}
  if (res.status === 401 && path !== '/api/login') {
    showAuth(false)
    throw new Error(data.error || '请先登录')
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

let toastTimer
function toast(msg, isErr = false) {
  const t = $('#toast')
  t.textContent = msg
  t.classList.toggle('err', isErr)
  t.classList.remove('hidden')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => t.classList.add('hidden'), isErr ? 6000 : 3000)
}

const esc = s =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// ------------------------------------------------------------------ theme

const THEME_KEY = 'easyovl-theme'
function applyTheme(t) {
  if (t) document.documentElement.dataset.theme = t
  else delete document.documentElement.dataset.theme
}
try { applyTheme(localStorage.getItem(THEME_KEY)) } catch {}
$('#theme-toggle').onclick = () => {
  const dark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches
  const next = dark ? 'light' : 'dark'
  applyTheme(next)
  try { localStorage.setItem(THEME_KEY, next) } catch {}
}

// ------------------------------------------------------------------ auth

let setupMode = false
function showAuth(needsSetup) {
  setupMode = needsSetup
  $('#app').classList.add('hidden')
  $('#job').classList.add('hidden')
  $('#auth').classList.remove('hidden')
  $('#auth-hint').textContent = needsSetup
    ? '首次使用，请设置控制台管理密码。'
    : '请输入控制台管理密码。'
  $('#auth-pass2-wrap').classList.toggle('hidden', !needsSetup)
  $('#auth-pass2').required = needsSetup
  $('#auth-pass').autocomplete = needsSetup ? 'new-password' : 'current-password'
  $('#auth-submit').textContent = needsSetup ? '设置密码并进入' : '登录'
  $('#auth-pass').focus()
}

$('#auth-form').onsubmit = async e => {
  e.preventDefault()
  $('#auth-error').textContent = ''
  const password = $('#auth-pass').value
  try {
    if (setupMode) {
      if (password !== $('#auth-pass2').value) throw new Error('两次输入的密码不一致')
      await api('/api/setup', { method: 'POST', body: { password } })
    } else {
      await api('/api/login', { method: 'POST', body: { password } })
    }
    $('#auth-pass').value = ''
    $('#auth-pass2').value = ''
    startApp()
  } catch (err) {
    $('#auth-error').textContent = err.message
  }
}

$('#logout').onclick = async () => {
  await api('/api/logout', { method: 'POST', body: {} }).catch(() => {})
  location.reload()
}

// ------------------------------------------------------------------ navigation

let currentPage = 'overview'
function go(page) {
  currentPage = page
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.page === page))
  $$('.page').forEach(p => p.classList.toggle('hidden', p.dataset.page !== page))
  const isConfig = Boolean($(`.page[data-page="${page}"]`)?.hasAttribute('data-config'))
  $('#savebar').classList.toggle('hidden', !isConfig)
  if (location.hash !== '#' + page) history.replaceState(null, '', '#' + page)
  if (page === 'users') loadUsers()
  if (page === 'logs') loadLogs()
  if (page === 'backups') loadBackups()
  if (page === 'overview') refreshStatus()
  window.scrollTo(0, 0)
}
$$('#nav a').forEach(a => (a.onclick = () => go(a.dataset.page)))
document.addEventListener('click', e => {
  const g = e.target.closest('[data-goto]')
  if (g) {
    e.preventDefault()
    go(g.dataset.goto)
  }
})

// ------------------------------------------------------------------ config form

let config = null
let dirty = false

const getPath = (obj, p) => p.split('.').reduce((o, k) => o?.[k], obj)
function setPath(obj, p, v) {
  const ks = p.split('.')
  const last = ks.pop()
  const t = ks.reduce((o, k) => (o[k] ??= {}), obj)
  t[last] = v
}

function fillForm() {
  for (const el of $$('[data-k]')) {
    const v = getPath(config, el.dataset.k)
    if (el.type === 'checkbox') el.checked = Boolean(v)
    else if (el.type === 'radio') el.checked = String(v) === el.value
    else if (el.hasAttribute('data-secret')) {
      el.value = ''
      const [a, b] = el.dataset.k.split('.')
      el.placeholder = config[a][`${b}Set`] ? '已设置（留空保持不变）' : ''
    } else if (el.tagName === 'SELECT' && v && ![...el.options].some(o => o.value === v)) {
      // keep values for selects whose options are loaded later
      const isZone = el.id === 'cf-zone'
      const o = new Option(isZone ? config.tunnel.zoneName || v : v, v)
      if (isZone) o.dataset.name = config.tunnel.zoneName
      el.add(o)
      el.value = v
    } else el.value = v ?? ''
  }
  setDirty(false)
  syncVisibility()
}

function readForm() {
  const out = {}
  for (const el of $$('[data-k]')) {
    const k = el.dataset.k
    if (el.type === 'checkbox') setPath(out, k, el.checked)
    else if (el.type === 'radio') {
      if (!el.checked) continue
      const v = el.value === 'true' ? true : el.value === 'false' ? false : el.value
      setPath(out, k, v)
    } else if (el.type === 'number') setPath(out, k, Number(el.value))
    else setPath(out, k, el.value)
  }
  const zone = $('#cf-zone')
  out.tunnel.zoneName = zone.selectedOptions[0]?.dataset.name || config?.tunnel.zoneName || ''
  if (!zone.value) out.tunnel.zoneName = ''
  return out
}

function setDirty(d) {
  dirty = d
  $('#dirty-hint').textContent = d ? '修改尚未保存' : '所有修改已保存'
  $('#save').disabled = !d
}

function syncVisibility() {
  const f = readForm()
  $('#sandbox-opts').classList.toggle('hidden', !f.compile.sandbox)
  $$('#email-opts input').forEach(i => (i.disabled = !f.email.enabled))
  $$('.tmode-panel').forEach(p => p.classList.toggle('hidden', p.dataset.tmode !== f.tunnel.mode))
  const z = $('#cf-zone').selectedOptions[0]
  const zn = z?.dataset.name || (f.tunnel.zoneId ? config?.tunnel.zoneName : '')
  $('#cf-preview').textContent = f.tunnel.subdomain && zn ? `https://${f.tunnel.subdomain}.${zn}` : '—'
}

document.addEventListener('input', e => {
  if (e.target.closest('[data-k]')) {
    setDirty(true)
    syncVisibility()
  }
})
document.addEventListener('change', e => {
  if (e.target.closest('[data-k]')) {
    setDirty(true)
    syncVisibility()
  }
})

async function loadConfig() {
  const data = await api('/api/config')
  config = data.config
  $('#site-url-effective').textContent = data.siteUrl
  fillForm()
}

async function save(apply) {
  const btns = [$('#save'), $('#save-apply')]
  btns.forEach(b => (b.disabled = true))
  try {
    const data = await api('/api/config', { method: 'PUT', body: { config: readForm(), apply } })
    config = data.config
    $('#site-url-effective').textContent = data.siteUrl
    fillForm()
    toast(apply ? '已保存，正在应用…' : '已保存')
    if (data.job) watchJob(data.job)
  } catch (err) {
    toast(err.message, true)
    setDirty(true)
  } finally {
    $('#save-apply').disabled = false
  }
}
$('#save').onclick = () => save(false)
$('#save-apply').onclick = () => save(true)

window.addEventListener('beforeunload', e => {
  if (dirty) e.preventDefault()
})

// ------------------------------------------------------------------ tags

async function loadTags() {
  try {
    const { tags, error } = await api('/api/tags')
    const dl = $('#tag-list')
    dl.innerHTML = ''
    for (const t of tags) dl.append(new Option(t.updated ? `${t.updated.slice(0, 10)}` : '', t.name))
    $('#tag-hint').textContent = tags.length
      ? `最新版本：${tags[0].name}（点击输入框可选择）`
      : `无法读取版本列表${error ? '：' + error : ''}`
  } catch {
    $('#tag-hint').textContent = '无法读取版本列表'
  }
}

// ------------------------------------------------------------------ cloudflare

$('#cf-verify').onclick = async () => {
  const btn = $('#cf-verify')
  btn.disabled = true
  $('#cf-msg').textContent = '正在验证…'
  try {
    const apiToken = $('[data-k="tunnel.apiToken"]').value
    const { accounts, zones } = await api('/api/cloudflare/verify', { method: 'POST', body: { apiToken } })
    const acc = $('#cf-account')
    const prevAcc = acc.value
    acc.innerHTML = ''
    for (const a of accounts) acc.add(new Option(a.name, a.id))
    if (accounts.some(a => a.id === prevAcc)) acc.value = prevAcc

    const zone = $('#cf-zone')
    const prevZone = zone.value
    zone.innerHTML = ''
    for (const z of zones) {
      const o = new Option(z.name, z.id)
      o.dataset.name = z.name
      o.dataset.account = z.accountId || ''
      zone.add(o)
    }
    if (zones.some(z => z.id === prevZone)) zone.value = prevZone
    if (!accounts.length) throw new Error('令牌看不到任何帐户，请检查「帐户设置 · 读取」权限')
    if (!zones.length) throw new Error('令牌看不到任何域名，请检查「区域 · 区域 · 读取」权限，并确认域名已接入 Cloudflare')
    $('#cf-msg').textContent = `验证成功：${accounts.length} 个帐户，${zones.length} 个域名。选择后点击「保存并应用」。`
    setDirty(true)
    syncVisibility()
  } catch (err) {
    $('#cf-msg').textContent = err.message
    toast(err.message, true)
  } finally {
    btn.disabled = false
  }
}

$('#cf-zone').addEventListener('change', () => {
  const acc = $('#cf-zone').selectedOptions[0]?.dataset.account
  if (acc && [...$('#cf-account').options].some(o => o.value === acc)) $('#cf-account').value = acc
})

// ------------------------------------------------------------------ status

let lastStatus = null
const STATE_TEXT = { running: '运行中', exited: '已停止', created: '已创建', restarting: '重启中', paused: '已暂停', dead: '异常' }
const SERVICE_NAME = { sharelatex: 'Overleaf', mongo: 'MongoDB', redis: 'Redis', cloudflared: 'Cloudflared' }

function dot(cls) {
  return `<span class="dot ${cls}"></span>`
}

async function refreshStatus() {
  let s
  try {
    s = await api('/api/status')
  } catch {
    return
  }
  lastStatus = s

  // docker
  $('#docker-warning').classList.toggle('hidden', s.docker.ok)
  if (!s.docker.ok) {
    $('#docker-warning').innerHTML = `无法连接 Docker：<code>${esc(s.docker.error || '未知错误')}</code><br>请确认 Docker Desktop 已启动，并且控制台容器挂载了 <code>/var/run/docker.sock</code>。`
  }
  $('#st-docker').innerHTML = s.docker.ok ? `${dot('ok')}已连接` : `${dot('bad')}未连接`
  $('#st-docker-sub').textContent = s.docker.ok ? `Docker ${s.docker.version}` : ''

  // overleaf
  const ol = s.containers.find(c => c.service === 'sharelatex')
  let olHtml
  if (!ol) olHtml = `${dot('')}未部署`
  else if (ol.state !== 'running') olHtml = `${dot('bad')}${STATE_TEXT[ol.state] || ol.state}`
  else if (s.overleaf.reachable) olHtml = `${dot('ok')}运行中`
  else olHtml = `${dot('busy')}正在启动…`
  $('#st-overleaf').innerHTML = olHtml
  $('#st-image').textContent = s.image

  // tunnel
  const t = s.tunnel
  const modeText = { off: '已关闭', quick: '快速隧道', token: '隧道令牌', api: '自动配置' }[t.mode]
  if (t.mode === 'off') $('#st-tunnel').innerHTML = `${dot('')}已关闭`
  else $('#st-tunnel').innerHTML = t.running ? `${dot('ok')}${modeText}` : `${dot('bad')}${modeText}（未运行）`
  $('#st-tunnel-sub').textContent = t.publicUrl || ''
  $('#quick-url').textContent = t.mode === 'quick' && t.publicUrl ? t.publicUrl : '（启动后显示）'
  if (t.publicUrl && t.mode === 'quick') $('#quick-url').href = t.publicUrl
  $('#stale-hint').classList.toggle('hidden', !t.quickUrlStale)

  // links
  const host = location.hostname
  const local = `http://${host.includes(':') ? `[${host}]` : host}:${s.port}`
  const rows = [['本机', local]]
  if (host !== 'localhost' && host !== '127.0.0.1') rows.unshift(['本机', `http://localhost:${s.port}`])
  if (t.publicUrl) rows.push(['公网', t.publicUrl])
  rows.push(['站点地址', s.siteUrl])
  $('#links').innerHTML = rows
    .filter((r, i, a) => a.findIndex(x => x[1] === r[1]) === i)
    .map(([k, u]) => `<div class="link-row"><span class="tag">${k}</span><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u)}</a></div>`)
    .join('')

  // hints
  $('#first-run').classList.toggle('hidden', !s.docker.ok || s.containers.length > 0)
  const needsAdmin = s.overleaf.reachable && s.overleaf.needsAdmin
  $('#admin-hint').classList.toggle('hidden', !needsAdmin)
  if (needsAdmin) {
    $('#admin-hint').innerHTML = `Overleaf 已就绪！还没有管理员账号，请打开 <a href="${esc(local)}/launchpad" target="_blank" rel="noopener">${esc(local)}/launchpad</a> 创建第一个管理员。`
  }

  // containers
  const tbody = $('#containers')
  if (!s.containers.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="muted">尚未创建容器</td></tr>'
  } else {
    tbody.innerHTML = s.containers
      .map(c => {
        const cls = c.state === 'running' ? (c.health === 'unhealthy' ? 'warn' : 'ok') : 'bad'
        return `<tr>
          <td><strong>${esc(SERVICE_NAME[c.service] || c.service)}</strong></td>
          <td><span class="pill">${dot(cls)}${esc(c.status || STATE_TEXT[c.state] || c.state)}</span></td>
          <td class="muted">${esc(c.image)}</td>
          <td style="white-space:nowrap">
            <button class="btn small" data-svc-action="restart" data-svc="${esc(c.service)}">重启</button>
            <button class="btn small" data-svc-log="${esc(c.service)}">日志</button>
          </td></tr>`
      })
      .join('')
  }

  if (s.job && (!jobState || jobState.id !== s.job.id)) watchJob(s.job.id)
}

document.addEventListener('click', async e => {
  const a = e.target.closest('[data-action]')
  if (a) {
    const action = a.dataset.action
    if (action === 'down' && !confirm('移除全部容器？数据卷会保留，之后可以重新启动。')) return
    if (action === 'stop' && !confirm('停止 Overleaf？正在编辑的用户会断开连接。')) return
    try {
      if (action === 'apply') {
        if (dirty && !confirm('有未保存的修改，是否先保存再应用？')) return
        if (dirty) return save(true)
        const { job } = await api('/api/apply', { method: 'POST', body: {} })
        watchJob(job)
      } else {
        const { job } = await api('/api/action', { method: 'POST', body: { action } })
        watchJob(job)
      }
    } catch (err) {
      toast(err.message, true)
    }
  }
  const sa = e.target.closest('[data-svc-action]')
  if (sa) {
    try {
      const { job } = await api('/api/action', { method: 'POST', body: { action: sa.dataset.svcAction, service: sa.dataset.svc } })
      watchJob(job)
    } catch (err) {
      toast(err.message, true)
    }
  }
  const sl = e.target.closest('[data-svc-log]')
  if (sl) {
    $('#log-service').value = sl.dataset.svcLog
    go('logs')
  }
})

// ------------------------------------------------------------------ jobs

let jobState = null
let jobTimer = null

function watchJob(id) {
  clearTimeout(jobTimer)
  jobState = { id, since: 0 }
  $('#job-log').textContent = ''
  $('#job').classList.remove('hidden', 'min')
  document.body.classList.add('job-open')
  document.body.classList.remove('job-min')
  $('#job-toggle').textContent = '收起'
  pollJob()
}

async function pollJob() {
  if (!jobState) return
  try {
    const j = await api(`/api/jobs/${jobState.id}?since=${jobState.since}`)
    jobState.since = j.total
    const pre = $('#job-log')
    const atBottom = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 30
    if (j.lines.length) pre.textContent += j.lines.join('\n') + '\n'
    if (atBottom) pre.scrollTop = pre.scrollHeight
    $('#job-title').textContent = j.title
    $('#job-status').textContent = { running: '进行中…', success: '已完成', failed: '失败' }[j.status]
    $('#job-dot').className = 'dot ' + ({ running: 'busy', success: 'ok', failed: 'bad' }[j.status])
    if (j.status === 'running') {
      jobTimer = setTimeout(pollJob, 1000)
    } else {
      if (j.status === 'failed') toast(`${j.title}：失败，请查看日志`, true)
      else toast(`${j.title}：完成`)
      refreshStatus()
      if (currentPage === 'backups') loadBackups()
    }
  } catch {
    jobTimer = setTimeout(pollJob, 3000)
  }
}

$('#job-close').onclick = () => {
  $('#job').classList.add('hidden')
  document.body.classList.remove('job-open', 'job-min')
}
$('#job-toggle').onclick = () => {
  const min = $('#job').classList.toggle('min')
  document.body.classList.toggle('job-min', min)
  $('#job-toggle').textContent = min ? '展开' : '收起'
}

// ------------------------------------------------------------------ users

async function loadUsers() {
  const tbody = $('#users')
  try {
    const { users } = await api('/api/users')
    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="muted">还没有用户</td></tr>'
      return
    }
    const d = v => (v ? new Date(v).toLocaleString() : '—')
    tbody.innerHTML = users
      .map(
        u => `<tr><td>${esc(u.email)}</td><td>${esc([u.first_name, u.last_name].filter(Boolean).join(' ') || '—')}</td>
        <td>${u.isAdmin ? '<span class="badge">管理员</span>' : '用户'}</td><td>${d(u.signUpDate)}</td><td>${d(u.lastLoggedIn)}</td></tr>`
      )
      .join('')
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">${esc(err.message)}</td></tr>`
  }
}
$('#users-refresh').onclick = loadUsers

$('#user-form').onsubmit = async e => {
  e.preventDefault()
  const btn = e.submitter
  btn.disabled = true
  const box = $('#user-result')
  try {
    const r = await api('/api/users', {
      method: 'POST',
      body: { email: $('#user-email').value.trim(), admin: $('#user-admin').checked },
    })
    let html = `<strong>已创建 ${esc($('#user-email').value)}</strong><br>`
    if (r.setPasswordUrl) {
      const u = new URL(r.setPasswordUrl)
      const localUrl = `http://${location.hostname}:${lastStatus?.port || 8080}${u.pathname}${u.search}`
      html += `设置密码链接（发给对方）：<br><a href="${esc(r.setPasswordUrl)}" target="_blank" rel="noopener">${esc(r.setPasswordUrl)}</a>`
      if (localUrl !== r.setPasswordUrl) html += `<br><span class="muted">本机访问：</span><a href="${esc(localUrl)}" target="_blank" rel="noopener">${esc(localUrl)}</a>`
    } else {
      html += `<pre class="console">${esc(r.output)}</pre>`
    }
    box.innerHTML = html
    box.classList.remove('hidden')
    $('#user-email').value = ''
    loadUsers()
  } catch (err) {
    box.innerHTML = `<span class="error">${esc(err.message)}</span>`
    box.classList.remove('hidden')
  } finally {
    btn.disabled = false
  }
}

// ------------------------------------------------------------------ logs

let logTimer
async function loadLogs() {
  clearTimeout(logTimer)
  if (currentPage !== 'logs') return
  const pre = $('#log-text')
  try {
    const { text } = await api(`/api/logs?service=${$('#log-service').value}&tail=${$('#log-tail').value}`)
    const atBottom = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 30 || !pre.textContent
    pre.textContent = text
    if (atBottom) pre.scrollTop = pre.scrollHeight
  } catch (err) {
    pre.textContent = err.message
  }
  if ($('#log-follow').checked) logTimer = setTimeout(loadLogs, 3000)
}
$('#log-refresh').onclick = loadLogs
$('#log-service').onchange = () => {
  $('#log-text').textContent = ''
  loadLogs()
}
$('#log-tail').onchange = loadLogs
$('#log-follow').onchange = loadLogs

// ------------------------------------------------------------------ backups

const fmtSize = n => (n > 1e9 ? (n / 1e9).toFixed(2) + ' GB' : n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : (n / 1e3).toFixed(0) + ' KB')

async function loadBackups() {
  const tbody = $('#backups')
  try {
    const { backups } = await api('/api/backups')
    if (!backups.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="muted">暂无备份</td></tr>'
      return
    }
    tbody.innerHTML = backups
      .map(
        b => `<tr>
        <td>${esc(b.createdAt ? new Date(b.createdAt).toLocaleString() : b.name)}</td>
        <td class="muted">${esc(b.image || '—')}</td>
        <td>${b.files
          .filter(f => f.name !== 'meta.json')
          .map(f => `<a href="/api/backups/${encodeURIComponent(b.name)}/${encodeURIComponent(f.name)}">${esc(f.name)}</a> <span class="muted">${fmtSize(f.size)}</span>`)
          .join('<br>')}</td>
        <td style="white-space:nowrap">
          <button class="btn small" data-restore="${esc(b.name)}">恢复</button>
          <button class="btn small danger-outline" data-del-backup="${esc(b.name)}">删除</button>
        </td></tr>`
      )
      .join('')
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="muted">${esc(err.message)}</td></tr>`
  }
}

$('#backup-create').onclick = async () => {
  try {
    const { job } = await api('/api/backups', { method: 'POST', body: {} })
    watchJob(job)
  } catch (err) {
    toast(err.message, true)
  }
}

document.addEventListener('click', async e => {
  const r = e.target.closest('[data-restore]')
  if (r) {
    if (!confirm(`用备份 ${r.dataset.restore} 覆盖当前全部数据？\n\n当前的数据库和项目文件会被替换，无法撤销。建议先做一次新备份。`)) return
    try {
      const { job } = await api(`/api/backups/${encodeURIComponent(r.dataset.restore)}/restore`, { method: 'POST', body: {} })
      watchJob(job)
    } catch (err) {
      toast(err.message, true)
    }
  }
  const d = e.target.closest('[data-del-backup]')
  if (d) {
    if (!confirm(`永久删除备份 ${d.dataset.delBackup}？此操作无法撤销。`)) return
    try {
      await api(`/api/backups/${encodeURIComponent(d.dataset.delBackup)}`, { method: 'DELETE' })
      loadBackups()
    } catch (err) {
      toast(err.message, true)
    }
  }
})

// ------------------------------------------------------------------ advanced

$('#compose-preview').onclick = async () => {
  try {
    const { yaml } = await api('/api/compose')
    const pre = $('#compose-text')
    pre.textContent = yaml.replace(/(TUNNEL_TOKEN|OVERLEAF_EMAIL_SMTP_PASS): ".*"/g, '$1: "******"')
    pre.classList.remove('hidden')
  } catch (err) {
    toast(err.message, true)
  }
}

$('#pw-form').onsubmit = async e => {
  e.preventDefault()
  try {
    await api('/api/password', {
      method: 'POST',
      body: { oldPassword: $('#pw-old').value, newPassword: $('#pw-new').value },
    })
    toast('密码已修改，请重新登录')
    setTimeout(() => location.reload(), 1200)
  } catch (err) {
    toast(err.message, true)
  }
}

// ------------------------------------------------------------------ boot

let statusTimer
async function startApp() {
  $('#auth').classList.add('hidden')
  $('#app').classList.remove('hidden')
  await loadConfig()
  loadTags()
  const page = location.hash.slice(1)
  go($(`.page[data-page="${page}"]`) ? page : 'overview')
  clearInterval(statusTimer)
  statusTimer = setInterval(() => {
    if (currentPage === 'overview' && !document.hidden) refreshStatus()
  }, 5000)
  // pick up a job started elsewhere
  try {
    const { current } = await api('/api/jobs')
    if (current) watchJob(current)
  } catch {}
}

;(async () => {
  try {
    const s = await api('/api/session')
    if (s.authenticated) startApp()
    else showAuth(s.needsSetup)
  } catch {
    showAuth(false)
  }
})()
