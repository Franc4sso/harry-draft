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

describe('il nastro non si sfalsa col passare dei turni', () => {
  it('lo slot del fuoco e la traslazione vengono dalla STESSA lista', () => {
    // BUG dell'utente: «all'inizio funziona bene la timeline, ma dopo si bugga,
    // lasciando tutte le magie a destra». Riprodotto e MISURATO in browser: fino
    // al turno 16 lo scarto fra slot-di-fuoco e pannello è 0-1px; dal turno 17
    // diventa 97, poi 193, poi 289 — e gli slot passano da 6 a 14.
    //
    // Causa: `nowOffset` era calcolato a parte (`focusPos - startPos`) mentre la
    // lista veniva da un `useMemo`. Quando le due sorgenti divergono, la riga ha
    // N slot davanti al fuoco ma viene traslata come se ne avesse `nowOffset`:
    // misurato 4 slot davanti contro una traslazione da 2, cioè 2*96 = 192px di
    // sfalsamento — esattamente il `drift: 193` osservato.
    //
    // La posizione del fuoco DEVE essere letta dalla lista che si rende davvero.
    expect(src).toMatch(/nowOffset:\s*past\.length/)
  })

  it('la chiave di ogni slot include la posizione, o il DOM accumula', () => {
    // LA CAUSA VERA, trovata instrumentando il componente nel browser invece che
    // deducendola: `sequence.length` restava 6 e `nowOffset` 2 — entrambi giusti —
    // ma il DOM cresceva a 7, 8, 9, 11, 13, 14 figli dal click 18. La chiave era
    // `${slot.turn}-${slot.key}`, che si RIPETE quando la stessa unità agisce due
    // volte nello stesso turno: React trattava i duplicati come nodi nuovi e non
    // rimuoveva i vecchi. Gli slot in eccesso spingevano lo slot di fuoco a destra
    // (posizione 2 -> 5) mentre `translateX` restava correttamente a -382px: i
    // 192px di sfalsamento, e le magie tutte a destra.
    expect(src).toMatch(/key=\{`\$\{i\}-/)
  })
})

describe('i futuri hanno lo stesso stile del focus', () => {
  it('il sigillo futuro porta la cornice e lo sfondo del riquadro di fuoco', () => {
    // Richiesta dell'utente: «vorrei che le magie che devono ancora arrivare,
    // abbiano lo stesso stile delle magie che sono al momento in focus».
    // I futuri erano ottagoni scuri con un anello smorzato (`${meta.color}55`);
    // ora prendono la ghiera dorata e il fondo del pannello di fuoco, in scala.
    // Cercare "rgba(184,150,63" e basta NON basta: quel colore esiste già nel
    // riquadro di fuoco più in basso nel file, quindi il test passava senza che
    // i futuri fossero cambiati. Si guarda la costante condivisa, che esiste solo
    // se lo stile è stato davvero estratto e riusato.
    expect(src).toMatch(/const FUTURO_STILE|FOCUS_RING/)
  })

  it('i passati restano distinti dai futuri', () => {
    // Lo stile condiviso vale per i FUTURI: se anche i passati lo prendessero,
    // la sequenza perderebbe la direzione del tempo.
    expect(src).toMatch(/isPast/)
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
