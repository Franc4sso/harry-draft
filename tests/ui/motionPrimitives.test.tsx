import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Stagger, StaggerItem, Reveal, TiltCard, screenVariants, EASE_CINEMATIC } from '@/components/ui/motion'

describe('motion primitives', () => {
  it('Stagger/StaggerItem render children', () => {
    render(
      <Stagger>
        <StaggerItem>alpha</StaggerItem>
        <StaggerItem>beta</StaggerItem>
      </Stagger>,
    )
    expect(screen.getByText('alpha')).toBeTruthy()
    expect(screen.getByText('beta')).toBeTruthy()
  })

  it('Reveal renders children', () => {
    render(<Reveal>gamma</Reveal>)
    expect(screen.getByText('gamma')).toBeTruthy()
  })

  it('TiltCard renders children', () => {
    render(<TiltCard>delta</TiltCard>)
    expect(screen.getByText('delta')).toBeTruthy()
  })

  it('exports screen transition tokens', () => {
    expect(screenVariants.initial).toBeTruthy()
    expect(screenVariants.animate).toBeTruthy()
    expect(screenVariants.exit).toBeTruthy()
    expect(EASE_CINEMATIC).toHaveLength(4)
  })
})
