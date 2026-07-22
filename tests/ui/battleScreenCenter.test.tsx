import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { BattleArena } from '@/components/battle/BattleArena'
import { CenterMeter } from '@/components/battle/CenterMeter'
import type { Replay } from '@/game/engine/combat/replay'
import { unitKey } from '@/game/engine/combat/replay'

// Replay minimale a 1 frame, 1v1, per verificare che il meter renda dentro lo slot center.
const replay: Replay = {
  units: [
    { key: unitKey('left', 'p'), side: 'left', id: 'p', name: 'p', house: 'Grifondoro', role: 'Attaccante', tier: 3, maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10, spell: { id: 's', name: 's', cooldown: 0 } },
    { key: unitKey('right', 'e'), side: 'right', id: 'e', name: 'e', house: 'Serpeverde', role: 'Attaccante', tier: 3, maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10, spell: { id: 's', name: 's', cooldown: 0 } },
  ] as any,
  frames: [{ index: 0, entry: null, hp: { 'left:p': 100, 'right:e': 100 }, cooldowns: {}, statusEffects: {} }],
  winner: 'left', mvpId: 'p', turns: 1,
}

describe('BattleArena center slot', () => {
  it('rende il CenterMeter passato come center', () => {
    const frame = replay.frames[0]!
    const { getByTestId } = render(
      <BattleArena
        replay={replay}
        hp={frame.hp}
        entry={null}
        frameKey={0}
        center={<CenterMeter frame={frame} units={replay.units} playerSide="left" />}
      />,
    )
    expect(getByTestId('center-meter')).toBeInTheDocument()
  })
})
