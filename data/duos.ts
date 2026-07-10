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
    desc: 'Finché il Tank che provoca ha uno scudo, le tue retrovie non possono essere colpite.' },
  { id: 'esecuzione-a-freddo', name: 'Esecuzione a Freddo', signals: ['esecuzione', 'controllo'],
    desc: 'Un nemico stordito o congelato sotto il 50% di vita viene giustiziato all’istante.' },
  { id: 'mietitore', name: 'Mietitore', signals: ['esecuzione', 'magieOscure'],
    desc: 'Ogni nemico giustiziato dà al suo carnefice +6 attacco per il resto della battaglia.' },
]

export const DUO_BY_ID: Record<string, Duo> = Object.fromEntries(DUOS.map(d => [d.id, d]))
