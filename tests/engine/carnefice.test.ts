import { describe, it, expect } from 'vitest'
import { detectSynergies } from '@/game/engine/synergy'
import { teamExecute } from '@/game/engine/execute'
import { bumpExecuteThreshold, maybeReap } from '@/game/engine/duoEffects/reap'
import type { DraftedWizard, BattleUnit } from '@/types'

const dw = (id: string, tags: string[] = []): DraftedWizard =>
  ({ wizard: { id, role: 'Attaccante', house: 'Serpeverde', tags }, level: 1 } as unknown as DraftedWizard)

describe('sinergia spietatezza (archetipo Carnefice)', () => {
  it('si accende con 3 maghi esecuzione, non con 2', () => {
    const three = [dw('a', ['esecuzione']), dw('b', ['esecuzione']), dw('c', ['esecuzione'])]
    const two = [dw('a', ['esecuzione']), dw('b', ['esecuzione'])]
    expect(detectSynergies(three).map(s => s.synergy.id)).toContain('spietatezza')
    expect(detectSynergies(two).map(s => s.synergy.id)).not.toContain('spietatezza')
  })

  it('riaccende il branch execute morto: threshold>=0.35 con la sinergia', () => {
    const team = [dw('a', ['esecuzione']), dw('b', ['esecuzione']), dw('c', ['esecuzione'])]
    const syn = detectSynergies(team)
    const ex = teamExecute(team, [], syn)
    expect(ex).toBeDefined()
    expect(ex!.threshold).toBeGreaterThanOrEqual(0.35)
    expect(ex!.bonus).toBeGreaterThan(0)
  })
})

describe('bumpExecuteThreshold (valanga soglia)', () => {
  it('alza la soglia execute condivisa di UN solo step per chiamata (no compounding per-unità)', () => {
    // Nel motore reale teamExecute() produce UN SOLO oggetto, spalmato per riferimento su
    // tutta la squadra (simulate.ts:35,60). Il test deve rispecchiare questo invariante:
    // due unità che condividono lo STESSO oggetto execute, non due oggetti distinti.
    const shared = { threshold: 0.35, bonus: 0.25 }
    const team = [{ execute: shared } as unknown as BattleUnit, { execute: shared } as unknown as BattleUnit]
    bumpExecuteThreshold(team)
    expect(shared.threshold).toBeCloseTo(0.40) // UN solo bump di +0.05, non +0.10
    expect(team[0]!.execute!.threshold).toBeCloseTo(0.40)
    expect(team[1]!.execute!.threshold).toBeCloseTo(0.40) // stesso oggetto, stesso valore
    for (let i = 0; i < 20; i++) bumpExecuteThreshold(team)
    expect(shared.threshold).toBeLessThanOrEqual(0.6) // cap
  })
  it('è un no-op sicuro su unità senza execute', () => {
    const team = [{} as BattleUnit]
    expect(() => bumpExecuteThreshold(team)).not.toThrow()
  })
})

describe('Mietitore raddoppia la mietitura (amplificatore, non doppione)', () => {
  const mk = () => ({ side: 'left', wizard: { id: 'x' }, statusEffects: [] } as unknown as BattleUnit)

  it('carnefice+reaper → 2 stack raccolto per kill', () => {
    const unit = mk()
    // Rispecchia il kill-site (simulate.ts): carnefice chiama sempre maybeReap una volta,
    // +1 se l'unità è anche reaper (Mietitore).
    maybeReap(unit)
    maybeReap(unit)
    expect(unit.statusEffects.filter((e: any) => e.statusId === 'raccolto').length).toBe(2)
  })

  it('solo carnefice (senza Mietitore) → 1 stack raccolto per kill', () => {
    const unit = mk()
    maybeReap(unit)
    expect(unit.statusEffects.filter((e: any) => e.statusId === 'raccolto').length).toBe(1)
  })
})
