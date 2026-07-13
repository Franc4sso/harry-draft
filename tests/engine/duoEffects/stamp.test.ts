import { describe, it, expect } from 'vitest'
import { stampDuoFields } from '@/game/engine/duoEffects/stamp'
import type { ActiveDuo, BattleUnit } from '@/types'

const unit = (side: 'left'|'right', role='Attaccante'): BattleUnit =>
  ({ side, alive: true, hp: 100, statusEffects: [], wizard: { role } } as unknown as BattleUnit)
const duo = (id: string): ActiveDuo => ({ duo: { id, name:'', desc:'', signals:['veleno','magieOscure'] } })

describe('stampDuoFields', () => {
  it('CANCRENA stamps poisonAmp on enemy (right) units only', () => {
    const L = [unit('left')], R = [unit('right')]
    stampDuoFields(L, R, [duo('cancrena')], 'normal')
    expect(R[0]!.poisonAmp).toEqual({ threshold: 0.4, mult: 2 })
    expect(L[0]!.poisonAmp).toBeUndefined()
  })
  it('MURO VIVENTE stamps livingWall on player Tanks only', () => {
    const L = [unit('left', 'Tank'), unit('left', 'Attaccante')], R = [unit('right', 'Tank')]
    stampDuoFields(L, R, [duo('muro-vivente')], 'normal')
    expect(L[0]!.livingWall).toEqual({ reflect: 0.4 })
    expect(L[1]!.livingWall).toBeUndefined()
    expect(R[0]!.livingWall).toBeUndefined()
  })
  it('no duos → no stamps', () => {
    const L = [unit('left')], R = [unit('right')]
    stampDuoFields(L, R, [], 'normal')
    expect(L[0]!.poisonAmp).toBeUndefined()
    expect(L[0]!.livingWall).toBeUndefined()
    expect(L[0]!.coldExecute).toBeUndefined()
    expect(L[0]!.reaper).toBeUndefined()
  })
  it('ESECUZIONE A FREDDO stamps coldExecute with instakill=true in a non-boss battle', () => {
    const L = [unit('left')], R = [unit('right')]
    stampDuoFields(L, R, [duo('esecuzione-a-freddo')], 'normal')
    expect(L[0]!.coldExecute).toEqual({ threshold: 0.5, instakill: true })
    expect(R[0]!.coldExecute).toBeUndefined() // player-only
  })
  it('ESECUZIONE A FREDDO stamps instakill=false in a BOSS battle (boss climax stays hard)', () => {
    const L = [unit('left')], R = [unit('right')]
    stampDuoFields(L, R, [duo('esecuzione-a-freddo')], 'boss')
    expect(L[0]!.coldExecute).toEqual({ threshold: 0.5, instakill: false })
  })
})
