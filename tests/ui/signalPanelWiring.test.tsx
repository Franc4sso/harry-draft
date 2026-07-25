import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { DraftScreen } from '@/components/screens/DraftScreen'
import { RecruitScreen } from '@/components/screens/RecruitScreen'
import { offerRecruits, recruitVia } from '@/game/engine/recruit'
import { createRng } from '@/game/engine/rng'

// Wiring-only: dal 2026-07-25 (piano "Un solo asse", Fase 2) draft e recluta montano UN SOLO
// pannello — il tracker unico — al posto della coppia DuoTracker + ArchetypeTracker. Qui si
// verifica solo che sia montato e che il secondo pannello NON esista più; la sua logica
// (gradi, anteprima 2→3, perdite) è testata in tests/ui/duoTracker.test.tsx.
describe('pannello unico segnali+combo — wiring', () => {
  it('DraftScreen monta il tracker unico e nessun pannello Costellazioni separato', () => {
    const { container } = render(<DraftScreen seed="arch-wire-1" onComplete={() => {}} />)
    expect(container.querySelector('[data-testid="draft-duo-tracker"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="draft-archetype-tracker"]')).toBeNull()
  })

  it('RecruitScreen monta il tracker unico, col registro dei segnali della squadra', () => {
    const team = offerRecruits(createRng(1), { exclude: new Set() })
      .slice(0, 2)
      .map(d => recruitVia(d, 'iniziale', 1))
    const offer = offerRecruits(createRng(2), { exclude: new Set(team.map(t => t.wizard.id)) })
    const onPick = vi.fn()
    const { container } = render(
      <RecruitScreen offer={offer} team={team} teamMax={5} onPick={onPick} relics={[]} />,
    )
    expect(container.querySelector('[data-testid="draft-duo-tracker"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="draft-archetype-tracker"]')).toBeNull()
    // Una squadra vera tocca sempre almeno un segnale (ogni mago ha un ruolo).
    expect(container.querySelector('[data-testid="signal-ledger"]')).not.toBeNull()
  })
})
