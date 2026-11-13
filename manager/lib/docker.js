import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import { NETWORK, PROJECT } from './config.js'
import { COMPOSE_FILE } from './compose.js'
import { t } from './lang.js'

const DOCKER = process.env.DOCKER_BIN || 'docker'

/** Run a command, collect output. Never throws; returns { code, stdout, stderr }. */
export function run(args, { timeout = 60000, input, stdoutFile } = {}) {
  return new Promise(resolve => {
    let child
    let out
    try {
      out = stdoutFile ? fs.openSync(stdoutFile, 'w') : null
      child = spawn(DOCKER, args, {
        stdio: [input ? 'pipe' : 'ignore', out ?? 'pipe', 'pipe'],
      })
    } catch (err) {
      if (out) fs.closeSync(out)
      return resolve({ code: -1, stdout: '', stderr: String(err.message) })
    }
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', d => (stdout += d))
    child.stderr.on('data', d => (stderr += d))
    if (input) {
      if (typeof input === 'string') child.stdin.end(input)
      else input.pipe(child.stdin)
    }
    const timer = timeout
      ? setTimeout(() => child.kill('SIGKILL'), timeout)
      : null
    child.on('error', err => {
      stderr += err.message
    })
    child.on('close', code => {
      if (timer) clearTimeout(timer)
      if (out) fs.closeSync(out)
      resolve({ code: code ?? -1, stdout, stderr })
    })
  })
}

export const composeArgs = (...rest) => [
  'compose',
  '-p',
  PROJECT,
  '-f',
  COMPOSE_FILE,
  ...rest,
]

// ---------------- jobs: long running operations with streamed logs -------------

const jobs = new Map()
let jobSeq = 0
let activeJob = null

export function getJob(id) {
  return jobs.get(id)
}

export function currentJob() {
  return activeJob && activeJob.status === 'running' ? activeJob : null
}

export function listJobs() {
  return [...jobs.values()]
    .slice(-20)
    .reverse()
    .map(({ id, title, status, startedAt, endedAt }) => ({
      id,
      title,
      status,
      startedAt,
      endedAt,
    }))
}

/**
 * Start a job. `fn(ctx)` receives { log, step } helpers. Only one job at a time.
 */
export function startJob(title, fn) {
  if (currentJob()) {
    const err = new Error(t('已有任务正在运行：{title}', { title: activeJob.title }))
    err.status = 409
    throw err
  }
  const job = {
    id: String(++jobSeq),
    title,
    status: 'running',
    lines: [],
    startedAt: Date.now(),
    endedAt: null,
  }
  jobs.set(job.id, job)
  if (jobs.size > 50) jobs.delete(jobs.keys().next().value)
  activeJob = job

  const log = text => {
    for (const line of String(text).split(/\r?\n|\r/)) {
      if (line.trim()) job.lines.push(line)
    }
    if (job.lines.length > 5000) job.lines.splice(0, job.lines.length - 5000)
  }

  /** run docker with live log streaming; throws on non-zero exit */
  const step = (args, { allowFail = false, label } = {}) =>
    new Promise((resolve, reject) => {
      log(`$ ${label || 'docker ' + args.join(' ')}`)
      let child
      try {
        child = spawn(DOCKER, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      } catch (err) {
        log(err.message)
        return allowFail ? resolve(-1) : reject(err)
      }
      child.stdout.on('data', log)
      child.stderr.on('data', log)
      child.on('error', err => log(err.message))
      child.on('close', code => {
        if (code === 0 || allowFail) resolve(code)
        else reject(new Error(t('命令失败 (exit {code})', { code })))
      })
    })

  Promise.resolve()
    .then(() => fn({ log, step, job }))
    .then(
      () => {
        job.status = 'success'
        log(t('✔ 完成'))
      },
      err => {
        job.status = 'failed'
        log(`✘ ${err.message}`)
      }
    )
    .finally(() => {
      job.endedAt = Date.now()
    })
  return job
}

// ---------------- helpers ----------------

export async function dockerAvailable() {
  const r = await run(['version', '--format', '{{.Server.Version}}'], {
    timeout: 10000,
  })
  return r.code === 0
    ? { ok: true, version: r.stdout.trim() }
    : { ok: false, error: (r.stderr || r.stdout).trim() }
}

export async function imageExists(image) {
  const r = await run(['image', 'inspect', image, '--format', '{{.Id}}'])
  return r.code === 0
}

export async function containerStatus() {
  if (!fs.existsSync(COMPOSE_FILE)) return []
  const r = await run(composeArgs('ps', '-a', '--format', 'json'))
  if (r.code !== 0) return []
  const text = r.stdout.trim()
  if (!text) return []
  let rows
  try {
    rows = text.startsWith('[') ? JSON.parse(text) : text.split('\n').map(l => JSON.parse(l))
  } catch {
    return []
  }
  return rows.map(r => ({
    service: r.Service,
    name: r.Name,
    image: r.Image,
    state: r.State,
    status: r.Status,
    health: r.Health || '',
    exitCode: Number.isFinite(r.ExitCode) ? r.ExitCode : null,
  }))
}

/**
 * Put the manager container itself on the stack network so it can reach
 * http://sharelatex/ directly (health checks, launchpad detection).
 */
export async function ensureNetwork() {
  const inspect = await run(['network', 'inspect', NETWORK])
  if (inspect.code !== 0) {
    const created = await run(['network', 'create', NETWORK])
    if (created.code !== 0) return false
  }
  if (fs.existsSync('/.dockerenv')) {
    const self = os.hostname()
    const r = await run(['network', 'connect', NETWORK, self])
    if (r.code !== 0 && !/already exists|already attached/i.test(r.stderr)) {
      console.warn('network connect failed:', r.stderr.trim())
    }
  }
  return true
}
