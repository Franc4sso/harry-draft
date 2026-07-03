import type { DraftedWizard, Spell, Stats, Wizard } from '@/types'
import type { Rng } from './rng'
import { SPELL_BY_ID, SPELL_IS_VENOM } from '@/data/spells'
import { BALANCE } from '@/data/constants'
import { SHINY_TRAIT_IDS } from '@/data/traits'
import { normalizeSpell } from './combat/normalizeSpell'

/** A spell "deals damage" iff its normalized effects include a damage effect
 *  (Attacco, or a Controllo/spec spell with power). Buffs/heals/pure-control → false. */
export function spellIsOffensive(spell: Spell | undefined): boolean {
  return !!spell && normalizeSpell(spell).some(e => e.kind === 'damage')
}

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

export function pickSpell(rng: Rng, wizard: Wizard, preferOffense = false): Spell {
  // Venom-tagged mages always enter battle with a venom spell equipped. Restrict the
  // candidate set BEFORE the single rng.pick — one draw, restricted outcome (keeps the
  // rng-draw count identical for every caller). Defensive fallback to the full pool if a
  // venom mage's pool somehow has no venom spell (a data test guards against this).
  //
  // `preferOffense` (enemy drafts only): a passive support/controller whose single
  // equipped spell never deals damage stands idle in battle — enemies that never attack
  // feel toothless. When set, restrict the candidate pool to the wizard's damaging spells
  // BEFORE the single pick (same one-draw pattern as venom, so rng flow is unchanged and
  // team COMPOSITION stays identical — only the equipped spell shifts). Falls back to the
  // full pool if the wizard has no offensive spell at all (a pure-support kit).
  let candidates = wizard.spellPool
  const venom = (wizard.tags ?? []).includes('veleno')
    ? wizard.spellPool.filter(id => SPELL_IS_VENOM.has(id))
    : null
  if (venom && venom.length > 0) {
    candidates = venom
  } else if (preferOffense) {
    const offensive = wizard.spellPool.filter(id => spellIsOffensive(SPELL_BY_ID[id]))
    if (offensive.length > 0) candidates = offensive
  }
  const id = rng.pick(candidates)
  const spell = SPELL_BY_ID[id]
  if (!spell) throw new Error(`unknown spell ${id} for ${wizard.id}`)
  return spell
}

export function draftWizard(rng: Rng, wizard: Wizard, allowShiny = false, preferOffense = false): DraftedWizard {
  const stats = fixedStats(wizard)
  const spell = pickSpell(rng, wizard, preferOffense)
  // Always DRAW the roll (keeps the rng stream identical for every caller), but only
  // ATTACH shiny when the caller opts in. Enemies/boss teams never opt in → never shiny,
  // yet their draft stream (and thus composition) is unchanged. Shiny is PLAYER-DRAFT ONLY.
  const rolled = rng.chance(BALANCE.draft.shinyChance) ? { traitId: rng.pick(SHINY_TRAIT_IDS) } : undefined
  const shiny = allowShiny ? rolled : undefined
  return { wizard, stats, maxHp: stats.hp, spell, ...(shiny ? { shiny } : {}) }
}
