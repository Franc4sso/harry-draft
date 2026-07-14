import type { Spell, SpellType, SpellEffect, Stat } from '@/types/spell'
import type { EffectSpec } from '@/types/status'
import type { SynergyBonus, Synergy } from '@/types/synergy'
import { STATUS_BY_ID } from '@/data/statuses'

export type IconName =
  | 'Swords' | 'Shield' | 'HeartPulse' | 'Wand2' | 'Flame' | 'Zap'
  | 'Snowflake' | 'VolumeX' | 'Hand' | 'Sparkles' | 'ArrowUp' | 'ArrowDown' | 'CircleSlash'

export interface ChipData { label: string; color: string; icon?: IconName }

export const SPELL_TYPE_META: Record<SpellType, { color: string; icon: IconName; blurb: string }> = {
  Attacco: { color: '#FF8A7A', icon: 'Swords', blurb: 'Infligge danno diretto al nemico.' },
  Difesa: { color: '#7DB7FF', icon: 'Shield', blurb: 'Protegge o rinforza chi la lancia.' },
  Cura: { color: '#7CFC9B', icon: 'HeartPulse', blurb: 'Ripristina punti vita.' },
  Controllo: { color: '#C98BFF', icon: 'Wand2', blurb: 'Limita o indebolisce il nemico.' },
}

export const EFFECT_META: Record<string, { label: string; color: string; icon: IconName; blurb: string }> = {
  buff: { label: 'Potenzia', color: '#7CFC9B', icon: 'ArrowUp', blurb: 'Aumenta una statistica per alcuni turni.' },
  debuff: { label: 'Indebolisce', color: '#FFB37D', icon: 'ArrowDown', blurb: 'Riduce una statistica per alcuni turni.' },
  dot: { label: 'Danno nel tempo', color: '#FF7A7A', icon: 'Flame', blurb: 'Infligge danno a ogni turno.' },
  stun: { label: 'Stordimento', color: '#C98BFF', icon: 'Zap', blurb: 'Salta il turno. Breve ma impossibile da rimuovere.' },
  freeze: { label: 'Congela', color: '#7DD3FF', icon: 'Snowflake', blurb: 'Blocca le azioni più a lungo, ma si infrange (con danno extra) al primo colpo.' },
  silence: { label: 'Silenzio', color: '#B59CFF', icon: 'VolumeX', blurb: 'Anti-magia: niente incantesimi, il bersaglio ripiega su un attacco base debole.' },
  disarm: { label: 'Disarma', color: '#FFD37D', icon: 'Hand', blurb: 'Anti-attacco: azzera i danni del bersaglio, che può ancora curare e difendere.' },
  regen: { label: 'Rigenera', color: '#7CFC9B', icon: 'Sparkles', blurb: 'Recupera vita a ogni turno.' },
  shield: { label: 'Scudo', color: '#7DB7FF', icon: 'Shield', blurb: 'Assorbe danno in arrivo.' },
}

export function spellTypeChip(type: SpellType): ChipData {
  const m = SPELL_TYPE_META[type]
  return { label: type, color: m.color, icon: m.icon }
}

export function formatSpellStats(spell: Spell): Array<{ label: string; value: string }> {
  const out: Array<{ label: string; value: string }> = []
  if (spell.power !== undefined) out.push({ label: 'Potenza', value: `×${spell.power}` })
  if (spell.heal !== undefined) out.push({ label: 'Cura', value: `${spell.heal}` })
  out.push({ label: 'Precisione', value: `${Math.round(spell.hitChance * 100)}%` })
  if (spell.cooldown !== undefined) out.push({ label: 'Ricarica', value: `${spell.cooldown}` })
  return out
}

function effectKinds(spell: Spell): string[] {
  const kinds: string[] = []
  for (const e of spell.effects ?? []) kinds.push(e.kind)
  for (const s of spell.spec ?? []) {
    if (s.kind === 'applyStatus') { if (s.effect?.kind) kinds.push(s.effect.kind) }
    else if (s.kind === 'shield') kinds.push('shield')
  }
  return kinds
}

export function spellEffectChips(spell: Spell): ChipData[] {
  const seen = new Set<string>()
  const out: ChipData[] = []
  for (const kind of effectKinds(spell)) {
    if (seen.has(kind)) continue
    seen.add(kind)
    const m = EFFECT_META[kind]
    out.push(m ? { label: m.label, color: m.color, icon: m.icon } : { label: kind, color: '#9aa3ad' })
  }
  return out
}

export interface EffectLine { label: string; blurb: string; color: string }

/**
 * Effects of a spell as readable "name: what it does" lines (no pills). Each
 * effect kind appears once. Used by the card to explain effects in plain text.
 */
