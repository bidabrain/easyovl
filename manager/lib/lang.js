// Server-side language for error messages and job logs.
// The console is single-admin, so the language of the most recent request
// (X-Lang header sent by the browser) is used for messages created after it.
import { LANGS, translate } from '../public/i18n.js'

let current = 'zh'

export function setLangFromRequest(req) {
  const l = String(req.headers['x-lang'] || '').toLowerCase()
  if (LANGS.includes(l)) current = l
}

/** Translate a Chinese source string; {name} placeholders come from vars. */
export const t = (s, vars) => translate(current, s, vars)
