import type { DraftedWizard, Spell, Stats, Wizard } from '@/types'
import type { Rng } from './rng'
import { BALANCE } from '@/data/constants'
import { SPELL_BY_ID } from '@/data/spells'

function rollStat(rng: Rng, range: readonly [number, number], bias: number): number {
  const [lo, hi] = range
  if (hi <= lo) return lo
  // bias in [0,1]: blend a uniform roll toward the high end.
  const u = rng.next()
  const blended = u * (1 - bias) + Math.max(u, rng.next()) * bias
  return Math.round(lo + blended * (hi - lo))
}

export function rollStats(rng: Rng, wizard: Wizard): Stats {
  const bias = BALANCE.draft.tierRollBias[wizard.tier]
  return {
    hp: rollStat(rng, wizard.ranges.hp, bias),
    atk: rollStat(rng, wizard.ranges.atk, bias),
    def: rollStat(rng, wizard.ranges.def, bias),
    spd: rollStat(rng, wizard.ranges.spd, bias),
  }
}

export function pickSpell(rng: Rng, wizard: Wizard): Spell {
  const id = rng.pick(wizard.spellPool)
  const spell = SPELL_BY_ID[id]
  if (!spell) throw new Error(`unknown spell ${id} for ${wizard.id}`)
  return spell
}

export function draftWizard(rng: Rng, wizard: Wizard): DraftedWizard {
  const stats = rollStats(rng, wizard)
  const spell = pickSpell(rng, wizard)
  return { wizard, stats, maxHp: stats.hp, spell }
}
