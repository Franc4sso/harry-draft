import type { DraftedWizard, EffectSpec, Spell } from '@/types'
import { SPELL_BY_ID } from '@/data/spells'
import { STATUS_BY_ID } from '@/data/statuses'

/** +15% spell power/heal per magic level above 1. */
export const SPELL_LEVEL_STEP = 0.15
/** Hard cap on a wizard's magic level (level 1 = base output, so +75% at the ceiling). */
export const SPELL_LEVEL_MAX = 6

/** Control statuses whose only "power" dimension is duration (no numeric magnitude) — these
 *  are levelled by a coarse turn-count breakpoint, not the continuous magnitude multiplier. */
const CONTROL_KINDS: ReadonlySet<string> = new Set(['stun', 'freeze', 'silence', 'disarm'])

/** Power is a small multiplier (≈1–3.2), so keep 2 decimals; heal is a flat integer. */
const round2 = (n: number): number => Math.round(n * 100) / 100

/** Damage/heal/magnitude multiplier for a magic level (1-based, clamped to [1, MAX]). */
export function spellMultiplier(spellLevel: number | undefined): number {
  const lvl = Math.max(1, Math.min(SPELL_LEVEL_MAX, spellLevel ?? 1))
  return 1 + SPELL_LEVEL_STEP * (lvl - 1)
}

/** Coarse breakpoint bonus for the integer levers a continuous multiplier can't move:
 *  control durations (stun/freeze/silence) and ward charges. +1 turn/charge at Lv4, +2 at
 *  Lv6. This is what makes pure-control and ward spells worth levelling at all. */
export function levelStep(spellLevel: number | undefined): number {
  const lvl = Math.max(1, Math.min(SPELL_LEVEL_MAX, spellLevel ?? 1))
  return lvl >= 6 ? 2 : lvl >= 4 ? 1 : 0
}

function scaleSpec(spec: EffectSpec[], m: number, step: number): EffectSpec[] {
  return spec.map(s => {
    if (s.kind === 'damage') return { ...s, power: round2(s.power * m) }
    if (s.kind === 'heal') return { ...s, amount: Math.round(s.amount * m) }
    // Shield absorb is a scalable magnitude (Aegis, Fianto) — the shield handler reads eff.amount.
    if (s.kind === 'shield') return { ...s, amount: Math.round(s.amount * m) }
    // Ward (Protego / Protego Maxima): more charges (finite-count only) and a longer-lasting
    // ward at breakpoints. No continuous magnitude — leave untouched between breakpoints.
    if (s.kind === 'protego') {
      if (step === 0) return s
      const wardDur = STATUS_BY_ID['protego']!.defaultDuration
      return {
        ...s,
        ...(s.count != null && s.count > 0 ? { count: s.count + step } : {}),
        duration: (s.duration ?? wardDur) + step,
      }
    }
    if (s.kind === 'applyStatus') {
      let out: Extract<EffectSpec, { kind: 'applyStatus' }> = s
      // Legacy inline effect: scale its magnitude; a pure-control (stun) inline gains duration.
      if (out.effect?.amount !== undefined) {
        out = { ...out, effect: { ...out.effect, amount: Math.round(out.effect.amount * m) } }
      }
      if (out.effect?.kind === 'stun' && out.effect.duration !== undefined && step > 0) {
        out = { ...out, effect: { ...out.effect, duration: out.effect.duration + step } }
      }
      // statusId path: the magnitude (statMod / DoT tick / shield absorb) lives in the
      // StatusDef and is read live by the engine — flag magMult so applyStatus scales it.
      if (out.statusId) {
        const def = STATUS_BY_ID[out.statusId]
        if (def && (def.statMod || def.tickDamage != null || def.absorb != null)) {
          out = { ...out, magMult: m }
        }
        // Control statuses (freeze/silence/…) have no magnitude — level them by duration.
        if (def && CONTROL_KINDS.has(def.kind) && step > 0) {
          out = { ...out, duration: (out.duration ?? def.defaultDuration) + step }
        }
      }
      return out
    }
    return s
  })
}

/** Scale the magnitude of inline effects (DoT damage, buff/debuff amounts) and extend the
 *  duration of pure-control (stun) effects at breakpoints. PURE. */
function scaleEffects(effects: Spell['effects'], m: number, step: number): Spell['effects'] {
  if (!effects) return effects
  return effects.map(e => {
    let out = e
    if (out.amount !== undefined) out = { ...out, amount: Math.round(out.amount * m) }
    if (out.kind === 'stun' && out.duration !== undefined && step > 0) {
      out = { ...out, duration: out.duration + step }
    }
    return out
  })
}

/** A copy of `base` with its output scaled to `spellLevel`: attack Potenza, Cura, shield
 *  absorb, revive fraction, inline/spec magnitudes (DoT, buff/debuff), statusId magnitudes
 *  (via magMult) and control/ward durations (via breakpoints). PURE — never mutates the
 *  shared SPELLS entry. hitChance is left untouched. Because the id is preserved, re-scaling
 *  from the catalog base never compounds. Level 1 is a strict no-op (returns `base`). */
export function scaledSpell(base: Spell, spellLevel: number | undefined): Spell {
  const m = spellMultiplier(spellLevel)
  const step = levelStep(spellLevel)
  if (m === 1) return base
  return {
    ...base,
    ...(base.power !== undefined ? { power: round2(base.power * m) } : {}),
    ...(base.heal !== undefined ? { heal: Math.round(base.heal * m) } : {}),
    ...(base.revive !== undefined ? { revive: Math.min(1, round2(base.revive * m)) } : {}),
    ...(base.effects ? { effects: scaleEffects(base.effects, m, step) } : {}),
    ...(base.spec ? { spec: scaleSpec(base.spec, m, step) } : {}),
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
