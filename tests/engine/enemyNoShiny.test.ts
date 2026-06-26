import { describe, it, expect } from 'vitest'
import { createRng } from '@/game/engine/rng'
import { generateEnemyTeam, generateBossTeam, budgetForStage } from '@/game/engine/combat/teamGen'
import { BOSSES } from '@/data/bosses'

/**
 * Invariant (design spec §9, "Fuori scope: Shiny per i nemici"): shiny is
 * PLAYER-DRAFT ONLY. Enemy and boss teams must NEVER carry a shiny trait, even
 * though they reuse draftWizard (which still draws — but does not attach — the
 * shiny roll to keep the rng stream byte-identical).
 */
describe('enemy/boss teams never roll shiny', () => {
  it('no generated enemy unit carries shiny across many seeds', () => {
    for (let i = 0; i < 200; i++) {
      const rng = createRng(`enemy-shiny-${i}`).fork(i + 1)
      const team = generateEnemyTeam(rng, budgetForStage(i % 12))
      for (const dw of team) {
        expect(dw.shiny).toBeUndefined()
      }
    }
  })

  it('no generated boss unit carries shiny across many seeds', () => {
    for (let i = 0; i < 200; i++) {
      const rng = createRng(`boss-shiny-${i}`).fork(i + 1)
      const team = generateBossTeam(rng, BOSSES[0]!)
      for (const dw of team) {
        expect(dw.shiny).toBeUndefined()
      }
    }
  })
})
