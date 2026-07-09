import type { RunLog } from '@/game/engine/endlessReplay'

// Runs both server-side (Node, has Buffer) and client-side (browser bundle — Next.js
// does NOT polyfill Buffer for client code, confirmed against the edge-runtime global
// list in node_modules/next/dist/docs, which lists no Buffer). getChallengeCode() is
// called from the client (hooks/useEndless.ts), so both codecs must work without Buffer.
function hasBuffer(): boolean {
  return typeof Buffer !== 'undefined'
}

function toBase64url(s: string): string {
  const b64 = hasBuffer()
    ? Buffer.from(s, 'utf8').toString('base64')
    : btoa(String.fromCharCode(...new TextEncoder().encode(s)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromBase64url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  if (hasBuffer()) return Buffer.from(b64, 'base64').toString('utf8')
  const binary = atob(b64)
  const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0))
  return new TextDecoder().decode(bytes)
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
