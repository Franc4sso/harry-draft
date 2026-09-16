// tests/battle/StatusPips.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusPips } from '@/components/battle/StatusPips'
import { STATUS_DEFS } from '@/data/statuses'
import type { ActiveEffect } from '@/types'

const fx = (kind: string, extra: Record<string, unknown> = {}) =>
  ({ kind, statusId: kind, remaining: 2, stacks: 1, ...extra } as unknown as ActiveEffect)

describe('StatusPips', () => {
  it('senza stati non mostra nulla', () => {
    const { container } = render(<StatusPips effects={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('una pillola per ogni stato attivo', () => {
    render(<StatusPips effects={[fx('veleno'), fx('stun'), fx('shield')]} />)
    expect(screen.getAllByTestId('status-pip')).toHaveLength(3)
  })

  it('il veleno mostra le DOSI, non i turni rimanenti', () => {
    // Il veleno è permanente: `remaining` resta fermo a 2, il numero che cresce
    // è `stacks`. Mostrare `remaining` è un difetto storico del progetto.
    render(<StatusPips effects={[fx('veleno', { remaining: 2, stacks: 4 })]} />)
    expect(screen.getByTestId('status-pip')).toHaveTextContent('4')
  })

  it('ogni pillola ha un titolo che spiega lo stato', () => {
    render(<StatusPips effects={[fx('freeze')]} />)
    expect(screen.getByTestId('status-pip')).toHaveAttribute('title', expect.stringMatching(/congel/i))
  })

  it('stati diversi hanno colori diversi', () => {
    render(<StatusPips effects={[fx('veleno'), fx('stun')]} />)
    const [a, b] = screen.getAllByTestId('status-pip')
    expect(a!.getAttribute('data-kind')).not.toBe(b!.getAttribute('data-kind'))
  })

  it('OGNI stato del catalogo ha un glifo suo — nessuno cade sul puntino', () => {
    // Il catalogo ha 24 id, non i dieci `kind`: tre gradi di lentezza, tre di
    // indebolimento, due di vulnerabilità. Letto da `STATUS_DEFS` invece che da
    // una lista scritta a mano, così aggiungere uno stato senza dargli una
    // pillola rende questo test rosso.
    const senzaGlifo = STATUS_DEFS.filter(d => {
      render(<StatusPips effects={[fx(d.id)]} />)
      const pip = screen.getAllByTestId('status-pip').at(-1)!
      return pip.textContent?.startsWith('•')
    }).map(d => d.id)
    expect(senzaGlifo, `stati senza glifo: ${senzaGlifo.join(', ')}`).toEqual([])
  })

  it('nessun glifo è condiviso fra famiglie DIVERSE', () => {
    // "Famiglia" qui è più fine del `family` di StatusDef (che ha solo 6
    // valori e fonderebbe scudo/rigenera o disarmo/silenzio/stordimento):
    // ogni riga è un'idea a sé — stordito, gelo, silenziato, disarmato,
    // veleno, bruciatura, scudo, cura, "qualcosa sale" (buff), "qualcosa
    // scende" (lentezza/indebolimento), vulnerabilità. Gli id nella STESSA
    // riga sono gradi della stessa idea e DEVONO condividere il glifo (tre
    // gradi di lentezza non sono tre icone da imparare); righe diverse non
    // devono MAI condividerlo — prima del fix, stun/raccolto condividevano
    // '✦' e slow/weaken/expose condividevano '▼'.
    const FAMILIES: string[][] = [
      ['stun'],
      ['freeze'],
      ['silence'],
      ['disarm'],
      ['veleno'],
      ['burn'],
      ['shield', 'protego'],
      ['regen'],
      ['atkUp', 'atkUp1', 'defUp', 'spdUp', 'raccolto'],
      ['slow', 'slow1', 'slow2', 'slow3', 'weaken1', 'weaken2', 'weaken3'],
      ['expose1', 'expose2', 'expose3'],
    ]
    // Ogni id del catalogo deve comparire in esattamente una famiglia qui —
    // altrimenti il test non starebbe davvero testando la copertura reale.
    const allIds = STATUS_DEFS.map(d => d.id).sort()
    const coveredIds = FAMILIES.flat().sort()
    expect(coveredIds).toEqual(allIds)

    const glyphOf = (id: string) => {
      render(<StatusPips effects={[fx(id)]} />)
      return screen.getAllByTestId('status-pip').at(-1)!.textContent!.replace(/\d+$/, '')
    }

    const glyphByFamilyIndex = FAMILIES.map(fam => new Set(fam.map(glyphOf)))
    // Dentro una famiglia, un solo glifo: i suoi membri sono gradi della
    // stessa idea.
    glyphByFamilyIndex.forEach((glyphs, i) => {
      expect(glyphs.size, `la famiglia ${FAMILIES[i]!.join('/')} ha glifi diversi al suo interno`).toBe(1)
    })

    const seen = new Map<string, number>()
    glyphByFamilyIndex.forEach((glyphs, i) => {
      const glyph = [...glyphs][0]!
      const clashIndex = seen.get(glyph)
      expect(
        clashIndex,
        `glifo '${glyph}' condiviso fra ${FAMILIES[i]!.join('/')} e ${clashIndex !== undefined ? FAMILIES[clashIndex]!.join('/') : ''}`,
      ).toBeUndefined()
      seen.set(glyph, i)
    })
  })
})
