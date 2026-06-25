import type { DraftedWizard, Spell, Stats, Wizard } from '@/types'
import type { Rng } from './rng'
import { SPELL_BY_ID } from '@/data/spells'

function mid(range: readonly [number, number]): number {
  return Math.round((range[0] + range[1]) / 2)
}

/** Fixed, deterministic stat block: the rounded midpoint of each range. */
export function fixedStats(wizard: Wizard): Stats {
  return {
    hp: mid(wizard.ranges.hp),
    atk: mid(wizard.ranges.atk),
    def: mid(wizard.ranges.def),
    spd: mid(wizard.ranges.spd),
  }
}

export function pickSpell(rng: Rng, wizard: Wizard): Spell {
  const id = rng.pick(wizard.spellPool)
  const spell = SPELL_BY_ID[id]
  if (!spell) throw new Error(`unknown spell ${id} for ${wizard.id}`)
  return spell
}

export function draftWizard(rng: Rng, wizard: Wizard): DraftedWizard {
  const stats = fixedStats(wizard)
  const spell = pickSpell(rng, wizard)
  return { wizard, stats, maxHp: stats.hp, spell }
}
