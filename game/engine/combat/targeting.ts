import type { BattleUnit } from '@/types'
import { BALANCE } from '@/data/constants'
import { effectiveStats } from '../status'

function lowestHp(units: BattleUnit[]): BattleUnit | undefined {
  return units.slice().sort((a, b) => a.hp - b.hp || a.wizard.id.localeCompare(b.wizard.id))[0]
}

export function mostWounded(units: BattleUnit[]): BattleUnit | undefined {
  const wounded = units.filter(u => u.alive && u.hp < u.maxHp)
  return wounded.sort((a, b) =>
    (a.hp / a.maxHp) - (b.hp / b.maxHp) || a.wizard.id.localeCompare(b.wizard.id),
  )[0]
}

export function threatScore(u: BattleUnit): number {
  const s = effectiveStats(u)
  return s.atk + s.spd + (u.wizard.role === 'Tank' ? BALANCE.roles.tauntBonus : 0)
}

function highestThreat(units: BattleUnit[]): BattleUnit | undefined {
  return units.slice().sort((a, b) =>
    threatScore(b) - threatScore(a) || a.wizard.id.localeCompare(b.wizard.id),
  )[0]
}

// Control's escape valve: ignore the taunt, prefer the enemy Supporto, then the
// most dangerous non-Tank. Falls back to Tanks only if nothing else is alive.
function backlineTarget(enemies: BattleUnit[]): BattleUnit | undefined {
  const nonTanks = enemies.filter(e => e.wizard.role !== 'Tank')
  const supports = nonTanks.filter(e => e.wizard.role === 'Supporto')
  const pool = supports.length ? supports : nonTanks
  if (pool.length) {
    return pool.slice().sort((a, b) =>
      threatScore(b) - threatScore(a) || a.wizard.id.localeCompare(b.wizard.id))[0]
  }
  return highestThreat(enemies) // only Tanks remain
}

export function selectTarget(
  actor: BattleUnit,
  allies: BattleUnit[],
  enemies: BattleUnit[],
): BattleUnit | undefined {
  const liveEnemies = enemies.filter(e => e.alive)
  const liveAllies = allies.filter(a => a.alive)

  switch (actor.wizard.role) {
    case 'Supporto':
      return mostWounded(liveAllies) ?? lowestHp(liveEnemies)
    case 'Controllo':
      return backlineTarget(liveEnemies)
    case 'Tank':
      return lowestHp(liveEnemies) // low damage by design; opportunistic finisher
    case 'Attaccante':
    default:
      return highestThreat(liveEnemies) // taunt makes a live Tank the focus
  }
}
