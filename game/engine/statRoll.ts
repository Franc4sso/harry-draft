import type { DraftedWizard, Role, Spell, SpellType, Stats, Wizard } from '@/types'
import type { Rng } from './rng'
import { SPELL_BY_ID } from '@/data/spells'
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

export function pickSpell(rng: Rng, wizard: Wizard): Spell {
  // UN MAGO, UNA MAGIA: il pool contiene esattamente una firma. Si pesca comunque via
  // rng.pick per BRUCIARE esattamente una gen() — identico al vecchio pool multi-spell —
  // così il draw-count del draft resta byte-per-byte uguale e la parità replay endless
  // non si tocca. L'esito è deterministico: la firma del mago.
  const id = rng.pick(wizard.spellPool)
  const spell = SPELL_BY_ID[id]
  if (!spell) throw new Error(`unknown spell ${id} for ${wizard.id}`)
  return spell
}

export function draftWizard(rng: Rng, wizard: Wizard, allowShiny = false): DraftedWizard {
  const stats = fixedStats(wizard)
  const spell = pickSpell(rng, wizard)
  // Bruciamo sempre il roll shiny (mantiene lo stream identico per ogni caller), ma lo
  // ATTACCHIAMO solo se il caller lo richiede (draft del giocatore). Nemici → mai shiny.
  const rolled = rng.chance(BALANCE.draft.shinyChance) ? { traitId: rng.pick(SHINY_TRAIT_IDS) } : undefined
  const shiny = allowShiny ? rolled : undefined
  return { wizard, stats, maxHp: stats.hp, spell, ...(shiny ? { shiny } : {}) }
}
