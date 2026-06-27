import type { RunState } from '@/types'

export interface RunSummary { areasCleared: number; teamSize: number; avgLevel: number; relics: number }

export function runSummary(state: RunState): RunSummary {
  const team = state.team
  const avg = team.length ? team.reduce((a, d) => a + (d.level ?? 1), 0) / team.length : 0
  return {
    areasCleared: (state.area ?? 0) + 1,
    teamSize: team.length,
    avgLevel: Math.round(avg * 10) / 10,
    relics: state.relics.length,
  }
}
