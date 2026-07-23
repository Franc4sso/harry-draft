import { describe, it, expect } from 'vitest'
import { detectSynergies } from '@/game/engine/synergy'
import { teamShieldConvert } from '@/game/engine/shieldConvert'
import { EFFECT_HANDLERS } from '@/game/engine/combat/effects'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { battleReadyTeam } from '@/game/engine/battlePrep'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng, type Rng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { BattleUnit, DraftedWizard, Wizard } from '@/types'

const dw = (id: string, tags: string[] = []): DraftedWizard =>
  ({ wizard: { id, role: 'Tank', house: 'Tassorosso', tags }, level: 1 } as unknown as DraftedWizard)

describe('sinergia bastione (archetipo Muro Riflettente)', () => {
  it('si accende con 3 maghi scudirigen, non con 2', () => {
    const three = [dw('a', ['scudirigen']), dw('b', ['scudirigen']), dw('c', ['scudirigen'])]
    const two = [dw('a', ['scudirigen']), dw('b', ['scudirigen'])]
    expect(detectSynergies(three).map(s => s.synergy.id)).toContain('bastione')
    expect(detectSynergies(two).map(s => s.synergy.id)).not.toContain('bastione')
  })

  it('riaccende il branch shieldConvert morto: rate più alto con bastione', () => {
    const team = [dw('a', ['scudirigen']), dw('b', ['scudirigen']), dw('c', ['scudirigen'])]
    const syn = detectSynergies(team)
    // con una reliquia grantsShieldConvert base + bastione, il rate include il +0.35
    const relic = { relic: { id: 'egida-tassorosso', name: '', desc: '', rarity: 'rara', keywords: ['scudo'], grantsShieldConvert: { rate: 0.5 } } } as any
    const withBastione = teamShieldConvert(team, [relic], syn)
    const withoutBastione = teamShieldConvert(team, [relic], [])
    expect(withBastione!.rate).toBeGreaterThan(withoutBastione!.rate)
  })
})

// Pattern identico a tests/engine/duoEffects/muroVivente.test.ts (stesso builder unit(),
// stesso shielded() via EFFECT_HANDLERS.shield, ctx sintetico passato a EFFECT_HANDLERS.damage).
// wallReflect è l'archetipo (NON il Duo livingWall): non-letale, ENTRAMBI i lati.
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
function shielded(u: BattleUnit, amount: number) {
  EFFECT_HANDLERS.shield(
    { rng: createRng(`${u.side}:seed`), turn: 1, actor: u, target: u, flags: [] } as any,
    { kind: 'shield', amount } as any,
  )
}

