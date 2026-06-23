import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PortraitImage } from '@/components/ui/PortraitImage'

describe('PortraitImage', () => {
  it('renders the portrait by id', () => {
    render(<PortraitImage id="harry" house="Grifondoro" alt="Harry" />)
    const img = screen.getByAltText('Harry') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/portraits/harry.webp')
  })
  it('falls back to a house silhouette when the image errors', () => {
    const { container } = render(<PortraitImage id="missing" house="Serpeverde" alt="Ignoto" />)
    fireEvent.error(screen.getByAltText('Ignoto'))
    expect(container.querySelector('[data-fallback="Serpeverde"]')).toBeTruthy()
  })
  it('fallback div carries data-variant', () => {
    const { container } = render(<PortraitImage id="missing" house="Grifondoro" alt="X" variant="bust" />)
    fireEvent.error(screen.getByAltText('X'))
    const fallback = container.querySelector('[data-fallback]') as HTMLElement
    expect(fallback.getAttribute('data-variant')).toBe('bust')
  })
})
