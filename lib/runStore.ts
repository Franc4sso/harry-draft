import type { RunState } from '@/types'

export const RUN_KEY = 'harry:run:v1'
// Endless persists under a SEPARATE key from campaign's RUN_KEY. Both useRunB and
// useEndless funnel every commit through useRunShared's single `commit` → `saveRun`
// path, so without a distinct key an in-progress endless run and an in-progress
// campaign run would silently clobber each other's save (e.g. leaving the campaign
// menu's "Continua run" pointing at whichever mode was played most recently). See
// AGENDA item 1 in the Task 7 brief.
export const RUN_KEY_ENDLESS = 'harry:run:endless:v1'
// v2: Fase 1 Polish changed the run schema (house/starter phases replaced by a
// `draft` phase; map wiring + level fields). Bumping discards incompatible v1
// runs so a stale save can't render an empty/broken screen.
// v3: Onda 1.e (2026-07-25) removed the spellForge/spellSwap/shop node types from
// RunNodeType/RunPhase. A v2 save can still reference one of those node ids on its
// map, so bumping again discards pre-Onda-1.e runs for the same reason as v2 did.
const VERSION = 3

function ls(): Storage | null {
  return typeof localStorage !== 'undefined' ? localStorage : null
}

export function saveRun(state: RunState, key: string = RUN_KEY): void {
  const store = ls()
  if (!store) return
  store.setItem(key, JSON.stringify({ version: VERSION, state }))
}

export function loadRun(key: string = RUN_KEY): RunState | null {
  const store = ls()
  if (!store) return null
  const raw = store.getItem(key)
  if (!raw) return null
  try {
    const env = JSON.parse(raw) as { version?: number; state?: RunState }
    if (env.version !== VERSION || !env.state) return null
    return env.state
  } catch {
    return null
  }
}

export function clearRun(key: string = RUN_KEY): void {
  ls()?.removeItem(key)
}