describe('archetipo Muro Riflettente — wallReflect (riflesso diffuso, entrambi i lati)', () => {
  it('un\'unità scudata col player (wallReflect=0.25) riflette il 25% dell\'assorbito sull\'attaccante nemico', () => {
    const wall = unit('wall', 'Tank', 'left'); wall.wallReflect = 0.25
    const enemy = unit('enemy', 'Attaccante', 'right'); enemy.hp = 300; enemy.maxHp = 300
    shielded(wall, 500) // scudo capiente: assorbe tutto il colpo
    const ctx: any = { rng: createRng('bastione'), turn: 1, actor: enemy, target: wall, flags: [] }
    EFFECT_HANDLERS.damage(ctx, { kind: 'damage', power: 1, canDodge: false } as any)
    expect(wall.hp).toBe(100) // scudo ha assorbito tutto
    expect(ctx.reflect).toBeTruthy()
    expect(ctx.reflect.unitId).toBe('enemy')
    expect(ctx.reflect.side).toBe('right')
    expect(ctx.reflect.amount).toBeGreaterThan(0)
    expect(enemy.hp).toBe(300 - ctx.reflect.amount)
  })

  it('è NON letale sul lato player: lascia l\'attaccante nemico ad almeno 1 HP', () => {
    const wall = unit('wall', 'Tank', 'left'); wall.wallReflect = 0.25
    const enemy = unit('enemy', 'Attaccante', 'right'); enemy.hp = 3; enemy.maxHp = 300
    shielded(wall, 500)
    const ctx: any = { rng: createRng('bastione'), turn: 1, actor: enemy, target: wall, flags: [] }
    EFFECT_HANDLERS.damage(ctx, { kind: 'damage', power: 1, canDodge: false } as any)
    expect(enemy.hp).toBe(1)
  })

  it('un NEMICO scudato con wallReflect riflette il danno del player (entrambi i lati)', () => {
    const enemyWall = unit('enemy-wall', 'Tank', 'right'); enemyWall.wallReflect = 0.25
    const player = unit('player', 'Attaccante', 'left'); player.hp = 300; player.maxHp = 300
    shielded(enemyWall, 500)
    const ctx: any = { rng: createRng('bastione'), turn: 1, actor: player, target: enemyWall, flags: [] }
    EFFECT_HANDLERS.damage(ctx, { kind: 'damage', power: 1, canDodge: false } as any)
    expect(ctx.reflect).toBeTruthy()
    expect(ctx.reflect.unitId).toBe('player')
    expect(ctx.reflect.side).toBe('left')
    expect(ctx.reflect.amount).toBeGreaterThan(0)
    expect(player.hp).toBe(300 - ctx.reflect.amount)
  })

  it('è NON letale sul lato nemico: lascia l\'attaccante player ad almeno 1 HP', () => {
    const enemyWall = unit('enemy-wall', 'Tank', 'right'); enemyWall.wallReflect = 0.25
    const player = unit('player', 'Attaccante', 'left'); player.hp = 3; player.maxHp = 300
    shielded(enemyWall, 500)
    const ctx: any = { rng: createRng('bastione'), turn: 1, actor: player, target: enemyWall, flags: [] }
    EFFECT_HANDLERS.damage(ctx, { kind: 'damage', power: 1, canDodge: false } as any)
    expect(player.hp).toBe(1)
  })

  it('livingWall (Duo) vince su wallReflect (archetipo) quando entrambi sono presenti sullo stesso target', () => {
    // Stesso colpo (stessi stat/rng) contro due target identici, uno con SOLO wallReflect=0.25,
    // uno con ENTRAMBI livingWall.reflect=0.4 e wallReflect=0.25: se il Duo vince, l'amount
    // riflesso sul secondo deve coincidere col caso "solo livingWall=0.4" (maggiore del 25%-only).
    const wallArchOnly = unit('wall-arch', 'Tank', 'left'); wallArchOnly.wallReflect = 0.25
    const enemyArch = unit('enemy', 'Attaccante', 'right'); enemyArch.hp = 300; enemyArch.maxHp = 300
    shielded(wallArchOnly, 500)
    const ctxArch: any = { rng: createRng('bastione'), turn: 1, actor: enemyArch, target: wallArchOnly, flags: [] }
    EFFECT_HANDLERS.damage(ctxArch, { kind: 'damage', power: 1, canDodge: false } as any)

    const wallBoth = unit('wall-both', 'Tank', 'left')
    wallBoth.livingWall = { reflect: 0.4 }
    wallBoth.wallReflect = 0.25
    const enemyBoth = unit('enemy', 'Attaccante', 'right'); enemyBoth.hp = 300; enemyBoth.maxHp = 300
    shielded(wallBoth, 500)
    const ctxBoth: any = { rng: createRng('bastione'), turn: 1, actor: enemyBoth, target: wallBoth, flags: [] }
    EFFECT_HANDLERS.damage(ctxBoth, { kind: 'damage', power: 1, canDodge: false } as any)

    const wallLwOnly = unit('wall-lw', 'Tank', 'left'); wallLwOnly.livingWall = { reflect: 0.4 }
    const enemyLw = unit('enemy', 'Attaccante', 'right'); enemyLw.hp = 300; enemyLw.maxHp = 300
    shielded(wallLwOnly, 500)
    const ctxLw: any = { rng: createRng('bastione'), turn: 1, actor: enemyLw, target: wallLwOnly, flags: [] }
    EFFECT_HANDLERS.damage(ctxLw, { kind: 'damage', power: 1, canDodge: false } as any)

    expect(ctxBoth.reflect.amount).toBe(ctxLw.reflect.amount)     // il branch Duo (0.4) è quello attivo
    expect(ctxBoth.reflect.amount).not.toBe(ctxArch.reflect.amount) // non l'archetipo (0.25)
  })

  it('senza wallReflect e senza livingWall, nessun riflesso', () => {
    const wall = unit('wall', 'Tank', 'left') // niente wallReflect né livingWall
    const enemy = unit('enemy', 'Attaccante', 'right')
    shielded(wall, 500)
    const ctx: any = { rng: createRng('bastione'), turn: 1, actor: enemy, target: wall, flags: [] }
    EFFECT_HANDLERS.damage(ctx, { kind: 'damage', power: 1, canDodge: false } as any)
    expect(ctx.reflect).toBeUndefined()
    expect(enemy.hp).toBe(100)
  })
})

// Builder pattern identico a tests/engine/duoEffects/muroVivente.test.ts / duoStress.test.ts.
function draftedFrom(rng: Rng, id: string, spellId: string): DraftedWizard {
  const w = WIZARD_BY_ID[id]
  if (!w) throw new Error(`unknown wizard id: ${id}`)
  const dw = draftWizard(rng, w)
  const spell = SPELL_BY_ID[spellId]
  if (!spell) throw new Error(`unknown spell id: ${spellId}`)
  return { ...dw, level: 8, spell }
}

describe('archetipo Muro Riflettente — riga di log nel sim (senza Duo)', () => {
  it('emette una riga "Riflesso" (no duoId) quando un NEMICO bastione riflette il player', () => {
    const rng = createRng('bastione-sim')
    // Squadra NEMICA con 3 maghi scudirigen (Tassorosso) → sinergia bastione (>=3), stampata
    // via registerSynergyTriggers su rightSyn. ernie (Tank) usa fianto = self-shield.
    const enemyTeam: DraftedWizard[] = [
      draftedFrom(rng, 'ernie', 'fianto'),
      draftedFrom(rng, 'sprout', 'ferula'),
      draftedFrom(rng, 'hannah', 'episkey'),
    ]
    const playerTeam: DraftedWizard[] = [
      draftedFrom(rng, 'harry', 'reducto'),
      draftedFrom(rng, 'dolohov', 'confringo'),
    ]
    const left = battleReadyTeam(playerTeam)
    const right = battleReadyTeam(enemyTeam)
    const rightSyn = detectSynergies(enemyTeam)
    expect(rightSyn.map(s => s.synergy.id)).toContain('bastione')

    let reflected: any
    let res: any
    for (let i = 0; i < 30 && !reflected; i++) {
      res = simulateBattle(left, right, createRng(`bastione-sim-log-${i}`), { rightSyn })
      reflected = res.log.find((e: any) => e.action === 'Riflesso')
    }

    expect(reflected).toBeTruthy()
    expect(reflected.type).toBe('system')
    expect(reflected.duoId).toBeUndefined()          // archetipo puro: niente Duo
    expect(reflected.actorSide).toBe('right')         // il muro nemico che ha riflettuto
    expect(reflected.targetSide).toBe('left')         // l'attaccante player colpito dal riflesso
    expect(reflected.value).toBeGreaterThan(0)
    // nessuna riga loggata espone il campo transiente
    expect(res.log.every((e: any) => e._reflect === undefined)).toBe(true)
  })
})
