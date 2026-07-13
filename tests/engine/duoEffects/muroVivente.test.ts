import { describe, it, expect } from 'vitest'
import type { ActiveDuo, BattleUnit, Wizard } from '@/types'
import { stampDuoFields } from '@/game/engine/duoEffects/stamp'
import { DUO_BY_ID } from '@/data/duos'
import { EFFECT_HANDLERS } from '@/game/engine/combat/effects'
import { createRng } from '@/game/engine/rng'

function wiz(id: string, role: Wizard['role']): Wizard {
  return {
    id, name: id, role, house: 'Grifondoro', tier: 3, gender: 'm',
    ranges: { hp: [100, 100], atk: [50, 50], def: [10, 10], spd: [10, 10] }, spellPool: ['base_attack'],
  }
}
function unit(id: string, role: Wizard['role'], side: 'left' | 'right'): BattleUnit {
  const w = wiz(id, role)
  return {
    wizard: w, spell: { id: 'base_attack', name: 'Attacco', type: 'Attacco' } as any,
    stats: { hp: 100, atk: 50, def: 10, spd: 10 }, maxHp: 100,
    buffedStats: { hp: 100, atk: 50, def: 10, spd: 10 }, hp: 100,
    cooldowns: {}, statusEffects: [], alive: true, side,
  } as BattleUnit
}
const muroDuo: ActiveDuo = { duo: DUO_BY_ID['muro-vivente']! }

describe('Muro Vivente — stamp', () => {
  it('stampa livingWall = { reflect } sui Tank del player', () => {
    const tank = unit('tank', 'Tank', 'left')
    const carry = unit('carry', 'Attaccante', 'left')
    stampDuoFields([tank, carry], [], [muroDuo], 'normal')
    expect(tank.livingWall).toEqual({ reflect: 0.4 })
    expect(carry.livingWall).toBeUndefined()   // solo i Tank
  })

  it('non stampa nulla sui nemici', () => {
    const enemyTank = unit('etank', 'Tank', 'right')
    stampDuoFields([], [enemyTank], [muroDuo], 'normal')
    expect(enemyTank.livingWall).toBeUndefined()
  })
})

// Costruisce uno scudo con absorbLeft = amount sull'unit, passando dal vero EFFECT_HANDLERS.shield
// (stesso pattern di tests/engine/combat/shieldRefresh.test.ts e tests/engine/darkRecoil.test.ts) —
// applyStatus si aspetta uno statusId stringa, non un EffectSpec, quindi lo scudo va creato così.
function shielded(u: BattleUnit, amount: number) {
  EFFECT_HANDLERS.shield(
    { rng: createRng(`${u.side}:seed`), turn: 1, actor: u, target: u, flags: [] } as any,
    { kind: 'shield', amount } as any,
  )
}

describe('Muro Vivente — riflesso (handler)', () => {
  function setup(reflect = 0.4, actorHp = 300) {
    const tank = unit('tank', 'Tank', 'left'); tank.livingWall = { reflect }
    const enemy = unit('enemy', 'Attaccante', 'right'); enemy.hp = actorHp; enemy.maxHp = 300
    return { tank, enemy }
  }

  it('riflette il 40% del danno ASSORBITO sull\'attaccante', () => {
    const { tank, enemy } = setup()
    shielded(tank, 500)   // scudo capiente: assorbe tutto
    const ctx: any = { rng: createRng('mv'), turn: 1, actor: enemy, target: tank, flags: [] }
    // Lo scudo capiente assorbe l'intero colpo → tank.hp resta 100
    EFFECT_HANDLERS.damage(ctx, { kind: 'damage', power: 1, canDodge: false } as any)
    expect(tank.hp).toBe(100)
    // ctx.reflect valorizzato, amount = round(dmg * 0.4), enemy.hp calato di quell'importo
    expect(ctx.reflect).toBeTruthy()
    expect(ctx.reflect.unitId).toBe('enemy')
    expect(ctx.reflect.side).toBe('right')
    expect(ctx.reflect.amount).toBeGreaterThan(0)
    expect(enemy.hp).toBe(300 - ctx.reflect.amount)
  })

  it('NON riflette se lo scudo è a 0 (nessun assorbimento)', () => {
    const { tank, enemy } = setup()
    // niente scudo
    const ctx: any = { rng: createRng('mv'), turn: 1, actor: enemy, target: tank, flags: [] }
    EFFECT_HANDLERS.damage(ctx, { kind: 'damage', power: 1, canDodge: false } as any)
    expect(ctx.reflect).toBeUndefined()
    expect(enemy.hp).toBe(300)
  })

  it('riflette solo sulla parte ASSORBITA quando lo scudo è più piccolo del colpo', () => {
    const { tank, enemy } = setup()
    shielded(tank, 10)   // scudo piccolo: assorbe 10, il resto passa al Tank
    const ctx: any = { rng: createRng('mv'), turn: 1, actor: enemy, target: tank, flags: [] }
    EFFECT_HANDLERS.damage(ctx, { kind: 'damage', power: 1, canDodge: false } as any)
    expect(ctx.reflect.amount).toBe(Math.round(10 * 0.4))   // = 4, solo l'assorbito
    expect(tank.hp).toBeLessThan(100)   // l'eccesso ha ferito il Tank
  })

  it('è NON letale: lascia l\'attaccante ad almeno 1 HP', () => {
    const { tank, enemy } = setup(0.4, 3)   // enemy a 3 HP
    shielded(tank, 500)
    const ctx: any = { rng: createRng('mv'), turn: 1, actor: enemy, target: tank, flags: [] }
    EFFECT_HANDLERS.damage(ctx, { kind: 'damage', power: 1, canDodge: false } as any)
    expect(enemy.hp).toBe(1)   // il riflesso non può uccidere
  })

  it('un Tank SENZA muro non riflette', () => {
    const tank = unit('tank', 'Tank', 'left')   // niente livingWall
    const enemy = unit('enemy', 'Attaccante', 'right')
    shielded(tank, 500)
    const ctx: any = { rng: createRng('mv'), turn: 1, actor: enemy, target: tank, flags: [] }
    EFFECT_HANDLERS.damage(ctx, { kind: 'damage', power: 1, canDodge: false } as any)
    expect(ctx.reflect).toBeUndefined()
    expect(enemy.hp).toBe(100)
  })
})
