import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { UnitBust } from '@/components/battle/UnitBust'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import type { ActiveEffect } from '@/types'

const unit = {
  key: 'left:x', id: 'x', name: 'X', side: 'left', house: 'Grifondoro', role: 'Tank', tier: 3,
  maxHp: 100, atk: 10, def: 10, spd: 10, baseAtk: 10, baseDef: 10, baseSpd: 10,
  spell: { id: 's', name: 'S', cooldown: 0 },
} as unknown as ReplayUnit

function bustWith(effectKind: string) {
  const eff = { kind: effectKind, statusId: effectKind, remaining: 2 } as unknown as ActiveEffect
  return <UnitBust unit={unit} hp={100} effects={[eff]} />
}

describe('UnitBust — stati di controllo leggibili', () => {
  it('congelato: ghiaccia il ritratto, mostra glyph + fascia, NON copre il volto', () => {
    const { container } = render(bustWith('freeze'))
    expect(container.querySelector('[data-control-glyph="freeze"]')).not.toBeNull()
    expect(container.querySelector('[data-control-strip]')).toHaveTextContent(/congelato/i)
    expect(container.querySelector('[data-frost]')).not.toBeNull()
    // il vecchio pannello a tutta carta NON esiste più
    expect(container.querySelector('[data-control]')).toBeNull()
    // il ritratto (img) è presente e non coperto da un overlay grid a tutta carta
    expect(container.querySelector('img')).not.toBeNull()
  })
  it('stordito: glyph giallo + fascia, senza pannello', () => {
    const { container } = render(bustWith('stun'))
    expect(container.querySelector('[data-control-glyph="stun"]')).not.toBeNull()
    expect(container.querySelector('[data-control-strip]')).toHaveTextContent(/stordito/i)
    expect(container.querySelector('[data-control]')).toBeNull()
  })
  it('silenziato/disarmato: glyph + fascia, NESSUN frost (non ghiacciano)', () => {
    const { container } = render(bustWith('silence'))
    expect(container.querySelector('[data-control-glyph="silence"]')).not.toBeNull()
    expect(container.querySelector('[data-frost]')).toBeNull()
  })
})
