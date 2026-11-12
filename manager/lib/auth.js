import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { DATA_DIR } from './config.js'

const AUTH_FILE = path.join(DATA_DIR, 'auth.json')
const SESSION_TTL = 7 * 24 * 3600 * 1000
const sessions = new Map()

function readAuth() {
  try {
    return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'))
  } catch {
    return null
  }
}

export function hasPassword() {
  return Boolean(readAuth()?.hash)
}

export function setPassword(password) {
  if (typeof password !== 'string' || password.length < 6) {
    throw Object.assign(new Error('密码至少 6 位'), { status: 400 })
  }
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ salt, hash }))
  sessions.clear()
}

export function checkPassword(password) {
  const a = readAuth()
  if (!a?.hash || typeof password !== 'string') return false
  const h = crypto.scryptSync(password, a.salt, 64)
  return crypto.timingSafeEqual(h, Buffer.from(a.hash, 'hex'))
}

export function createSession() {
  const id = crypto.randomBytes(32).toString('hex')
  sessions.set(id, Date.now() + SESSION_TTL)
  return id
}

export function destroySession(id) {
  sessions.delete(id)
}

export function sessionFromReq(req) {
  const m = /(?:^|;\s*)easyovl_sid=([a-f0-9]{64})/.exec(req.headers.cookie || '')
  if (!m) return null
  const exp = sessions.get(m[1])
  if (!exp || exp < Date.now()) {
    sessions.delete(m[1])
    return null
  }
  return m[1]
}

export function sessionCookie(id, maxAgeSec = SESSION_TTL / 1000) {
  return `easyovl_sid=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSec}`
}
