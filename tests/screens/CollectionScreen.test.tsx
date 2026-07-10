import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CollectionScreen } from '@/components/screens/CollectionScreen'
import { PROFILE_KEY, defaultProfile } from '@/lib/metaStore'

beforeEach(() => localStorage.clear())

describe('CollectionScreen — Duo codex section', () => {
  it('reveals the effect only for a seen Duo; hides it (ingredients still shown) for an unseen one', async () => {
    const profile = defaultProfile()
    profile.codex.duosSeen = ['cancrena']
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))

    render(<CollectionScreen />)

    // Seen: Cancrena — name + revealed effect text.
    expect(await screen.findByText('Cancrena')).toBeInTheDocument()
    expect(screen.getByText(/nemici avvelenati sotto il 40%/)).toBeInTheDocument()

    // Unseen: Miasma — name + ingredient chips shown, effect hidden behind a "???" hint.
    expect(screen.getByText('Miasma')).toBeInTheDocument()
    expect(screen.getAllByText(/scoprila in battaglia/i).length).toBeGreaterThan(0)
  })
})
