import type { ActiveDuo, BattleUnit } from '@/types'

/** Stamp player-only Duo flags onto the battle units. Left = player. Called once at battle start.
 *  Each Duo appends its own branch here (kept data-light: flags only, logic lives per-primitive). */
export function stampDuoFields(
  left: BattleUnit[], right: BattleUnit[], duos: ActiveDuo[], kind: 'normal' | 'elite' | 'boss',
): void {
  const has = (id: string) => duos.some(d => d.duo.id === id)
  if (has('miasma')) for (const u of left) u.spreadsPoison = true
  if (has('cancrena')) for (const u of right) u.poisonAmp = { threshold: 0.4, mult: 2 }
  if (has('muro-vivente')) for (const u of left) if (u.wizard.role === 'Tank') u.livingWall = true
  if (has('esecuzione-a-freddo')) {
    // Boss battles must stay hard: no true instakill on the climax boss, only bonus damage.
    const instakill = kind !== 'boss'
    for (const u of left) u.coldExecute = { threshold: 0.5, instakill }
  }
  // MIETITORE / UNTORE branches added by their tasks.
}
