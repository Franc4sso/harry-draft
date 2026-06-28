import type { StatusDef } from '@/types'

export const STATUS_DEFS: StatusDef[] = [
  { id: 'stun', name: 'Stordito', kind: 'stun', family: 'control', prevents: ['action'], defaultDuration: 1, stack: 'refresh', priority: 100, removable: false },
  { id: 'freeze', name: 'Congelamento', kind: 'freeze', family: 'control', prevents: ['action'], defaultDuration: 2, stack: 'refresh', priority: 100, removable: true },
  { id: 'silence', name: 'Silenziato', kind: 'silence', family: 'control', prevents: ['spell'], defaultDuration: 2, stack: 'refresh', priority: 90, removable: true },
  { id: 'disarm', name: 'Disarmato', kind: 'disarm', family: 'control', prevents: ['attack'], defaultDuration: 2, stack: 'refresh', priority: 90, removable: true },
  { id: 'burn', name: 'Bruciatura', kind: 'dot', family: 'dot', tickDamage: 8, defaultDuration: 2, stack: 'stack', maxStacks: 3, priority: 50, removable: true },
  { id: 'veleno', name: 'Veleno', kind: 'dot', family: 'dot', keywords: ['veleno'], tickDamage: 4, tickPctMaxHp: 0.005, tickStackCapForPct: 8, defaultDuration: 2, stack: 'accumulate', maxStacks: 8, priority: 50, removable: true },
  { id: 'regen', name: 'Rigenerazione', kind: 'regen', family: 'regen', tickHeal: 12, defaultDuration: 3, stack: 'refresh', priority: 40, removable: true },
  { id: 'shield', name: 'Scudo', kind: 'shield', family: 'shield', absorb: 50, defaultDuration: 3, stack: 'refresh', priority: 10, removable: true },
  { id: 'protego', name: 'Protego', kind: 'ward', family: 'shield', defaultDuration: 3, stack: 'refresh', priority: 15, removable: true, absorb: 1 },
  { id: 'atkUp', name: 'Forza', kind: 'buff', family: 'buff', statMod: { stat: 'atk', amount: 20 }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
  { id: 'defUp', name: 'Difesa Rinforzata', kind: 'buff', family: 'buff', statMod: { stat: 'def', amount: 25 }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
  { id: 'slow', name: 'Lentezza', kind: 'debuff', family: 'debuff', statMod: { stat: 'spd', amount: 15 }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
  // Graded percentage debuffs (engine applies statMod.pct as stat*(1+delta/100); debuff → negative).
  { id: 'weaken1', name: 'Indebolimento', kind: 'debuff', family: 'debuff', statMod: { stat: 'atk', amount: 15, pct: true }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
  { id: 'weaken2', name: 'Indebolimento', kind: 'debuff', family: 'debuff', statMod: { stat: 'atk', amount: 25, pct: true }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
  { id: 'weaken3', name: 'Indebolimento', kind: 'debuff', family: 'debuff', statMod: { stat: 'atk', amount: 40, pct: true }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
  { id: 'expose1', name: 'Vulnerabilità', kind: 'debuff', family: 'debuff', statMod: { stat: 'def', amount: 15, pct: true }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
  { id: 'expose2', name: 'Vulnerabilità', kind: 'debuff', family: 'debuff', statMod: { stat: 'def', amount: 25, pct: true }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
  { id: 'expose3', name: 'Vulnerabilità', kind: 'debuff', family: 'debuff', statMod: { stat: 'def', amount: 40, pct: true }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
  { id: 'slow1', name: 'Lentezza', kind: 'debuff', family: 'debuff', statMod: { stat: 'spd', amount: 15, pct: true }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
  { id: 'slow2', name: 'Lentezza', kind: 'debuff', family: 'debuff', statMod: { stat: 'spd', amount: 25, pct: true }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
  { id: 'slow3', name: 'Lentezza', kind: 'debuff', family: 'debuff', statMod: { stat: 'spd', amount: 40, pct: true }, defaultDuration: 2, stack: 'refresh', priority: 20, removable: true },
]

export const STATUS_BY_ID: Record<string, StatusDef> = Object.fromEntries(
  STATUS_DEFS.map(s => [s.id, s]),
)
