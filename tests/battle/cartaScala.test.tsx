import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 2026-09-16 — La carta scala con la cornice.
 *
 * L'utente ha mandato uno screenshot del gioco vero: le carte della fila alleata
 * erano TAGLIATE in basso (nome e barra vita fuori). Misurato a 1366/1920/2560:
 * la fila alleata sfora di 36px a OGNI risoluzione, sempre gli stessi.
 *
 * Causa: la cornice (`[data-testid="stage"]`) è in proporzione (aspect-ratio
 * 1366/768, larghezza fluida sotto `max-w-6xl` = 1152px, quindi ALTA 648px), ma
 * la carta era `width:212px; height:254px` FISSI — misure disegnate per una
 * cornice alta 768. Due carte da 254 più il nastro non stanno in 648: 36px
 * escono. Non era un errore di posizionamento, era un disaccordo di unità.
 *
 * Correzione: la carta si misura in percentuale della CORNICE (container query
 * units), quindi 212/1366 = 15.52% della larghezza, e il rapporto 212:254 è
 * tenuto da aspect-ratio. Questo test difende l'unità di misura, che è la cosa
 * che si rompe: un ritorno ai px fissi lo fa arrossire.
 */
const css = readFileSync(resolve(__dirname, '../../components/battle/vetrata.css'), 'utf8')
const cartaBlock = (() => {
  const i = css.indexOf('.carta-combat {')
  return css.slice(i, css.indexOf('}', i))
})()

describe('la carta di battaglia scala con la cornice', () => {
  it('NON ha una larghezza in pixel fissi', () => {
    expect(cartaBlock).not.toMatch(/width:\s*212px/)
  })

  it('NON ha un altezza in pixel fissi', () => {
    // Era `height: 254px`: due file da 254 + il nastro non entrano in una
    // cornice alta 648px, ed è esattamente da qui che nascevano i 36px tagliati.
    expect(cartaBlock).not.toMatch(/height:\s*254px/)
  })

  it('si misura in unità della cornice (cqw), non in px', () => {
    expect(cartaBlock).toMatch(/cqw/)
  })

  it('tiene il rapporto 212:254 del mockup', () => {
    expect(cartaBlock).toMatch(/aspect-ratio:\s*212\s*\/\s*254/)
  })

  it('la cornice si dichiara container, altrimenti cqw non ha a cosa riferirsi', () => {
    // `cqw` risolve contro il container query PIÙ VICINO: senza questa
    // dichiarazione sullo stage, le unità cadrebbero sul viewport e la carta
    // tornerebbe a non seguire la cornice. La dichiarazione vive nel TSX
    // (`containerType: 'inline-size'` sullo stage), non nel CSS: il test guarda
    // dove sta davvero, non dove me l'aspettavo.
    const arena = readFileSync(resolve(__dirname, '../../components/battle/BattleArena.tsx'), 'utf8')
    const stage = arena.slice(arena.indexOf('data-testid="stage"'))
    expect(stage.slice(0, 400)).toMatch(/containerType:\s*'inline-size'/)
  })
})
