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
    // Fire DoTs funnel into statusId 'burn' (accumulating, one flame icon) carrying their own
    // per-tick damage via tickAmount — instead of each cast pushing a separate un-mergeable
    // inline dot. Non-dot inline effects (crucio's atk debuff) stay inline.
    if (e.kind === 'dot') {
      out.push({ kind: 'applyStatus', target: 'enemy', statusId: 'burn', tickAmount: e.amount, duration: e.duration })
    } else {
      out.push({
        kind: 'applyStatus', target: 'enemy',
        effect: { kind: e.kind, stat: e.stat, amount: e.amount, duration: e.duration },
      })
    }
  }
  return out
}
