import { describe, it, expect } from 'vitest'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { generateEnemyTeam, budgetForStage } from '@/game/engine/combat/teamGen'
import { detectSynergies } from '@/game/engine/synergy'
import { createRng } from '@/game/engine/rng'
import { RELIC_BY_ID } from '@/data/relics'
import type { ActiveRelic } from '@/types'

const ar = (id: string): ActiveRelic => ({ relic: RELIC_BY_ID[id]!, stageObtained: 0 })

describe('relic balance sanity', () => {
  // 400 deterministic battles (200 × with/without relics) — legitimately exceeds the 5s default
  // under a loaded full-suite run, so give it explicit headroom (passes ~7s isolated).
  it('a few common relics help but do not trivialize a fair fight', () => {
    // FIXED 2026-07-02 (inline-effect stack-cap task): the prior regression (winsNoRelic=103,
    // winsRelic=80 of 200 — relics measurably HURT) was caused by applyInlineEffect
    // (game/engine/status.ts) pushing a new permanent buff/debuff entry on EVERY application
    // with NO cap, unlike the statusId path which already respected StatusDef.maxStacks. Signature/
    // trait inline buffs (tsSelfBuff/tsWoundedSelfBuff/adBuff in data/traits.ts and
    // data/signatures.ts) and Controllo inline debuff spells (crucio/levicorpus/confundo/langlock/
    // tarantallegra in data/spells.ts) stacked without limit over a full battle, drowning out the
    // relic advantage. Capping inline (kind, stat) instances at MAX_STAT_STACKS (3, matching the
    // statusId cap) restores the intended relationship: winsNoRelic=96, winsRelic=101 (of 200).
    let winsNoRelic = 0, winsRelic = 0
    const N = 200
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
  }, 30000)
})
