import type { BattleUnit } from '@/types'

function lowestHp(units: BattleUnit[]): BattleUnit | undefined {
  return units.slice().sort((a, b) => a.hp - b.hp || a.wizard.id.localeCompare(b.wizard.id))[0]
}

function mostWounded(units: BattleUnit[]): BattleUnit | undefined {
  const wounded = units.filter(u => u.hp < u.maxHp)
  return wounded.sort((a, b) =>
    (a.hp / a.maxHp) - (b.hp / b.maxHp) || a.wizard.id.localeCompare(b.wizard.id),
  )[0]
}

function highestThreat(units: BattleUnit[]): BattleUnit | undefined {
  return units.slice().sort((a, b) =>
    (b.buffedStats.atk + b.buffedStats.spd) - (a.buffedStats.atk + a.buffedStats.spd) ||
    a.wizard.id.localeCompare(b.wizard.id),
  )[0]
}

export function selectTarget(
  actor: BattleUnit,
  allies: BattleUnit[],
  enemies: BattleUnit[],
): BattleUnit | undefined {
  const liveEnemies = enemies.filter(e => e.alive)
  const liveAllies = allies.filter(a => a.alive)

  switch (actor.wizard.role) {
    case 'Supporto': {
      const wounded = mostWounded(liveAllies)
      return wounded ?? lowestHp(liveEnemies)
    }
    case 'Controllo':
      return highestThreat(liveEnemies)
    case 'Attaccante': {
      const tanks = liveEnemies.filter(e => e.wizard.role === 'Tank')
      return (tanks.length ? lowestHp(tanks) : lowestHp(liveEnemies))
    }
    case 'Tank':
    default: {
      const threats = liveEnemies.filter(e => e.wizard.role === 'Supporto')
      return lowestHp(threats.length ? threats : liveEnemies)
    }
  }
}
