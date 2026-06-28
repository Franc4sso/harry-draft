import type { RunState } from '@/types'

export const RUN_KEY = 'harry:run:v1'
// v2: Fase 1 Polish changed the run schema (house/starter phases replaced by a
// `draft` phase; map wiring + level fields). Bumping discards incompatible v1
// runs so a stale save can't render an empty/broken screen.
const VERSION = 2

function ls(): Storage | null {
  return typeof localStorage !== 'undefined' ? localStorage : null
}

export function saveRun(state: RunState): void {
  const store = ls()
  if (!store) return
  store.setItem(RUN_KEY, JSON.stringify({ version: VERSION, state }))
}

export function loadRun(): RunState | null {
  const store = ls()
  if (!store) return null
  const raw = store.getItem(RUN_KEY)
  if (!raw) return null
  try {
    const env = JSON.parse(raw) as { version?: number; state?: RunState }
    if (env.version !== VERSION || !env.state) return null
    return env.state
  } catch {
    return null
  }
}

export function clearRun(): void {
  ls()?.removeItem(RUN_KEY)
}
