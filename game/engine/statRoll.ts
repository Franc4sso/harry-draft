import type { DraftedWizard, Role, Spell, SpellType, Stats, Wizard } from '@/types'
import type { Rng } from './rng'
import { SPELL_BY_ID, SPELL_IS_VENOM } from '@/data/spells'
import { BALANCE } from '@/data/constants'
import { SHINY_TRAIT_IDS } from '@/data/traits'
import { normalizeSpell } from './combat/normalizeSpell'

/** Preferred spell type(s) per role — the soft bias applied when equipping (not a lock). */
export const ROLE_SPELL_TYPES: Record<Role, SpellType[]> = {
  Attaccante: ['Attacco'], Controllo: ['Controllo'], Supporto: ['Cura', 'Difesa'], Tank: ['Difesa'],
}

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

/** STRICT guarantee (enemy elite/boss only — see draftWizard's `guaranteeOffense`):
 *  given a wizard's already-chosen active `spell`, returns it unchanged if it's
 *  offensive. Otherwise replaces it with the strongest (highest `power`) offensive
 *  spell in the wizard's own pool. If the pool has none at all (a pure-support kit),
 *  the fallback depends on role:
 *    - SUPPORTO: NEVER receives an attack. A Supporto is a healer/warder by design, and
 *      (this slice) a Supporto is banned from being a boss-leader precisely because it
 *      must never wield a direct attack — so we fall back to `episkey` (a Cura), keeping
 *      the wizard true to its archetype. This also means a Supporto can never satisfy the
 *      "no harmless boss/elite" invariant, which is why no Supporto is fielded as a
 *      scripted boss-leader (see data/bosses.ts).
 *    - Any other role with an empty offensive pool: the universal `base_attack` fallback.
 *  Deterministic (no rng draw): unlike `preferOffense`'s soft bias, this NEVER falls
 *  through to a spell weaker than the role's floor, closing the "boss leader with a
 *  heal/shield active deals zero damage" degenerate case for non-Supporto enemies. */
export function guaranteeOffensiveSpell(wizard: Wizard, spell: Spell): Spell {
  if (spellIsOffensive(spell)) return spell
  const offensiveIds = wizard.spellPool.filter(id => spellIsOffensive(SPELL_BY_ID[id]))
  if (offensiveIds.length > 0) {
    const strongestId = offensiveIds.reduce((best, id) =>
      (SPELL_BY_ID[id]!.power ?? 0) > (SPELL_BY_ID[best]!.power ?? 0) ? id : best)
    return SPELL_BY_ID[strongestId]!
  }
  // A Supporto with no offensive spell in its pool stays a support: fall back to a Cura
  // (episkey), never base_attack. (Non-Supporto roles keep the base_attack fallback.)
  if (wizard.role === 'Supporto') {
    const cura = SPELL_BY_ID['episkey']
    if (!cura) throw new Error('episkey spell missing from registry')
    return cura
  }
  const fallback = SPELL_BY_ID['base_attack']
  if (!fallback) throw new Error('base_attack spell missing from registry')
  return fallback
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
  // Role bias (default for player AND enemy): prefer a spell of the role's type so a role
  // actually plays its part (esp. a Controllo needs a control spell for the Global Rule).
  // Soft: falls back to the whole pool if the pool has none. Venom / preferOffense below
  // still OVERRIDE this base (enemy offensive guarantee wins).
  const roleTypes = ROLE_SPELL_TYPES[wizard.role]
  if (roleTypes) {
    const roleMatch = wizard.spellPool.filter(id => roleTypes.includes(SPELL_BY_ID[id]?.type as SpellType))
    if (roleMatch.length > 0) candidates = roleMatch
  }
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

export function draftWizard(
  rng: Rng, wizard: Wizard, allowShiny = false, preferOffense = false, guaranteeOffense = false,
): DraftedWizard {
  const stats = fixedStats(wizard)
  let spell = pickSpell(rng, wizard, preferOffense)
  // `guaranteeOffense` (enemy elite/boss drafts ONLY, wired from teamGen.ts): unlike
  // `preferOffense`'s bias, this can never leave a non-offensive spell equipped. Player
  // drafts and normal-enemy drafts never opt in, so their spell choice is unaffected.
  if (guaranteeOffense) spell = guaranteeOffensiveSpell(wizard, spell)
  // Always DRAW the roll (keeps the rng stream identical for every caller), but only
  // ATTACH shiny when the caller opts in. Enemies/boss teams never opt in → never shiny,
  // yet their draft stream (and thus composition) is unchanged. Shiny is PLAYER-DRAFT ONLY.
  const rolled = rng.chance(BALANCE.draft.shinyChance) ? { traitId: rng.pick(SHINY_TRAIT_IDS) } : undefined
  const shiny = allowShiny ? rolled : undefined
  return { wizard, stats, maxHp: stats.hp, spell, ...(shiny ? { shiny } : {}) }
}
