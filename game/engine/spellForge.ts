import type { DraftedWizard, EffectSpec, Spell } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'

/** +15% spell power/heal per magic level above 1. */
export const SPELL_LEVEL_STEP = 0.15
/** Hard cap on a wizard's magic level (level 1 = base output, so +75% at the ceiling). */
export const SPELL_LEVEL_MAX = 6

/** Power is a small multiplier (≈1–3.2), so keep 2 decimals; heal is a flat integer. */
const round2 = (n: number): number => Math.round(n * 100) / 100

/** Damage/heal multiplier for a magic level (1-based, clamped to [1, MAX]). */
export function spellMultiplier(spellLevel: number | undefined): number {
  const lvl = Math.max(1, Math.min(SPELL_LEVEL_MAX, spellLevel ?? 1))
  return 1 + SPELL_LEVEL_STEP * (lvl - 1)
}

function scaleSpec(spec: EffectSpec[], m: number): EffectSpec[] {
  return spec.map(s => {
    if (s.kind === 'damage') return { ...s, power: round2(s.power * m) }
    if (s.kind === 'heal') return { ...s, amount: Math.round(s.amount * m) }
    // DoT / debuff magnitude carried by a data-driven status effect (e.g. Serpensortia).
    if (s.kind === 'applyStatus' && s.effect?.amount !== undefined) {
      return { ...s, effect: { ...s.effect, amount: Math.round(s.effect.amount * m) } }
    }
    return s
  })
}

/** Scale the magnitude of inline effects (DoT damage, buff/debuff amounts) — the spell's
 *  real "statistiche" for control/defense kits. Durations are left as-is (scaling turn counts
 *  is a different, balance-sensitive lever). */
function scaleEffects(effects: Spell['effects'], m: number): Spell['effects'] {
  if (!effects) return effects
  return effects.map(e => (e.amount !== undefined ? { ...e, amount: Math.round(e.amount * m) } : e))
}

/** A copy of `base` with its numeric output scaled to `spellLevel`: attack Potenza, Cura,
 *  and inline/spec effect magnitudes (DoT damage, buff/debuff amounts). PURE — never mutates
 *  the shared SPELLS entry. Durations, hit chance, and revive fraction are deliberately left
 *  untouched. Because the id is preserved, re-scaling from the catalog base never compounds. */
export function scaledSpell(base: Spell, spellLevel: number | undefined): Spell {
  const m = spellMultiplier(spellLevel)
  if (m === 1) return base
  return {
    ...base,
    ...(base.power !== undefined ? { power: round2(base.power * m) } : {}),
    ...(base.heal !== undefined ? { heal: Math.round(base.heal * m) } : {}),
    ...(base.effects ? { effects: scaleEffects(base.effects, m) } : {}),
    ...(base.spec ? { spec: scaleSpec(base.spec, m) } : {}),
  }
}

/** The unscaled catalog spell for an equipped (possibly already-scaled) spell. */
export function baseSpellOf(spell: Spell): Spell {
  return SPELL_BY_ID[spell.id] ?? spell
}

/** Raise a wizard's magic level by one (capped) and re-derive their equipped spell's
 *  scaled stats from the catalog base. No-op at the cap. Pure. */
export function upgradeWizardSpell(dw: DraftedWizard): DraftedWizard {
  const current = dw.spellLevel ?? 1
  const nextLevel = Math.min(SPELL_LEVEL_MAX, current + 1)
  if (nextLevel === current) return dw
  return { ...dw, spellLevel: nextLevel, spell: scaledSpell(baseSpellOf(dw.spell), nextLevel) }
}
