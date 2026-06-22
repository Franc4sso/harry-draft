import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

function Hello() {
  return <h1>Ciao Hogwarts</h1>
}

describe('ui smoke', () => {
  it('renders a component', () => {
    render(<Hello />)
    expect(screen.getByText('Ciao Hogwarts')).toBeInTheDocument()
  })
})
