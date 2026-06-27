import type { RunState } from '@/types'

export const RUN_KEY = 'harry:run:v1'
const VERSION = 1

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
