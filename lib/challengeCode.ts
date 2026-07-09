import type { RunLog } from '@/game/engine/endlessReplay'

function toBase64url(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromBase64url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(b64, 'base64').toString('utf8')
}

export function encodeChallenge(log: RunLog): string {
  return toBase64url(JSON.stringify(log))
}

export function decodeChallenge(s: string): RunLog {
  let parsed: unknown
  try { parsed = JSON.parse(fromBase64url(s)) } catch { throw new Error('challenge: malformed') }
  const log = parsed as RunLog
  if (!log || log.v !== 1 || typeof log.seed !== 'string' || !Array.isArray(log.actions)) {
    throw new Error('challenge: invalid or unsupported version')
  }
  return log
}
