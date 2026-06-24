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

describe('PortraitImage fallback', () => {
  it('renders a house-coloured silhouette (no crest watermark) when the image fails', () => {
    render(<PortraitImage id="nonexistent-xyz" house="Grifondoro" alt="Test Mago" variant="card" />)
    const img = screen.getByAltText('Test Mago') as HTMLImageElement
    fireEvent.error(img)
    const fallback = document.querySelector('[data-fallback="Grifondoro"]')
    expect(fallback).not.toBeNull()
    // The crest watermark was removed — the silhouette stands on its own.
    expect(fallback!.querySelector('[data-testid="fallback-crest"]')).toBeNull()
    expect(fallback!.querySelector('svg')).not.toBeNull()
  })
})
