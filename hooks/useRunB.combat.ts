import type { ActiveRelic, ActiveSynergy, BattleResult, DraftedWizard, RunState } from '@/types'
import type { Rng } from '@/game/engine/rng'
import { resolveCombat } from '@/game/engine/resolvers/combat'
import { battleReadyTeam } from '@/game/engine/battlePrep'
import { detectSynergies } from '@/game/engine/synergy'
import { combatRngForNode } from '@/game/engine/runEngine'

export interface ActiveBattleB {
  result: BattleResult
  enemy: DraftedWizard[]
  enemySyn: ActiveSynergy[]
  isBoss: boolean
  isFinalBoss: boolean
  /** The picked boss's display name (boss nodes only) — read from the node's pre-generated
   *  preview so the title always matches the seeded pool pick (Task 6), never a hardcoded
   *  singleton. */
  bossName?: string
  playerTeam: DraftedWizard[]
  playerSyn: ActiveSynergy[]
  /** Level shown on enemy busts (menace was removed 2026-07-01; this is the explicit area+kind threat tier). */
  enemyLevel: number
  /** Right-side menace/relics/damageReduction/ignoresTaunt fed to simulateBattle — threaded
   *  into buildReplay so the InitiativeBar's displayed spd matches the sim's actual order. */
  rightMenace: number
  rightRelics: ActiveRelic[]
  rightDamageReduction: number
  rightIgnoresTaunt: boolean
}

/** Deterministic rng for the current combat node; shared by snapshot + commit.
 *  Thin wrapper over runEngine's combatRngForNode (the single source of truth for this
 *  fork chain — also used by endlessReplay.ts so replay reconstructs the exact stream
 *  live play used). */
export function combatRng(run: RunState): Rng {
  return combatRngForNode(run.seed, run.currentNodeId!)
}

/** Build the replay snapshot: the leveled roster that fought + the pure result. */
export function prepareCombat(run: RunState): ActiveBattleB {
  const node = run.map!.find(n => n.id === run.currentNodeId)!
  const out = resolveCombat(run, node, combatRng(run))
  const ready = battleReadyTeam(run.team)
  return {
    result: out.result, enemy: out.enemy, enemySyn: out.enemySyn, isBoss: out.isBoss,
    isFinalBoss: out.isFinalBoss, bossName: node.preview?.bossName,
    playerTeam: ready, playerSyn: detectSynergies(ready),
    enemyLevel: out.enemyLevel,
    rightMenace: out.rightMenace, rightRelics: out.rightRelics,
    rightDamageReduction: out.rightDamageReduction, rightIgnoresTaunt: out.rightIgnoresTaunt,
  }
}
