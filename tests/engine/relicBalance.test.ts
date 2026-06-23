import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { generateEnemyTeam, budgetForStage } from '@/game/engine/combat/teamGen'
import { detectSynergies } from '@/game/engine/synergy'
import { createRng } from '@/game/engine/rng'
import { RELIC_BY_ID } from '@/data/relics'
import type { ActiveRelic } from '@/types'

const ar = (id: string): ActiveRelic => ({ relic: RELIC_BY_ID[id]!, stageObtained: 0 })

describe('relic balance sanity', () => {
  it('a few common relics help but do not trivialize a fair fight', () => {
    let winsNoRelic = 0, winsRelic = 0
    const N = 60
    const relics = [ar('mappa-malandrino'), ar('giratempo'), ar('mantello-invisibilita')]
    for (let i = 0; i < N; i++) {
      const player = generateEnemyTeam(createRng(`p${i}`), budgetForStage(2))
      const enemy = generateEnemyTeam(createRng(`e${i}`), budgetForStage(2))
      const syn = { leftSyn: detectSynergies(player), rightSyn: detectSynergies(enemy) }
      if (simulateBattle(player, enemy, createRng(`b${i}`), syn).winner === 'left') winsNoRelic++
      if (simulateBattle(player, enemy, createRng(`b${i}`), { ...syn, leftRelics: relics }).winner === 'left') winsRelic++
    }
    // relics should raise the player's win-rate (a real advantage) but not to a guaranteed 100%
    expect(winsRelic).toBeGreaterThanOrEqual(winsNoRelic)
    expect(winsRelic).toBeLessThan(N)
  })
})
