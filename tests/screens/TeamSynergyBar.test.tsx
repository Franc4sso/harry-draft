import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { TeamSynergyBar } from '@/components/run/TeamSynergyBar'

const team = [
  { wizard: { id: 'a', name: 'Harry', house: 'Grifondoro' }, level: 3, stats: {}, maxHp: 100, spell: { id: 'x' } },
  { wizard: { id: 'b', name: 'Ron', house: 'Grifondoro' }, level: 1, stats: {}, maxHp: 100, spell: { id: 'y' } },
] as any

// Uses real spell IDs so the row's SPELL_BY_ID lookups resolve to proper
// entries (name, desc), and a real Role so RoleIcon has a valid icon to render.
const memberWithPool = {
  wizard: {
    id: 'harry',
    name: 'Harry',
    house: 'Grifondoro',
    role: 'Attaccante',
    spellPool: ['expelliarmus', 'stupeficium'],
  },
  level: 2,
  stats: {},
  maxHp: 100,
  spell: { id: 'expelliarmus', name: 'Expelliarmus', desc: 'Disarma il bersaglio.', type: 'Attacco', hitChance: 0.95 },
} as any

describe('TeamSynergyBar', () => {
  it('renders each member with name and level', () => {
    render(<TeamSynergyBar team={team} />)
    expect(screen.getByText('Harry')).toBeInTheDocument()
    expect(screen.getByText('Ron')).toBeInTheDocument()
    expect(screen.getByText(/Lv\.?\s*3/i)).toBeInTheDocument()
    expect(screen.getByText(/Lv\.?\s*1/i)).toBeInTheDocument()
  })

  it('defaults missing level to 1', () => {
    const noLevel = [{ wizard: { id: 'c', name: 'Hermione', house: 'Grifondoro' }, stats: {}, maxHp: 100, spell: { id: 'z' } }] as any
    render(<TeamSynergyBar team={noLevel} />)
    expect(screen.getByText('Hermione')).toBeInTheDocument()
    expect(screen.getByText(/Lv\.?\s*1/i)).toBeInTheDocument()
  })

  it('horizontal: renders the roster with no synergy chips', () => {
    render(<TeamSynergyBar team={team} />)
    expect(screen.getByTestId('team-synergy-bar')).toBeInTheDocument()
    expect(screen.getByText('Harry')).toBeInTheDocument()
    // No synergy chip markers (former SynergyChip used a data-synergy attribute).
    expect(document.querySelector('[data-synergy]')).not.toBeInTheDocument()
  })

  it('vertical row: shows the equipped spell with no swap selector (one wizard, one spell)', () => {
    render(<TeamSynergyBar team={[memberWithPool]} orientation="vertical" />)

    // The role now reads as a text label on the compact row.
    expect(screen.getByText('Attaccante')).toBeInTheDocument()

    // The equipped spell is shown directly — no toggle/expand needed.
    expect(screen.getByText('Expelliarmus')).toBeInTheDocument()

    // No spell-swap selector: no pool group, and the alternative pool spell never renders.
    expect(screen.queryByRole('group', { name: /Incantesimi di/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Stupeficium')).not.toBeInTheDocument()
    // Strutturale, non testuale: il vecchio selettore di magie era un bottone-riga nel
    // contenitore del MEMBRO della squadra, nominato col nome del mago (es. "Harry") — un
    // pattern testuale su "incantesim/spell/..." non lo avrebbe mai intercettato. Restringiamo
    // quindi la ricerca alla riga del mago (l'ancora è `[data-house]`, il contenitore di
    // MemberRow), lasciando fuori dallo scope i bottoni "espandi" dei Duo lontani (DuoPanel),
    // che vivono altrove nel DOM e sono legittimi.
    const memberRow = document.querySelector('[data-house]') as HTMLElement
    expect(memberRow).not.toBeNull()
    expect(within(memberRow).queryByRole('button')).not.toBeInTheDocument()
  })

  it('vertical: la squadra resta sempre visibile e il pannello Combo Duo è l\'unico contenuto sotto il roster (niente tab)', () => {
    render(<TeamSynergyBar team={team} orientation="vertical" />)

    expect(screen.getByTestId('team-synergy-bar')).toBeInTheDocument()
    expect(screen.getByText('Harry')).toBeInTheDocument()
    expect(screen.getByText('Ron')).toBeInTheDocument()

    // Il DuoPanel è montato direttamente, senza struttura a tab.
    expect(screen.getByTestId('duo-panel')).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(document.querySelector('[data-testid^="sidebar-tab-"]')).not.toBeInTheDocument()
  })
})
