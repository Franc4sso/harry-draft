import { describe, it, expect } from 'vitest'
import { detectSynergies } from '@/game/engine/synergy'
import { teamExecute } from '@/game/engine/execute'
import { bumpExecuteThreshold } from '@/game/engine/duoEffects/reap'
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
  it('alza la soglia execute della squadra, capata', () => {
    const u = (): BattleUnit => ({ execute: { threshold: 0.35, bonus: 0.25 } } as unknown as BattleUnit)
    const team = [u(), u()]
    bumpExecuteThreshold(team)
    expect(team[0]!.execute!.threshold).toBeCloseTo(0.40) // +0.05
    expect(team[1]!.execute!.threshold).toBeCloseTo(0.40) // squadra intera
    for (let i = 0; i < 20; i++) bumpExecuteThreshold(team)
    expect(team[0]!.execute!.threshold).toBeLessThanOrEqual(0.6) // cap
  })
  it('è un no-op sicuro su unità senza execute', () => {
    const team = [{} as BattleUnit]
    expect(() => bumpExecuteThreshold(team)).not.toThrow()
  })
})