export function spellEffectLines(spell: Spell): EffectLine[] {
  const seen = new Set<string>()
  const out: EffectLine[] = []
  for (const kind of effectKinds(spell)) {
    if (seen.has(kind)) continue
    seen.add(kind)
    const m = EFFECT_META[kind]
    out.push(m ? { label: m.label, blurb: m.blurb, color: m.color } : { label: kind, blurb: '', color: '#9aa3ad' })
  }
  return out
}

const STAT_LABEL: Record<Stat, string> = { hp: 'HP', atk: 'ATK', def: 'DIF', spd: 'VEL' }

/** Verb used for a stat debuff, by stat. Falls back to the generic EFFECT_META label. */
const DEBUFF_VERB: Partial<Record<Stat, string>> = { spd: 'Rallenta', atk: 'Indebolisce', def: 'Espone' }

/** Verb form for control/dot effect kinds (EFFECT_META labels are nouns like "Stordimento"). */
const CONTROL_VERB: Record<string, string> = {
  stun: 'Stordisce', freeze: 'Congela', silence: 'Silenzia', disarm: 'Disarma', dot: 'Avvelena',
}

function statDetail(kind: 'buff' | 'debuff', stat: Stat | undefined, amount: number | undefined, pct?: boolean): string {
  const label = STAT_LABEL[stat as Stat] ?? stat ?? ''
  const amt = amount !== undefined ? `${amount}${pct ? '%' : ''}` : ''
  if (kind === 'buff') {
    return `${label} +${amt}`.trim()
  }
  const verb = (stat && DEBUFF_VERB[stat]) ?? EFFECT_META.debuff!.label
  return amt ? `${verb} (${label} -${amt})` : verb
}

const PERMANENT_SUFFIX = '(permanente, cumulativo)'

function timedSuffix(duration: number | undefined): string {
  return duration !== undefined ? `per ${duration} turni` : ''
}

/**
 * Verbal, Italian description of what each of a spell's effects DOES, including
 * magnitude and duration — unlike `spellEffectChips`/`spellEffectLines`, which
 * collapse everything to a single bare label and silently drop `spec[].statusId`
 * effects entirely (e.g. silencio/glacius used to render nothing).
 *
 * Stat buffs/debuffs (`kind:'buff'|'debuff'`) are now permanent + cumulative
 * (see data/statuses.ts), so they get "(permanente, cumulativo)" instead of a
 * turn count. Control effects (stun/freeze/silence/disarm) and dots stay timed.
 */
export function spellEffectDetails(spell: Spell): string[] {
  const out: string[] = []

  for (const e of spell.effects ?? []) {
    out.push(inlineEffectDetail(e))
  }

  for (const s of spell.spec ?? []) {
    if (s.kind !== 'applyStatus') continue
    if (s.statusId) {
      const def = STATUS_BY_ID[s.statusId]
      if (!def) continue
      const duration = s.duration ?? def.defaultDuration
      if (def.kind === 'buff' || def.kind === 'debuff') {
        const mod = def.statMod
        out.push(`${statDetail(def.kind, mod?.stat, mod?.amount, mod?.pct)} ${PERMANENT_SUFFIX}`.trim())
      } else {
        const label = CONTROL_VERB[def.kind] ?? EFFECT_META[def.kind]?.label ?? def.name
        out.push(`${label} ${timedSuffix(duration)}`.trim())
      }
    } else if (s.effect) {
      out.push(inlineEffectDetail({ kind: s.effect.kind as SpellEffect['kind'], stat: s.effect.stat, amount: s.effect.amount, duration: s.effect.duration ?? s.duration }))
    }
  }

  return out
}

function inlineEffectDetail(e: SpellEffect): string {
  if (e.kind === 'buff' || e.kind === 'debuff') {
    return `${statDetail(e.kind, e.stat, e.amount)} ${PERMANENT_SUFFIX}`.trim()
  }
  if (e.kind === 'dot') {
    return `${CONTROL_VERB.dot} ${timedSuffix(e.duration)}`.trim()
  }
  // stun/freeze/silence/disarm (and any other control kind) stay timed.
  const label = CONTROL_VERB[e.kind] ?? EFFECT_META[e.kind]?.label ?? e.kind
  return `${label} ${timedSuffix(e.duration)}`.trim()
}

export function synergyBonusText(synergy: Synergy): string[] {
  const out: string[] = []
  const bonus: SynergyBonus = synergy.bonus ?? {}
  for (const stat of ['hp', 'atk', 'def', 'spd'] as Stat[]) {
    const v = bonus[stat]
    if (v) out.push(`+${v} ${STAT_LABEL[stat]}`)
  }
  if (bonus.allPct) out.push(`+${Math.round(bonus.allPct * 100)}% a tutte le statistiche`)
  if (bonus.regen) out.push(`Rigenera ${bonus.regen}/turno`)
  return out
}
