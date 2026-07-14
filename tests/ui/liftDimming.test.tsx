import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { BattleArena } from '@/components/battle/BattleArena'
import type { Replay } from '@/game/engine/combat/replay'
import type { LogEntry } from '@/types'

/**
 * Durante un lift (kill/crit/primo-scatto-duo) TUTTE le carte originali si oscurano forte
 * (0.15), non solo le non-coinvolte (0.45) — l'overlay dei cloni resta l'unico fuoco.
 * Verifica il wrapper reale dei bust in BattleArena (stesso pattern di duoBattle.test.tsx).
 */
const unit = (key: string, id: string, side: 'left' | 'right') => ({
  key, id, name: id, side, house: 'Grifondoro', role: 'Attaccante', tier: 3,
  maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10,
  spell: { id: 's', name: 'S', cooldown: 0 },
})

const entry = (over: Partial<LogEntry> = {}): LogEntry => ({
  turn: 1, actorId: 'a', actorSide: 'left', action: 'Colpo', targetId: 'z', targetSide: 'right',
  type: 'Attacco', value: 10, flags: [], ...over,
})

const replay = {
  units: [unit('left:a', 'a', 'left'), unit('right:z', 'z', 'right')],
  frames: [{ statusEffects: {}, cooldowns: {}, entry: null }],
} as unknown as Replay
const hp = { 'left:a': 100, 'right:z': 80 }

/** Opacity inline del wrapper (div immediato) attorno a ciascun bust, in ordine DOM. */
function wrapperOpacities(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-testid="battle-unit"]')).map(
    el => (el.parentElement as HTMLElement).style.opacity,
  )
}

describe('dimming forte delle originali durante il lift', () => {
  it('su un frame di kill, ENTRAMBE le carte originali (coinvolta e non) sono oscurate forte (0.15)', () => {
    const killEntry = entry({ flags: ['kill'] })
    const { container } = render(
      <BattleArena replay={replay} hp={hp} entry={killEntry} frameKey={0} />,
    )
    for (const opacity of wrapperOpacities(container)) {
      expect(opacity).toBe('0.15')
    }
  })

  it('su un frame normale (nessun lift), il dimming resta quello standard (1 / 0.45 per i non coinvolti)', () => {
    const normalEntry = entry({ flags: [] })
    const { container } = render(
      <BattleArena replay={replay} hp={hp} entry={normalEntry} frameKey={0} />,
    )
    const opacities = wrapperOpacities(container)
    // actor (left:a) e target (right:z) sono entrambi "involved" con questo replay a 2 unità,
    // quindi restano a piena opacità: nessuna carta scende a 0.45 o 0.15 qui.
    for (const opacity of opacities) {
      expect(opacity).toBe('1')
    }
  })

  it('senza entry (nessuna azione), nessun dimming: opacity piena', () => {
    const { container } = render(
      <BattleArena replay={replay} hp={hp} entry={null} frameKey={0} />,
    )
    for (const opacity of wrapperOpacities(container)) {
      expect(opacity).toBe('1')
    }
  })
})
