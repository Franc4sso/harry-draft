import { describe, it, expect } from 'vitest'
import { sceneEventOf } from '@/lib/battleScene'
import type { ReplayFrame } from '@/game/engine/combat/replay'
import type { LogEntry } from '@/types'

const frame = (entry: LogEntry | null, statusEffects: Record<string, {kind: string}[]> = {}): ReplayFrame =>
  ({ index: 1, entry, hp: {}, cooldowns: {}, statusEffects: statusEffects as never } as ReplayFrame)

const entry = (p: Partial<LogEntry>): LogEntry =>
  ({ turn: 1, actorId: 'a', actorSide: 'left', action: 'Colpo', type: 'Attacco', flags: [], ...p } as LogEntry)

describe('sceneEventOf — ogni evento del motore ha una scena', () => {
  it('un turno saltato è una scena, non un buco', () => {
    const e = sceneEventOf(frame(entry({ action: 'Stordito', type: 'system', flags: ['stun'] })))
    expect(e.kind).toBe('skip')
    expect(e.word).toBe('SALTA')
  })

  it('riconosce il critico dal flag, non dal valore', () => {
    expect(sceneEventOf(frame(entry({ flags: ['crit'], value: 74 }))).kind).toBe('crit')
    expect(sceneEventOf(frame(entry({ flags: [], value: 74 }))).kind).toBe('hit')
  })

  it('riconosce schivata, blocco, penetrazione, contraccolpo', () => {
    expect(sceneEventOf(frame(entry({ flags: ['dodge'] }))).kind).toBe('dodge')
    expect(sceneEventOf(frame(entry({ flags: ['block'] }))).kind).toBe('block')
    expect(sceneEventOf(frame(entry({ flags: ['pen'] }))).kind).toBe('pen')
    expect(sceneEventOf(frame(entry({ flags: ['recoil'] }))).kind).toBe('recoil')
  })

  it('la cura e la rianimazione sono scene distinte', () => {
    expect(sceneEventOf(frame(entry({ flags: ['heal'], value: 28 }))).kind).toBe('heal')
    expect(sceneEventOf(frame(entry({ flags: ['revive'] }))).kind).toBe('revive')
  })

  it('l’uccisione vince su qualunque altro flag', () => {
    expect(sceneEventOf(frame(entry({ flags: ['crit', 'kill'] }))).kind).toBe('kill')
  })

  it('riconosce le tre azioni di Duo per nome', () => {
    expect(sceneEventOf(frame(entry({ action: 'Miasma', type: 'system' }))).kind).toBe('duo-miasma')
    expect(sceneEventOf(frame(entry({ action: 'MuroVivente', type: 'system' }))).kind).toBe('duo-muro')
    expect(sceneEventOf(frame(entry({ action: 'Untore', type: 'system' }))).kind).toBe('duo-untore')
  })

  it('riconosce Fatica, Purificazione e Rigenera', () => {
    expect(sceneEventOf(frame(entry({ action: 'Fatica', type: 'system' }))).kind).toBe('fatigue')
    expect(sceneEventOf(frame(entry({ action: 'Purificazione', type: 'system' }))).kind).toBe('purify')
    expect(sceneEventOf(frame(entry({ action: 'Rigenera', type: 'system' }))).kind).toBe('regen')
  })

  it('il danno nel tempo si riconosce dal flag dot', () => {
    expect(sceneEventOf(frame(entry({ flags: ['dot'], value: 6 }))).kind).toBe('dot')
  })

  it('confronta gli stati fra due frame: comparsi e spariti', () => {
    const prev = frame(null, { 'left:harry': [{ kind: 'shield' }] })
    const now  = frame(entry({}), { 'left:harry': [{ kind: 'veleno' }, { kind: 'stun' }] })
    const e = sceneEventOf(now, prev)
    expect(e.gained['left:harry']).toEqual(expect.arrayContaining(['veleno', 'stun']))
    expect(e.lost['left:harry']).toEqual(['shield'])
  })

  it('il valore è sempre positivo, anche per i danni', () => {
    expect(sceneEventOf(frame(entry({ value: -31 }))).amount).toBe(31)
  })

  it('un frame senza entry non produce scena', () => {
    expect(sceneEventOf(frame(null)).kind).toBe('none')
  })
})
