import type { ActiveDuo, BattleUnit } from '@/types'

/** Stamp player-only Duo flags onto the battle units. Left = player. Called once at battle start.
 *  Each Duo appends its own branch here (kept data-light: flags only, logic lives per-primitive). */
export function stampDuoFields(
  left: BattleUnit[], right: BattleUnit[], duos: ActiveDuo[], _kind: 'normal' | 'elite' | 'boss',
): void {
  const has = (id: string) => duos.some(d => d.duo.id === id)
  if (has('miasma')) for (const u of left) u.spreadsPoison = true
  if (has('cancrena')) for (const u of right) u.poisonAmp = { threshold: 0.4, mult: 2 }
  // MURO VIVENTE / ESECUZIONE A FREDDO / MIETITORE / UNTORE branches added by their tasks.
}
