import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 2026-09-16 — Il nastro: allineato e che SCORRE.
 *
 * Screenshot dell'utente sul gioco vero: «la timeline centrale non è allineata e
 * non scorre, vorrei proprio vedere come scorre».
 *
 * (1) ALLINEAMENTO. Misurato dal vivo: i sigilli avevano il centro a y=370 e il
 *     riquadro di fuoco a y=424 — 54px di scarto, che è quello che si vede nello
 *     screenshot (ottagoni in alto, pannello più in basso). Causa: binario e
 *     riquadro sono ancorati a `top-1/2` del contenitore, ma la riga dei nodi
 *     stava in cima e ogni nodo è alto (ottagono + nome + incantesimo), quindi il
 *     suo centro cadeva sopra la metà. La riga va centrata sulla stessa linea.
 *
 * (2) SCORRIMENTO. I nodi erano due gruppi flex ai lati di uno spaziatore: a ogni
 *     turno la lista si ricomponeva di colpo, senza traslazione. Perché si VEDA
 *     scorrere serve una trasformazione animata sull'asse X.
 *
 * jsdom non fa layout, quindi questi test leggono la struttura del sorgente —
 * la misura vera dell'allineamento è stata presa in browser (vedi sopra) e non
 * è sostituibile da qui.
 */
const src = readFileSync(resolve(__dirname, '../../components/battle/NastroSigilli.tsx'), 'utf8')

describe('il nastro è allineato al suo binario', () => {
  it('la riga dei sigilli è centrata verticalmente come il binario e il riquadro', () => {
    // Il binario è `top-1/2 -translate-y-1/2`; la riga dei nodi deve stare sulla
    // STESSA linea, non in cima al contenitore.
    // Il wrapper centrato AVVOLGE la riga, quindi `top-1/2` viene PRIMA di
    // `nastro-riga` nel sorgente — non dopo (il primo tentativo cercava
    // nell'ordine sbagliato e falliva su codice corretto).
    expect(src).toMatch(/top-1\/2[\s\S]{0,160}-translate-y-1\/2[\s\S]{0,400}nastro-riga/)
  })
})

describe('i sigilli stanno dentro la cornice e non sotto il riquadro', () => {
  it('la finestra dei futuri non è più larga di quanto il nastro possa mostrare', () => {
    // Misurato a 1600x900 con la finestra da 7 futuri: 5 sigilli su 15 finivano
    // FUORI dalla cornice (tagliati al bordo) e altri 4 sparivano SOTTO il
    // riquadro di fuoco — 9 su 15 invisibili. I lati liberi sono ~560px per
    // parte e il riquadro ne occupa 380 al centro, quindi la finestra va stretta
    // a quanto ci sta davvero.
    expect(src).toMatch(/const FUTURE_COUNT = [1-4]\b/)
  })

  it('gli slot scavalcano il riquadro di fuoco invece di finirci sotto', () => {
    // Il riquadro sta al centro: gli slot adiacenti al turno corrente devono
    // essere spinti oltre la sua larghezza, non disegnati sotto di esso.
    expect(src).toMatch(/FOCUS_W/)
  })
})

describe('il nastro scorre', () => {
  it('trasla sull asse X invece di ricomporsi di colpo', () => {
    expect(src).toMatch(/translateX/)
  })

  it('la traslazione è animata, non istantanea', () => {
    expect(src).toMatch(/nastro-riga[\s\S]{0,900}transition/)
  })

  it('rispetta prefers-reduced-motion', () => {
    // `reduce` è già letto dal componente: lo scorrimento deve spegnersi con
    // esso, come ogni altro movimento di questa schermata.
    expect(src).toMatch(/reduce\s*\?\s*undefined\s*:\s*['"`][^'"`]*transform/)
  })
})
