import type { StatusDef } from '@/types'
import { MAX_STAT_STACKS } from './constants'

export const STATUS_DEFS: StatusDef[] = [
  { id: 'stun', name: 'Stordito', kind: 'stun', family: 'control', prevents: ['action'], defaultDuration: 1, stack: 'refresh', priority: 100, removable: false },
  { id: 'freeze', name: 'Congelamento', kind: 'freeze', family: 'control', prevents: ['action'], defaultDuration: 2, stack: 'refresh', priority: 100, removable: true },
  { id: 'silence', name: 'Silenziato', kind: 'silence', family: 'control', prevents: ['spell'], defaultDuration: 2, stack: 'refresh', priority: 90, removable: true },
  { id: 'disarm', name: 'Disarmato', kind: 'disarm', family: 'control', prevents: ['attack'], defaultDuration: 2, stack: 'refresh', priority: 90, removable: true },
  // Burn is a SINGLE fire (no stacking): re-igniting a burning target EXTENDS its duration
  // (2+2+…) rather than adding parallel instances. Damage/turn stays flat at tickDamage.
  { id: 'burn', name: 'Bruciatura', kind: 'dot', family: 'dot', tickDamage: 8, defaultDuration: 2, stack: 'extend', priority: 50, removable: true },
  // Veleno is PERMANENT (USER DESIGN 2026-07-04): once applied it ticks EVERY turn until
  // the target dies or combat ends — it never falls off (see status.ts tickStatuses, which
  // skips the `remaining` decrement for permanent statuses). Stacks accumulate up to 8; the
  // per-turn loss = tickDamage*stacks + min(stacks,8)*tickPctMaxHp*maxHp. `defaultDuration`
  // is now moot (kept for the type) since permanent overrides expiry. Still `removable`, so
  // a cleanse can strip it. The veleno ATTACK (serpensortia) does LOW direct damage — the
  // poison is the payoff, not the hit.
  { id: 'veleno', name: 'Veleno', kind: 'dot', family: 'dot', keywords: ['veleno'], tickDamage: 4, tickPctMaxHp: 0.005, tickStackCapForPct: 8, defaultDuration: 2, stack: 'accumulate', maxStacks: 8, priority: 50, removable: true, permanent: true },
  { id: 'regen', name: 'Rigenerazione', kind: 'regen', family: 'regen', tickHeal: 12, defaultDuration: 3, stack: 'refresh', priority: 40, removable: true },
  { id: 'shield', name: 'Scudo', kind: 'shield', family: 'shield', absorb: 50, defaultDuration: 3, stack: 'refresh', priority: 10, removable: true },
  // Nerf (2026-07-02): defaultDuration 3->1 so an unused ward charge decays fast — pairs
  // with the spell cooldown bump (protego 1->2, protego_maxima 2->3) to cut near-permanent uptime.
  { id: 'protego', name: 'Protego', kind: 'ward', family: 'shield', defaultDuration: 1, stack: 'refresh', priority: 15, removable: true, absorb: 1 },
  // Stat buffs/debuffs are permanent (tickStatuses never decrements kind:'buff'/'debuff') and
  // cumulative: stack:'stack' pushes a new entry per re-apply, and effectiveStats sums every
  // entry, so re-casting genuinely compounds the effect instead of just refreshing duration.
  // maxStacks:MAX_STAT_STACKS bounds this so spd (flat, additive) or the pct debuffs below (which
  // compound multiplicatively as (1-x)^N max per stack; flat ones sum to N*x max) can't runaway to
  // a soft-lock (e.g. spd floor of 1). Same constant also caps the inline-effect path
  // (game/engine/status.ts applyInlineEffect) — see MAX_STAT_STACKS in data/constants.ts.
  { id: 'atkUp', name: 'Forza', kind: 'buff', family: 'buff', statMod: { stat: 'atk', amount: 20 }, defaultDuration: 2, stack: 'stack', maxStacks: MAX_STAT_STACKS, priority: 20, removable: true },
  // Weaker, single-stack sibling of atkUp — same family, deliberately capped tighter (1
  // instance, smaller amount) so an on-hit proc that fires many times over a long fight
  // can't out-scale archetypes tuned around the old temporary (pre-permanence) buff.
  // Introduced 2026-07-02 for Cedric's signature; see data/signatures.ts 'cedric' and
  // tests/engine/scudiRigenCounters.test.ts for the counter-relationship it restores.
  { id: 'atkUp1', name: 'Forza Misurata', kind: 'buff', family: 'buff', statMod: { stat: 'atk', amount: 14 }, defaultDuration: 2, stack: 'stack', maxStacks: 1, priority: 20, removable: true },
  { id: 'defUp', name: 'Difesa Rinforzata', kind: 'buff', family: 'buff', statMod: { stat: 'def', amount: 25 }, defaultDuration: 2, stack: 'stack', maxStacks: MAX_STAT_STACKS, priority: 20, removable: true },
  { id: 'spdUp', name: 'Agilità', kind: 'buff', family: 'buff', statMod: { stat: 'spd', amount: 20 }, defaultDuration: 2, stack: 'stack', maxStacks: MAX_STAT_STACKS, priority: 20, removable: true },
  { id: 'slow', name: 'Lentezza', kind: 'debuff', family: 'debuff', statMod: { stat: 'spd', amount: 15 }, defaultDuration: 2, stack: 'stack', maxStacks: MAX_STAT_STACKS, priority: 20, removable: true },
  // Graded percentage debuffs (engine applies statMod.pct as stat*(1+delta/100); debuff → negative).
  { id: 'weaken1', name: 'Indebolimento', kind: 'debuff', family: 'debuff', statMod: { stat: 'atk', amount: 15, pct: true }, defaultDuration: 2, stack: 'stack', maxStacks: MAX_STAT_STACKS, priority: 20, removable: true },
  { id: 'weaken2', name: 'Indebolimento', kind: 'debuff', family: 'debuff', statMod: { stat: 'atk', amount: 25, pct: true }, defaultDuration: 2, stack: 'stack', maxStacks: MAX_STAT_STACKS, priority: 20, removable: true },
  { id: 'weaken3', name: 'Indebolimento', kind: 'debuff', family: 'debuff', statMod: { stat: 'atk', amount: 40, pct: true }, defaultDuration: 2, stack: 'stack', maxStacks: MAX_STAT_STACKS, priority: 20, removable: true },
  { id: 'expose1', name: 'Vulnerabilità', kind: 'debuff', family: 'debuff', statMod: { stat: 'def', amount: 15, pct: true }, defaultDuration: 2, stack: 'stack', maxStacks: MAX_STAT_STACKS, priority: 20, removable: true },
  { id: 'expose2', name: 'Vulnerabilità', kind: 'debuff', family: 'debuff', statMod: { stat: 'def', amount: 25, pct: true }, defaultDuration: 2, stack: 'stack', maxStacks: MAX_STAT_STACKS, priority: 20, removable: true },
  { id: 'expose3', name: 'Vulnerabilità', kind: 'debuff', family: 'debuff', statMod: { stat: 'def', amount: 40, pct: true }, defaultDuration: 2, stack: 'stack', maxStacks: MAX_STAT_STACKS, priority: 20, removable: true },
  { id: 'slow1', name: 'Lentezza', kind: 'debuff', family: 'debuff', statMod: { stat: 'spd', amount: 15, pct: true }, defaultDuration: 2, stack: 'stack', maxStacks: MAX_STAT_STACKS, priority: 20, removable: true },
  { id: 'slow2', name: 'Lentezza', kind: 'debuff', family: 'debuff', statMod: { stat: 'spd', amount: 25, pct: true }, defaultDuration: 2, stack: 'stack', maxStacks: MAX_STAT_STACKS, priority: 20, removable: true },
  { id: 'slow3', name: 'Lentezza', kind: 'debuff', family: 'debuff', statMod: { stat: 'spd', amount: 40, pct: true }, defaultDuration: 2, stack: 'stack', maxStacks: MAX_STAT_STACKS, priority: 20, removable: true },
]

export const STATUS_BY_ID: Record<string, StatusDef> = Object.fromEntries(
  STATUS_DEFS.map(s => [s.id, s]),
)
