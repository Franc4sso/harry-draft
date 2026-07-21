import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { RecruitScreen } from '@/components/screens/RecruitScreen'

// NOTE: unlike the brief's literal snippet, this fixture sets `stats` (powerOf needs real
// numbers — `{}` makes the weakest-of-team sort a NaN no-op) and `spell` (WizardCardColumn /
// WizardCardRow read spell.effects / spell.type and throw on undefined). Uses RTL's
// `fireEvent.click` (auto-wraps in act) instead of a raw `dispatchEvent`, otherwise the
// assertion below observes the DOM one render behind the click-triggered state update.
const mage = (id: string, role: string, tags: string[] = []) =>
  ({
    wizard: { id, name: id, house: 'Grifondoro', role, tags },
    level: 1,
    stats: { hp: 100, atk: 10, def: 10, spd: 10 },
    maxHp: 100,
    spell: { id: 's', name: 'S', cooldown: 0, type: 'Attacco' },
  }) as any

describe('RecruitScreen — warning di perdita a squadra piena', () => {
  it('considerando un candidato che rimpiazza un mago-chiave, il tracker segnala il Duo che si spegne', () => {
    // Squadra piena (teamMax 2 per il test) con Cancrena attivo. Il candidato inerte rimpiazza
    // il mago più debole (weakestId di default) → deve apparire data-breaks su cancrena quando
    // il candidato è considerato. Simuliamo il "consider" impostando pick (focus = pickedWizard).
    const team = [mage('a', 'Attaccante', ['veleno', 'esecuzione']), mage('b', 'Tank', ['veleno', 'esecuzione'])]
    const offer = [mage('c', 'Controllo')]
    const { container, getByTestId } = render(
      <RecruitScreen offer={offer} team={team} teamMax={2} relics={[]} onPick={() => {}} />,
    )
    // Considera il candidato (focus): click sulla card lo seleziona → focus = pickedWizard.
    fireEvent.click(getByTestId('recruit-c'))
    const row = container.querySelector('[data-duo="cancrena"]')
    expect(row).not.toBeNull()
    expect(row).toHaveAttribute('data-breaks')
  })
})
