import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 2026-09-16 — I tooltip non devono uscire dai bordi.
 *
 * Rilievo dell'utente: «controlla bene tutti i tooltip e come si vedono a
 * display, alcuni si vedono male, escono dai box o vengono visti tagliati».
 *
 * Causa strutturale trovata leggendo `components/ui/Tooltip.tsx`: il popover è
 * SEMPRE `absolute bottom-full left-0` con larghezza fissa `w-44` — nessun
 * rilevamento dei bordi. Su un trigger vicino al lato destro il popover esce a
 * destra; su uno in cima alla finestra esce sopra; dentro un contenitore con
 * `overflow-hidden` viene tagliato. Sono tre modi diversi di rompersi, tutti
 * dallo stesso difetto: la posizione è decisa a priori, non misurata.
 *
 * jsdom non fa layout, quindi la prova per-pixel si è fatta in browser (vedi il
 * commit). Qui si difende il MECCANISMO: che la posizione venga misurata e che
 * il popover non sia più inchiodato a un solo angolo.
 */
const src = readFileSync(resolve(__dirname, '../../components/ui/Tooltip.tsx'), 'utf8')

describe('Tooltip — la posizione è misurata, non decisa a priori', () => {
  it('non è più inchiodato a bottom-full/left-0', () => {
    // Si guarda il className del popover, non tutto il file: il commento che
    // spiega la correzione CITA la vecchia stringa, e cercarla ovunque faceva
    // fallire il test su codice corretto.
    const cls = src.match(/role="tooltip"[\s\S]{0,900}?className="([^"]+)"/)?.[1] ?? ''
    expect(cls).not.toMatch(/bottom-full/)
    expect(cls).not.toMatch(/\babsolute\b/)
  })

  it('misura il trigger per decidere da che parte aprirsi', () => {
    expect(src).toMatch(/getBoundingClientRect/)
  })

  it('sceglie sopra o sotto in base allo spazio disponibile', () => {
    expect(src).toMatch(/innerHeight|spaceBelow|sopra|sotto/i)
  })

  it('sceglie anche il lato orizzontale, o si allinea al bordo', () => {
    expect(src).toMatch(/innerWidth/)
  })

  it('è montato in un portale, fuori da ogni antenato filtrato', () => {
    // LA CAUSA FINALE, trovata instrumentando invece che ipotizzando: il calcolo
    // diceva `top: 348` ma il DOM misurava `-356`. Il componente posizionava
    // BENE; un antenato lo spostava dopo. Cercando gli antenati con transform/
    // filter/perspective è saltato fuori `filter: blur(0px)` — anche a ZERO, un
    // filter crea un containing block e `position: fixed` si ancora a quello
    // invece che al viewport. Viene da un'animazione di transizione fra schermate,
    // e spiega perché il difetto era "a volte": dipende da quale schermata sei.
    // Un portale su <body> è l'unica difesa che non dipende dagli antenati.
    expect(src).toMatch(/createPortal/)
  })

  it('esce dal flusso del genitore, così un overflow-hidden non lo taglia', () => {
    // È il terzo modo di rompersi: dentro una card con `overflow-hidden` anche un
    // popover posizionato bene viene ritagliato dal contenitore.
    expect(src).toMatch(/position:\s*'fixed'|fixed/)
  })
})

describe('RelicBar — il suo tooltip non esce dallo schermo', () => {
  const relicSrc = readFileSync(resolve(__dirname, '../../components/relics/RelicBar.tsx'), 'utf8')

  it('non si apre sempre e solo verso il basso', () => {
    // MISURATO a 390x844: un tooltip di RelicBar finiva a `top: -224`, cioè
    // completamente fuori SOPRA lo schermo, mentre il trigger stava a 410 con
    // spazio abbondante. Causa: RelicBar NON usa il Tooltip condiviso — ha una
    // sua implementazione `absolute left-0 top-full` fissa, quindi la correzione
    // del componente condiviso non la toccava. Due implementazioni dello stesso
    // elemento, una sola corretta: è il motivo per cui "alcuni" tooltip si
    // vedevano male e altri no.
    // NON cercare `bottom-full` e basta: quella classe esiste già sulla FRECCIA
    // del tooltip, quindi il test passava senza che nulla fosse stato corretto.
    expect(relicSrc).toMatch(/aprireSopra/)
  })

  it('misura lo spazio disponibile invece di assumerlo', () => {
    expect(relicSrc).toMatch(/getBoundingClientRect|innerHeight/)
  })
})
