import type { Spell, SpellType, SpellEffect, Stat } from '@/types/spell'
import type { EffectSpec } from '@/types/status'
import type { SynergyBonus } from '@/types/synergy'

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
  stun: { label: 'Stordimento', color: '#C98BFF', icon: 'Zap', blurb: 'Salta il turno del bersaglio.' },
  freeze: { label: 'Congela', color: '#7DD3FF', icon: 'Snowflake', blurb: 'Blocca le azioni del bersaglio.' },
  silence: { label: 'Silenzio', color: '#B59CFF', icon: 'VolumeX', blurb: 'Impedisce di lanciare magie.' },
  disarm: { label: 'Disarma', color: '#FFD37D', icon: 'Hand', blurb: 'Impedisce gli attacchi.' },
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

export function synergyBonusText(bonus: SynergyBonus): string[] {
  const out: string[] = []
  for (const stat of ['hp', 'atk', 'def', 'spd'] as Stat[]) {
    const v = bonus[stat]
    if (v) out.push(`+${v} ${STAT_LABEL[stat]}`)
  }
  if (bonus.allPct) out.push(`+${Math.round(bonus.allPct * 100)}% a tutte le statistiche`)
  if (bonus.regen) out.push(`Rigenera ${bonus.regen}/turno`)
  return out
}
