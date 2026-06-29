import { describe, it, expect } from 'vitest'
import { teamShieldConvert } from '@/game/engine/shieldConvert'
import type { ActiveRelic, ActiveSynergy, DraftedWizard } from '@/types'

const team = [] as unknown as DraftedWizard[]
const egida: ActiveRelic = { relic: { id: 'egida-tassorosso', name: 'Egida', desc: '', rarity: 'rara', grantsShieldConvert: { rate: 0.5 } }, stageObtained: 0 }
const cuore: ActiveRelic = { relic: { id: 'cuore-del-tasso', name: 'Cuore', desc: '', rarity: 'non-comune', keywords: ['scudo'], keywordMult: { scudo: 0.5 } }, stageObtained: 0 }
const bastione: ActiveSynergy = { synergy: { id: 'bastione', name: 'Bastione', kind: 'origin', requires: { tag: 'scudirigen', count: 3 }, bonus: {} }, memberIds: [] }

describe('teamShieldConvert', () => {
  it('is undefined with no source', () => {
    expect(teamShieldConvert(team, [], [])).toBeUndefined()
  })
  it('a grant relic yields its rate', () => {
    expect(teamShieldConvert(team, [egida], [])).toEqual({ rate: 0.5 })
  })
  it('the scale relic multiplies the rate (keywordMult.scudo)', () => {
    expect(teamShieldConvert(team, [egida, cuore], [])).toEqual({ rate: 0.75 })
  })
  it('Bastione alone (no relic) still grants conversion', () => {
    expect(teamShieldConvert(team, [], [bastione])).toEqual({ rate: 0.35 })
  })
  it('Bastione adds to a relic grant', () => {
    expect(teamShieldConvert(team, [egida], [bastione])).toEqual({ rate: 0.85 })
  })
  it('rate is clamped to <= 1', () => {
    const big: ActiveRelic = { relic: { id: 'x', name: '', desc: '', rarity: 'rara', grantsShieldConvert: { rate: 0.9 } }, stageObtained: 0 }
    expect(teamShieldConvert(team, [egida, big, cuore], [bastione])).toEqual({ rate: 1 })
  })
})
