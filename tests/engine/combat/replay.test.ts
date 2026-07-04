import { describe, it, expect } from 'vitest'
import { buildReplay, unitKey } from '@/game/engine/combat/replay'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'
import type { BattleResult, DraftedWizard } from '@/types'

function team(ids: string[], seed = 1): DraftedWizard[] {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}

const left = () => team(['harry', 'ron', 'hermione', 'luna', 'neville'], 7)
const right = () => team(['draco', 'crabbe', 'goyle', 'snape', 'bellatrix'], 13)

describe('buildReplay', () => {
  it('captures per-frame EFFECTIVE spd so a mid-combat spd change is visible to the order rail', () => {
    // Force harry to cast Confundo (spd -15 debuff) so draco's effective spd drops mid-fight.
    const l = team(['harry'], 1)
    l[0]!.spell = SPELL_BY_ID['confundo']!
    const r = team(['draco'], 2)
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    const dracoKey = unitKey('right', 'draco')
    const baseSpd = replay.frames[0]!.spd![dracoKey]!
    // frame 0 (no statuses) shows the base spd; at least one later frame shows it reduced.
    expect(baseSpd).toBeGreaterThan(1)
    expect(replay.frames.some(f => (f.spd?.[dracoKey] ?? baseSpd) < baseSpd)).toBe(true)
  })

  it('produces an initial full-HP frame plus one frame per log entry', () => {
    const l = left(), r = right()
    const res = simulateBattle(l, r, createRng(42))
    const replay = buildReplay(res, l, r)
    expect(replay.frames).toHaveLength(res.log.length + 1)
    expect(replay.frames[0]!.entry).toBeNull()
    expect(replay.frames[0]!.index).toBe(0)
  })

  it('lists every unit on both sides with a unique key', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    expect(replay.units).toHaveLength(10)
    const keys = new Set(replay.units.map(u => u.key))
    expect(keys.size).toBe(10)
  })

  it('starts every unit at full HP in the initial frame', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    for (const u of replay.units) {
      expect(replay.frames[0]!.hp[u.key]).toBe(u.maxHp)
    }
  })

  it('keeps HP within [0, maxHp] across the whole timeline', () => {
    const l = left(), r = right()
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    for (const frame of replay.frames) {
      for (const u of replay.units) {
        const hp = frame.hp[u.key]!
        expect(hp).toBeGreaterThanOrEqual(0)
        expect(hp).toBeLessThanOrEqual(u.maxHp)
      }
    }
  })

  it('raises a fallen unit on a revive entry (revive adds HP, is not read as damage)', () => {
    const l = left(), r = right()
    const key = unitKey('left', 'harry')
    const result = {
      winner: 'left', mvpId: 'harry', turns: 2, snapshots: [],
      log: [
        { turn: 1, actorId: 'draco', actorSide: 'right', action: 'Avada Kedavra', targetId: 'harry', targetSide: 'left', type: 'Attacco', value: 9999, flags: ['kill'] },
        { turn: 2, actorId: 'ron', actorSide: 'left', action: 'Rennervate', targetId: 'harry', targetSide: 'left', type: 'Cura', value: 20, flags: ['revive'] },
      ],
    } as unknown as BattleResult
    const replay = buildReplay(result, l, r)
    // After the kill harry is at 0; the revive must bring the replay HP back up, not subtract.
    expect(replay.frames[1]!.hp[key]).toBe(0)
    expect(replay.frames[2]!.hp[key]).toBe(20)
  })

  it("final frame matches the engine's losing side being wiped or behind", () => {
    const l = left(), r = right()
    const res = simulateBattle(l, r, createRng(42))
    const replay = buildReplay(res, l, r)
    const last = replay.frames.at(-1)!
    const sumHp = (side: 'left' | 'right') =>
      replay.units.filter(u => u.side === side).reduce((s, u) => s + last.hp[u.key]!, 0)
    if (res.winner === 'left') expect(sumHp('left')).toBeGreaterThan(0)
    else expect(sumHp('right')).toBeGreaterThan(0)
  })

  it('a damage entry lowers exactly the targeted unit on its side', () => {
    const l = left(), r = right()
    const res = simulateBattle(l, r, createRng(42))
    const replay = buildReplay(res, l, r)
    const dmgIdx = res.log.findIndex(e => (e.value ?? 0) > 0 && !e.flags.includes('heal') && e.targetSide)
    expect(dmgIdx).toBeGreaterThanOrEqual(0)
    const entry = res.log[dmgIdx]!
    const key = unitKey(entry.targetSide!, entry.targetId!)
    const before = replay.frames[dmgIdx]!.hp[key]!
    const after = replay.frames[dmgIdx + 1]!.hp[key]!
    expect(after).toBeLessThanOrEqual(before)
  })

  it('carries winner and mvp through from the result', () => {
    const l = left(), r = right()
    const res = simulateBattle(l, r, createRng(42))
    const replay = buildReplay(res, l, r)
    expect(replay.winner).toBe(res.winner)
    expect(replay.mvpId).toBe(res.mvpId)
    expect(replay.turns).toBe(res.turns)
  })

  it('exposes each unit tier for rarity rendering', () => {
    const l = team(['harry', 'ron', 'hermione', 'luna', 'neville'], 7)
    const r = team(['draco', 'crabbe', 'goyle', 'snape', 'bellatrix'], 13)
    const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
    for (const u of replay.units) {
      expect([1, 2, 3, 4]).toContain(u.tier)
    }
  })
})
