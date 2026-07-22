import type { Duo, DuoSignal } from '@/types'

export const SIGNAL_LABEL: Record<DuoSignal, string> = {
  veleno: 'Veleno', esecuzione: 'Esecuzione', scudirigen: 'Scudo/Rigen', magieOscure: 'Magie Oscure',
  taunt: 'Tank', attaccante: 'Attaccante', supporto: 'Supporto', controllo: 'Controllo',
}

export const DUOS: Duo[] = [
  { id: 'cancrena', name: 'Cancrena', signals: ['veleno', 'esecuzione'],
    desc: 'I nemici avvelenati sotto il 40% di vita subiscono il doppio dei danni da veleno.' },
  { id: 'miasma', name: 'Miasma', signals: ['veleno', 'magieOscure'],
    desc: 'Quando un nemico avvelenato muore, il suo veleno si propaga a un nemico vivo a caso.' },
  { id: 'untore', name: 'Untore', signals: ['veleno', 'supporto'],
    desc: 'Ogni volta che curi, sputi 1 dose di veleno su un nemico a caso.' },
  { id: 'muro-vivente', name: 'Muro Vivente', signals: ['scudirigen', 'taunt'],
    desc: 'Finché il tuo Tank col muro ha uno scudo, riflette parte del danno assorbito sull’attaccante.' },
  { id: 'esecuzione-a-freddo', name: 'Esecuzione a Freddo', signals: ['esecuzione', 'controllo'],
    desc: 'Un nemico stordito o congelato sotto il 50% di vita viene giustiziato all’istante.' },
  { id: 'mietitore', name: 'Mietitore', signals: ['esecuzione', 'magieOscure'],
    desc: 'Raddoppia la mietitura del Carnefice: ogni uccisione dà il doppio del Raccolto (+ATK) per il resto della battaglia.' },
]

export const DUO_BY_ID: Record<string, Duo> = Object.fromEntries(DUOS.map(d => [d.id, d]))

// Light per-signal glyph + accent for the card marks (data/duos.ts).
export const SIGNAL_ICON: Record<DuoSignal, string> = {
  veleno: '☠', esecuzione: '✖', scudirigen: '⛨', magieOscure: '☾',
  taunt: '⚑', attaccante: '⚔', supporto: '✚', controllo: '✦',
}
export const SIGNAL_COLOR: Record<DuoSignal, string> = {
  veleno: '#7ddc7d', esecuzione: '#ff8a7a', scudirigen: '#7db7ff', magieOscure: '#b98cff',
  taunt: '#3aa0f2', attaccante: '#ff5140', supporto: '#20d894', controllo: '#b355ff',
}

/** Come si accende ogni segnale. Le soglie sono ASIMMETRICHE e queste stringhe devono dire
 *  il vero: la fonte è `signalActive` (game/engine/duos.ts:23-30) — Tank basta 1, gli altri
 *  ruoli ne vogliono 2, i tag vogliono 2 maghi OPPURE una reliquia. `attaccante` è nella
 *  mappa per completezza del tipo, ma nessun Duo spedito lo usa e la UI non lo mostra mai
 *  (filtro: DUO_SIGNALS_IN_USE). */
export const SIGNAL_HOWTO: Record<DuoSignal, string> = {
  taunt: '1 Tank in squadra',
  supporto: '2 Supporti in squadra',
  controllo: '2 Controllori in squadra',
  attaccante: '2 Attaccanti in squadra',
  veleno: '2 maghi Veleno, oppure 1 reliquia veleno',
  esecuzione: '2 maghi Esecuzione, oppure 1 reliquia esecuzione',
  scudirigen: '2 maghi Scudo/Rigen, oppure 1 reliquia scudo',
  magieOscure: '2 maghi Magie Oscure, oppure 1 reliquia magia oscura',
}
