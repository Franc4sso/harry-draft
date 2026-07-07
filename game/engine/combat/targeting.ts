import type { BattleUnit, Spell } from '@/types'
import { BALANCE } from '@/data/constants'
import { effectiveStats } from '../status'
import { normalizeSpell } from './normalizeSpell'
import { STATUS_BY_ID } from '@/data/statuses'
import { isUnderHardControl } from './roleCounter'

const CONTROL_KINDS = new Set(['stun', 'freeze', 'silence', 'disarm'])

/** The set of control kinds a spell applies to its enemy target (empty for non-control spells). */
export function appliesControl(spell: Spell): Set<string> {
  const out = new Set<string>()
  for (const eff of normalizeSpell(spell)) {
    if (eff.kind !== 'applyStatus' || eff.target !== 'enemy') continue
    const kind = eff.statusId ? STATUS_BY_ID[eff.statusId]?.kind : eff.effect?.kind
    if (kind && CONTROL_KINDS.has(kind)) out.add(kind)
  }
  return out
}

/** True if `unit` already has an active status of any kind in `kinds`. */
function underAnyControl(unit: BattleUnit, kinds: Set<string>): boolean {
  return unit.statusEffects.some(e => {
    const k = e.statusId ? STATUS_BY_ID[e.statusId]?.kind : e.kind
    return !!k && kinds.has(k)
  })
}

function lowestHp(units: BattleUnit[]): BattleUnit | undefined {
  return units.slice().sort((a, b) => a.hp - b.hp || a.wizard.id.localeCompare(b.wizard.id))[0]
}

export function mostWounded(units: BattleUnit[]): BattleUnit | undefined {
  const wounded = units.filter(u => u.alive && u.hp < u.maxHp)
  return wounded.sort((a, b) =>
    (a.hp / a.maxHp) - (b.hp / b.maxHp) || a.wizard.id.localeCompare(b.wizard.id),
  )[0]
}

// Supporto identity: protect the CARRY, not just the most-wounded body. Among allies
// who are actually damaged (in danger), rank by effective ATK — the team's highest
// damage dealer is the highest-value target to keep alive — tiebreak by lowest HP
// fraction (more threatened first), then id for determinism. Returns undefined if no
// damaged ally exists (caller falls back to mostWounded, then the enemy pool).
export function carryToProtect(units: BattleUnit[]): BattleUnit | undefined {
  const damaged = units.filter(u => u.alive && u.hp < u.maxHp)
  if (!damaged.length) return undefined
  return damaged.sort((a, b) =>
    effectiveStats(b).atk - effectiveStats(a).atk ||
    (a.hp / a.maxHp) - (b.hp / b.maxHp) ||
    a.wizard.id.localeCompare(b.wizard.id),
  )[0]
}

// The fallen ally a revive spell should raise: the highest-value body (effective ATK) —
// bring the strongest dealer back into the fight — tiebroken by id for determinism.
// Undefined if no ally has fallen (the caller then fizzles the revive into a basic attack).
export function deadToRaise(units: BattleUnit[]): BattleUnit | undefined {
  const fallen = units.filter(u => !u.alive)
  return fallen.sort((a, b) =>
    effectiveStats(b).atk - effectiveStats(a).atk || a.wizard.id.localeCompare(b.wizard.id),
  )[0]
}

export function threatScore(u: BattleUnit, ignoresTaunt = false): number {
  const s = effectiveStats(u)
  // Provocazione is suppressed while the Tank is under hard-control (Global Rule):
  // a stunned/frozen/silenced wall can't provoke, so it stops drawing fire.
  const provoking = u.wizard.role === 'Tank' && !ignoresTaunt && !isUnderHardControl(u)
  return s.atk + s.spd + (provoking ? BALANCE.roles.tauntBonus : 0)
}

function highestThreat(units: BattleUnit[], ignoresTaunt = false): BattleUnit | undefined {
  return units.slice().sort((a, b) =>
    threatScore(b, ignoresTaunt) - threatScore(a, ignoresTaunt) || a.wizard.id.localeCompare(b.wizard.id),
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

// Attaccante identity (Affondo): with no active enemy taunt, hunt the enemy backline —
// Supporto first (its prey), then Controllo, then whatever is most dangerous.
function diveTarget(enemies: BattleUnit[], ignoresTaunt: boolean): BattleUnit | undefined {
  const byThreat = (pool: BattleUnit[]) => pool.slice().sort((a, b) =>
    threatScore(b, ignoresTaunt) - threatScore(a, ignoresTaunt) || a.wizard.id.localeCompare(b.wizard.id))[0]
  const supports = enemies.filter(e => e.wizard.role === 'Supporto')
  if (supports.length) return byThreat(supports)
  const controllers = enemies.filter(e => e.wizard.role === 'Controllo')
  if (controllers.length) return byThreat(controllers)
  return highestThreat(enemies, ignoresTaunt)
}

// A live enemy Tank that is actively provoking (role Tank, alive, not hard-controlled).
// The actor's own ignoresTaunt (Bellatrix) frees it from every taunt.
function activeTauntTank(enemies: BattleUnit[], ignoresTaunt: boolean): boolean {
  if (ignoresTaunt) return false
  return enemies.some(e => e.wizard.role === 'Tank' && e.alive && !isUnderHardControl(e))
}

export function selectTarget(
  actor: BattleUnit,
  allies: BattleUnit[],
  enemies: BattleUnit[],
  spell?: Spell,
): BattleUnit | undefined {
  const liveEnemies = enemies.filter(e => e.alive)
  const liveAllies = allies.filter(a => a.alive)

  // Control spells prefer enemies not already under that control; if everyone is
  // controlled, fall back to the full live pool (still attack, no wasted priority).
  const control = spell ? appliesControl(spell) : new Set<string>()
  const enemyPool = control.size > 0
    ? (liveEnemies.filter(e => !underAnyControl(e, control)).length
        ? liveEnemies.filter(e => !underAnyControl(e, control))
        : liveEnemies)
    : liveEnemies

  const ign = actor.ignoresTaunt ?? false
  const taunt = activeTauntTank(enemyPool, ign)

  switch (actor.wizard.role) {
    case 'Supporto':
      // A Supporto equipped with an OFFENSIVE spell (Attacco/Controllo) must aim at an ENEMY.
      // Its role default is to protect an ally, which would otherwise turn the attack — or a
      // control effect — onto its own team (e.g. Narcissa casting Serpensortia on a teammate).
      if (spell && (spell.type === 'Attacco' || spell.type === 'Controllo')) {
        if (taunt) return highestThreat(enemyPool, ign)
        return spell.type === 'Controllo' ? backlineTarget(enemyPool) : highestThreat(enemyPool)
      }
      return carryToProtect(liveAllies) ?? mostWounded(liveAllies) ?? lowestHp(enemyPool)
    case 'Controllo':
      return backlineTarget(enemyPool)
    case 'Tank':
      return taunt ? highestThreat(enemyPool, ign) : lowestHp(enemyPool)
    case 'Attaccante':
    default: {
      const ign = actor.ignoresTaunt ?? false
      // If an enemy Tank is actively taunting, it wins (Tank beats Attaccante). Otherwise dive.
      const tauntActive = !ign && enemyPool.some(e => e.wizard.role === 'Tank' && !isUnderHardControl(e))
      return tauntActive ? highestThreat(enemyPool, ign) : diveTarget(enemyPool, ign)
    }
  }
}
