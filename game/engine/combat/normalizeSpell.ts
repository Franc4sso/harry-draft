import type { EffectSpec, Spell } from '@/types'

export function normalizeSpell(spell: Spell): EffectSpec[] {
  if (spell.spec) return spell.spec

  if (spell.revive != null) {
    return [{ kind: 'revive', fraction: spell.revive }]
  }

  if (spell.type === 'Cura') {
    return [{ kind: 'heal', amount: spell.heal ?? 0 }]
  }

  if (spell.type === 'Difesa') {
    return (spell.effects ?? []).map(e => ({
      kind: 'applyStatus' as const, target: 'self' as const,
      effect: { kind: e.kind, stat: e.stat, amount: e.amount, duration: e.duration },
    }))
  }

  // Attacco | Controllo
  const out: EffectSpec[] = []
  const power = spell.power ?? 0
  if (power > 0) out.push({ kind: 'damage', power, canCrit: true, canDodge: true })
  for (const e of spell.effects ?? []) {
    out.push({
      kind: 'applyStatus', target: 'enemy',
      effect: { kind: e.kind, stat: e.stat, amount: e.amount, duration: e.duration },
    })
  }
  return out
}
