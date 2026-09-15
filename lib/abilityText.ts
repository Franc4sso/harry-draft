import { abilityFor } from '@/lib/wizardAbilities'

export interface AbilityLine { value: string; what: string }
export interface AbilityText { name: string; lines: AbilityLine[] }

/**
 * Le firme riscritte come righe «numero + cosa», una voce per ognuna delle 15
 * firme del catalogo (data/signatures.ts).
 *
 * È una mappa esplicita e non un parser della prosa: i testi delle firme sono
 * scritti a mano, ognuno con una forma diversa, e un parser produrrebbe risultati
 * imprevedibili proprio sulle carte più importanti del gioco. Il test
 * `tests/lib/abilityText.test.ts` verifica che ogni firma del catalogo abbia la
 * sua voce, quindi aggiungerne una nuova senza testo rompe la suite.
 *
 * I numeri vengono dalle costanti in cima a `data/signatures.ts` (T1_DMG, T1_STUN,
 * ecc.), non dalla prosa — la prosa a volte le arrotonda o le omette del tutto.
 *
 * Chiave = id del mago (lo stesso di `SIGNATURE_BY_ID`).
 */
const LINES: Record<string, AbilityLine[]> = {
  // Tier 1
  dumbledore: [
    { value: '+30%', what: 'danni' },
    { value: '40%', what: 'stordisce chi colpisce' },
  ],
  voldemort: [
    { value: '+50%', what: 'danni sotto il 40% di vita' },
    { value: '35%', what: 'semina terrore (−ATT)' },
  ],
  harry: [
    { value: '+70%', what: 'danni al massimo, più è ferito' },
    { value: '50%', what: 'sotto metà vita si rigenera' },
  ],
  // Tier 2
  snape: [
    { value: '55%', what: 'avvelena chi colpisce' },
    { value: '35%', what: 'espone la difesa di chi colpisce' },
  ],
  bellatrix: [
    { value: '40%', what: 'stordisce chi colpisce' },
  ],
  mcgonagall: [
    { value: '−30%', what: 'danni subiti' },
  ],
  lupin: [
    { value: '50%', what: 'sotto metà vita si scatena' },
    { value: '+25', what: 'att a ogni turno, da ferito' },
  ],
  kingsley: [
    { value: '40%', what: 'rallenta pesantemente chi colpisce' },
  ],
  fleur: [
    { value: '40%', what: 'disarma chi colpisce' },
  ],
  // Tier 3
  hermione: [
    { value: '30%', what: 'silenzia chi colpisce' },
  ],
  cho: [
    { value: '25%', what: 'congela chi colpisce' },
  ],
  molly: [
    { value: '+30', what: 'scudo quando viene curata' },
  ],
  neville: [
    { value: '+18', what: 'att quando un alleato cade' },
  ],
  luna: [
    { value: '+12', what: 'vita a ogni turno' },
  ],
  tonks: [
    { value: '+10', what: 'vel a inizio turno' },
  ],
}

/** L'abilità personale come righe pronte da mostrare, o `undefined` per i 45
 *  maghi senza firma. Chi la consuma salta il blocco: mai un segnaposto. */
export function abilityText(wizardId: string): AbilityText | undefined {
  const sig = abilityFor(wizardId)
  if (!sig) return undefined
  const lines = LINES[wizardId]
  if (!lines) return undefined
  return { name: sig.name, lines }
}
