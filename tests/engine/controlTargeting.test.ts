import { it, expect } from 'vitest'
import { appliesControl, selectTarget } from '@/game/engine/combat/targeting'
import { SPELL_BY_ID } from '@/data/spells'
import type { BattleUnit } from '@/types'

function enemy(id: string, opts: { stunned?: boolean; threat?: number } = {}): BattleUnit {
  const atk = opts.threat ?? 10
  return {
    wizard: { id, role: 'Attaccante' }, side: 'right', hp: 100, maxHp: 100, alive: true,
    statusEffects: opts.stunned ? [{ kind: 'stun', statusId: 'stun', remaining: 1 }] : [],
    cooldowns: {}, buffedStats: { hp: 100, atk, def: 10, spd: 10 },
  } as unknown as BattleUnit
}
const actor = { wizard: { id: 'a', role: 'Attaccante' }, side: 'left' } as unknown as BattleUnit

it('appliesControl detects stun on Stupeficium', () => {
  expect(appliesControl(SPELL_BY_ID['stupeficium']!).has('stun')).toBe(true)
})
it('appliesControl is empty for a pure-damage spell', () => {
  expect(appliesControl(SPELL_BY_ID['reducto'] ?? SPELL_BY_ID['flipendo']!).size).toBe(0)
})

it('a stun spell skips an already-stunned enemy when another valid target exists', () => {
  const stunned = enemy('stunned', { stunned: true, threat: 100 }) // highest threat but already stunned
  const fresh = enemy('fresh', { threat: 50 })
  const t = selectTarget(actor, [], [stunned, fresh], SPELL_BY_ID['stupeficium']!)
  expect(t?.wizard.id).toBe('fresh')
})

it('a stun spell falls back to the full pool when ALL enemies are stunned', () => {
  const s1 = enemy('s1', { stunned: true, threat: 100 })
  const s2 = enemy('s2', { stunned: true, threat: 50 })
  const t = selectTarget(actor, [], [s1, s2], SPELL_BY_ID['stupeficium']!)
  expect(t).toBeTruthy() // still attacks someone (highest threat)
  expect(t?.wizard.id).toBe('s1')
})

it('a non-control spell ignores stun state (targets by threat)', () => {
  const stunned = enemy('stunned', { stunned: true, threat: 100 })
  const fresh = enemy('fresh', { threat: 50 })
  const t = selectTarget(actor, [], [stunned, fresh], SPELL_BY_ID['flipendo']!)
  expect(t?.wizard.id).toBe('stunned') // highest threat, control state irrelevant
})
