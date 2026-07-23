import { describe, it, expect } from 'vitest'
import type { ActiveDuo, BattleUnit, DraftedWizard, Wizard } from '@/types'
import { stampDuoFields } from '@/game/engine/duoEffects/stamp'
import { DUO_BY_ID } from '@/data/duos'
import { EFFECT_HANDLERS } from '@/game/engine/combat/effects'
import { createRng, type Rng } from '@/game/engine/rng'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { battleReadyTeam } from '@/game/engine/battlePrep'
import { detectSynergies } from '@/game/engine/synergy'
import { detectDuos } from '@/game/engine/duos'
import { draftWizard } from '@/game/engine/statRoll'
import { WIZARD_BY_ID } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'

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
    expect(tank.livingWall).toEqual({ reflect: 0.5 })   // Task 3: bump 0.4→0.5 (Duo più forte, oltre al letale)
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

  it('è LETALE (Task 3): può portare l\'attaccante a 0 HP o sotto, nessun cap hp-1', () => {
    const { tank, enemy } = setup(0.4, 3)   // enemy a 3 HP
    shielded(tank, 500)
    const ctx: any = { rng: createRng('mv'), turn: 1, actor: enemy, target: tank, flags: [] }
    EFFECT_HANDLERS.damage(ctx, { kind: 'damage', power: 1, canDodge: false } as any)
    expect(enemy.hp).toBeLessThanOrEqual(0)   // il Duo può uccidere (amplificatore letale)
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

// Builder pattern identico a tests/engine/duoStress.test.ts (draftedFrom + detectDuos +
// battleReadyTeam + simulateBattle con leftDuos) — riusato qui per un mini end-to-end sul
// sim, non inventato da zero.
function draftedFrom(rng: Rng, id: string, spellId: string): DraftedWizard {
  const w = WIZARD_BY_ID[id]
  if (!w) throw new Error(`unknown wizard id: ${id}`)
  const dw = draftWizard(rng, w)
  const spell = SPELL_BY_ID[spellId]
  if (!spell) throw new Error(`unknown spell id: ${spellId}`)
  return { ...dw, level: 8, spell }
}

describe('Muro Vivente — riga di log nel sim', () => {
  it('emette una riga MuroVivente puntata sull\'attaccante quando lo scudo assorbe', () => {
    const rng = createRng('duo-team-muro-vivente-sim')
    const team: DraftedWizard[] = [
      draftedFrom(rng, 'mcgonagall', 'fianto'), // Tank + self-shield: il muro
      draftedFrom(rng, 'tonks', 'petrificus'),
      draftedFrom(rng, 'sprout', 'ferula'),
      draftedFrom(rng, 'harry', 'reducto'),
      draftedFrom(rng, 'dolohov', 'confringo'),
    ]
    const enemy: DraftedWizard[] = [
      draftedFrom(rng, 'bellatrix', 'confringo'),
      draftedFrom(rng, 'greyback', 'serpensortia'),
      draftedFrom(rng, 'draco', 'serpensortia'),
      draftedFrom(rng, 'snape', 'sectumsempra'),
      draftedFrom(rng, 'lucius', 'confringo'),
    ]
    const left = battleReadyTeam(team)
    const leftSyn = detectSynergies(left)
    const leftDuos = detectDuos(team, [])
    expect(leftDuos.map(d => d.duo.id)).toContain('muro-vivente')

    let wall: any
    let res: any
    // L'iron taunt convoglia i colpi nemici sul Tank quasi sempre, ma non è garantito ogni
    // seed: prova qualche seed finché la riga MuroVivente compare (gate = "compare la riga
    // col valore giusto", non un seed specifico, per nota del brief).
    for (let i = 0; i < 20 && !wall; i++) {
      res = simulateBattle(left, battleReadyTeam(enemy), createRng(`muro-vivente-sim-${i}`), { leftSyn, leftDuos })
      wall = res.log.find((e: any) => e.action === 'MuroVivente')
    }

    expect(wall).toBeTruthy()
    expect(wall.type).toBe('system')
    expect(wall.duoId).toBe('muro-vivente')
    expect(wall.flags).toContain('duo')
    expect(wall.actorSide).toBe('left')       // il Tank col muro
    expect(wall.targetSide).toBe('right')     // l'attaccante nemico
    expect(wall.value).toBeGreaterThan(0)
    // nessuna riga loggata espone il campo transiente
    expect(res.log.every((e: any) => e._reflect === undefined)).toBe(true)
  })
})
