import { getStore } from '@netlify/blobs'
import { decodeChallenge } from '@/lib/challengeCode'
import { replayRun, ENGINE_VERSION } from '@/game/engine/endlessReplay'
import { scoreForEndlessRun, globalFloor } from '@/game/engine/endless'

const MAX_ENTRIES = 100

/** Anti-cheat gate for a submitted Endless run: decodes and RE-SIMULATES the challenge
 *  code (replayRun enforces strict legality — see game/engine/endlessReplay.ts), then
 *  computes score/floor from the resulting server-side state. The client's own numbers
 *  are never trusted: the request body carries only `challengeCode` and `nickname`,
 *  so there is no client-claimed score field to even smuggle a forged value through. */
export async function processSubmission(body: { challengeCode: string; nickname: string }):
  Promise<{ status: number; body: unknown }> {
  let log
  try { log = decodeChallenge(body.challengeCode) } catch { return { status: 400, body: { error: 'malformed' } } }
  if (log.engine !== ENGINE_VERSION) return { status: 409, body: { error: 'engine mismatch' } }

  const { state, valid, reason } = replayRun(log)
  if (!valid) return { status: 400, body: { error: 'invalid replay', reason } }

  const nickname = (body.nickname ?? '').trim().slice(0, 20) || 'Anon'
  const score = scoreForEndlessRun(state)
  const floor = globalFloor(state)

  const store = getStore('endless-leaderboard')
  // NOTE: @netlify/blobs@10.7.9's `get` overload needs the `{ type: 'text' }` arg to
  // resolve to a string (same pattern as netlify/functions/leaderboard.ts's readLeaderboard).
  const raw = await store.get('top', { type: 'text' })
  const list: { nickname: string; score: number; floor: number }[] = raw ? JSON.parse(raw) : []
  list.push({ nickname, score, floor })
  list.sort((a, b) => b.score - a.score)
  const top = list.slice(0, MAX_ENTRIES)
  await store.set('top', JSON.stringify(top))
  const rank = top.findIndex(e => e.score === score && e.nickname === nickname) + 1
  return { status: 200, body: { rank, score, floor } }
}

export default async function handler(req: Request): Promise<Response> {
  try {
    const body = await req.json()
    const { status, body: out } = await processSubmission(body)
    return new Response(JSON.stringify(out), { status, headers: { 'content-type': 'application/json' } })
  } catch {
    return new Response(JSON.stringify({ error: 'server' }), { status: 500 })
  }
}
