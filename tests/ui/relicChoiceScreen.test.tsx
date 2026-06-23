import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RelicChoiceScreen } from '@/components/screens/RelicChoiceScreen'
import { RELICS } from '@/data/relics'

const choices = RELICS.slice(0, 3)

describe('RelicChoiceScreen', () => {
  it('renders the title and all three choices', () => {
    render(<RelicChoiceScreen choices={choices} owned={[]} onChoose={() => {}} />)
    expect(screen.getByText(/scegli una reliquia/i)).toBeInTheDocument()
    for (const c of choices) expect(screen.getByText(c.name)).toBeInTheDocument()
  })
  it('calls onChoose with the clicked relic', async () => {
    const onChoose = vi.fn()
    render(<RelicChoiceScreen choices={choices} owned={[]} onChoose={onChoose} />)
    await userEvent.click(screen.getByText(choices[1]!.name))
    expect(onChoose).toHaveBeenCalledWith(choices[1])
  })
})
