// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createState, unitAt, alive } from '@/game/engine/rt/state'
import { cooldownFor } from '@/game/engine/rt/constants'
import { createRng } from '@/game/engine/rng'
import { squad, unit } from './fixtures'

describe('createState', () => {
  it('HP squadra = somma hp × levelHpMult, scudo = somma def × 2', () => {
    const left = squad({ stats: { hp: 100, atk: 10, def: 10, spd: 10 }, level: 1 }, { stats: { hp: 100, atk: 10, def: 20, spd: 10 }, level: 3 })
    const right = squad({ stats: { hp: 50, atk: 10, def: 5, spd: 10 } })
    const s = createState(left, right, createRng(1))
    expect(s.sides[0].hpMax).toBe(100 + 140)
    expect(s.sides[0].hp).toBe(240)
    expect(s.sides[0].shield).toBe(20 + 40)
    expect(s.sides[1].hpMax).toBe(50)
    expect(s.sides[1].shield).toBe(10)
  })
  it('cooldown da spd e livello, minimo 2', () => {
    expect(cooldownFor(20, 1)).toBe(5)
    expect(cooldownFor(10, 1)).toBe(7)
    expect(cooldownFor(38, 1)).toBe(3)
    expect(cooldownFor(38, 4)).toBe(2)
    expect(cooldownFor(38, 4, 1)).toBe(3)
    expect(cooldownFor(0, 1)).toBe(8)
  })
  it('unità con timer 0, cd calcolato, chiave lato:id', () => {
    const s = createState(squad({ id: 'a', stats: { hp: 1, atk: 1, def: 1, spd: 20 } }), squad({ id: 'b' }), createRng(1))
    const a = unitAt(s, 'left', 0)!
    expect(a.key).toBe('left:a'); expect(a.timer).toBe(0); expect(a.cd).toBe(5); expect(a.ko).toBe(false)
    expect(alive(s, 'right').map(u => u.id)).toEqual(['b'])
    expect(unitAt(s, 'left', 3)).toBeNull()
  })
  it('scudoInizialeMult dei mods moltiplica lo scudo di partenza', () => {
    const s = createState(squad({ stats: { hp: 1, atk: 1, def: 10, spd: 1 } }), squad({}), createRng(1), { leftMods: { scudoInizialeMult: 1.5 } })
    expect(s.sides[0].shield).toBe(30)
  })
  it('rifiuta slot duplicati o fuori griglia', () => {
    expect(() => createState([unit({ slot: 0 }), unit({ slot: 0 })], squad({}), createRng(1))).toThrow(/slot/)
    expect(() => createState([unit({ slot: 6 })], squad({}), createRng(1))).toThrow(/slot/)
  })
})
