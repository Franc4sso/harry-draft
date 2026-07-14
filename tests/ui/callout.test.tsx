import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { calloutFor, Callout } from '@/components/battle/Callout'
import type { LogEntry } from '@/types'

function entry(flags: LogEntry['flags']): LogEntry {
  return {
    turn: 1, actorId: 'harry', actorSide: 'left', action: 'X',
    targetId: 'draco', targetSide: 'right', type: 'Attacco', value: 10, flags,
  }
}

describe('calloutFor', () => {
  it('maps crit+kill to ESECUZIONE', () => {
    expect(calloutFor(entry(['crit', 'kill']))?.text).toBe('ESECUZIONE')
  })
  it('maps crit alone to CRITICO', () => {
    expect(calloutFor(entry(['crit']))?.text).toBe('CRITICO')
  })
  it('maps block to PARATO', () => {
    expect(calloutFor(entry(['block']))?.text).toBe('PARATO')
  })
  it('maps dodge to SCHIVA', () => {
    expect(calloutFor(entry(['dodge']))?.text).toBe('SCHIVA')
  })
  it('maps heal to CURA', () => {
    expect(calloutFor(entry(['heal']))?.text).toBe('CURA')
  })
  it('maps dot (without other notable flags) to VELENO', () => {
    expect(calloutFor(entry(['dot']))?.text).toBe('VELENO')
  })
  it('returns null for a plain hit with no notable flags', () => {
    expect(calloutFor(entry([]))).toBeNull()
  })
  it('returns null for a null entry', () => {
    expect(calloutFor(null)).toBeNull()
  })
  it('announces a freshly-applied control (silence/disarm carry no flag)', () => {
    expect(calloutFor(entry([]), 'silence')?.text).toBe('SILENZIATO')
    expect(calloutFor(entry([]), 'disarm')?.text).toBe('DISARMATO')
    expect(calloutFor(entry([]), 'stun')?.text).toBe('STORDITO')
  })
  it('a killing blow takes priority over an applied control', () => {
    expect(calloutFor(entry(['crit', 'kill']), 'silence')?.text).toBe('ESECUZIONE')
  })
})

describe('Callout', () => {
  it('renders the mapped word for a notable frame', () => {
    render(<Callout entry={entry(['crit'])} frameKey={1} />)
    expect(screen.getByTestId('battle-callout')).toHaveTextContent('CRITICO')
  })
  it('renders nothing for a non-notable frame', () => {
    const { container } = render(<Callout entry={entry([])} frameKey={1} />)
    expect(container.querySelector('[data-testid="battle-callout"]')).toBeNull()
  })
  it('ignores the initial frameKey 0 (no entry has fired yet)', () => {
    const { container } = render(<Callout entry={entry(['crit'])} frameKey={0} />)
    expect(container.querySelector('[data-testid="battle-callout"]')).toBeNull()
  })
})
