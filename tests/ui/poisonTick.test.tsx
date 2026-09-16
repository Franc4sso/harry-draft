import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { floatFor } from '@/components/battle/damageFloat'
import { BattleArena } from '@/components/battle/BattleArena'
import { buildReplay, unitKey } from '@/game/engine/combat/replay'
import { simulateBattle } from '@/game/engine/combat/simulate'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import type { DraftedWizard, LogEntry } from '@/types'

it('un tick veleno ha tono dot (non damage)', () => {
  const f = floatFor({ turn: 1, action: 'Veleno', type: 'Controllo', value: 9, flags: ['dot'], actorId: 'a', targetId: 'b' } as any)
  expect(f).toEqual({ text: '-9', tone: 'dot' })
})

it('un colpo normale resta tono damage', () => {
  const f = floatFor({ turn: 1, action: 'Colpo', type: 'Attacco', value: 12, flags: [], actorId: 'a', targetId: 'b' } as any)
  expect(f?.tone).toBe('damage')
})

// UnitBust's colored flash overlay ([data-impact]) is gone (Task 11 — UnitBust deleted).
// The dot/damage color distinction survived on the floating number (BattleArena's
// [data-testid=damage-float], text-green-300 for dot vs text-rose-300 for damage) through
// Task 3 ("il palco").
//
// 2026-09-16 (Task 5, "la scena, composta"): the two-Duellante stage (Task 3) was rejected
// by the user on screen — "fa totalmente schifo" — and replaced with ten equal-size
// CartaCombat cards; `damageFloat`/`floatFor` are gone from BattleArena entirely (see its
// diff). The struck number now lives exclusively on `ColpoSullaCarta`, which reads its
// content from `lib/battleScene.ts`'s `SceneKind` (a DIFFERENT classifier from `floatFor`'s
// own tone map, which this file's other two tests below still cover directly, unchanged —
// `floatFor` itself is untouched by Task 5).
//
// Verified directly against `lib/battleScene.ts`/`ColpoSullaCarta.tsx` rather than assumed:
// `action:'Veleno'` isn't in `sceneEventOf`'s `BY_ACTION` map, so a bare veleno tick
// (`flags:['dot']`, no action-specific entry) falls through to `BY_FLAG`'s `['dot','dot',
// undefined]` — `SceneKind:'dot'`, `word: undefined`. `ColpoSullaCarta`'s `contentFor`
// has no case for `'dot'`, so it hits the `default` branch: `{number: null, word: null}`
// (word stays null because `event.word` is undefined) — and `ColpoSullaCarta` itself
// returns null on `!number && !word`. So a BARE poison tick renders NO colpo at all today:
// a real, observable narrowing versus pre-Task-5 (which drew a green "-9" for it). Recorded
// here instead of papered over with an assertion that would pass for the wrong reason.
//
// What this test guards instead — the part of the original intent that's still live and
// real: `game/engine/status.ts`'s actual poison-tick system action is named 'Fatica' (see
// `lib/battleScene.ts`'s own comment on Rigenerazione/Fatica), which IS in `BY_ACTION`
// (`kind:'fatigue', word:'SFINIMENTO'`) — so a REAL in-engine DoT tick does produce a colpo,
// with a word. This test exercises that actual path instead of a synthetic 'Veleno'/'dot'
// entry that never reaches the engine's own action naming.
function team(ids: string[], seed = 1): DraftedWizard[] {
  const r = createRng(seed)
  return ids.map(id => draftWizard(r, WIZARD_BY_ID[id]!))
}

describe('BattleArena: il tick di stato produce un colpo reale sulla carta colpita', () => {
  it('un tick di Fatica (DoT reale del motore) produce un colpo con la parola SFINIMENTO, non un float separato', () => {
    // jsdom's getBoundingClientRect is always zero — BattleArena's struckBox measurement
    // bails to null on a zero-width stage (see tests/ui/battle.test.tsx's stubNonZeroRects
    // comment for the full explanation), so `colpo` needs a non-zero stub to render at all
    // under jsdom. Not a component bug — a jsdom layout limitation.
    const orig = Element.prototype.getBoundingClientRect
    const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const isStage = this.getAttribute('data-testid') === 'stage'
      const r = isStage ? { top: 0, left: 0, width: 1366, height: 768 } : { top: 46, left: 250, width: 212, height: 254 }
      return { ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON() { return this } } as DOMRect
    })
    try {
      const l = team(['harry', 'ron', 'hermione', 'luna', 'neville'], 7)
      const r = team(['draco', 'crabbe', 'goyle', 'snape', 'bellatrix'], 13)
      const replay = buildReplay(simulateBattle(l, r, createRng(42)), l, r)
      const e: LogEntry = {
        turn: 1, actorId: 'harry', actorSide: 'left', action: 'Fatica',
        targetId: 'draco', targetSide: 'right', type: 'system', value: 9, flags: ['dot'],
      }
      // sceneEventOf (and so ColpoSullaCarta's content) reads from replay.frames[frameKey]
      // .entry, NOT the `entry` prop — the prop only drives Callout/acting-key logic. The
      // frame's own entry must carry the synthetic Fatica tick for `colpo` to show SFINIMENTO
      // instead of whatever the real simulated frame 1 happened to be (armor-pierced here).
      replay.frames[1]!.entry = e
      render(<BattleArena replay={replay} hp={replay.frames[1]!.hp} entry={e} frameKey={1} />)
      const targetKey = unitKey('right', 'draco')
      const targetCard = document.querySelector(`[data-testid="carta-combat"][data-unit-key="${CSS.escape(targetKey)}"]`)
      expect(targetCard).not.toBeNull()
      expect(screen.getByTestId('colpo')).toHaveTextContent(/sfinimento/i)
      // The legacy per-card float ([data-testid=damage-float]) no longer exists anywhere.
      expect(document.querySelectorAll('[data-testid="damage-float"]')).toHaveLength(0)
    } finally {
      spy.mockRestore()
      expect(Element.prototype.getBoundingClientRect).toBe(orig)
    }
  })
})
