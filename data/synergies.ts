import type { Synergy } from '@/types'

// Tossicità NON è una sinergia di squadra: è uno "stile d'attacco veleno". Resta l'unico
// elemento di SYNERGIES perché il motore (simulate/tossicitaTrigger) la rileva via
// detectSynergies per applicare il keywordMult veleno e il trigger on-hit. Tutte le altre
// sinergie di squadra (Golden Trio, Mangiamorte, ecc.) sono state rimosse (2026-07-21):
// l'unico sistema di team-building è Combo Duo + Trio di casata (game/engine/trios.ts).
export const SYNERGIES: Synergy[] = [
  { id: 'tossicita', name: 'Tossicità', kind: 'origin', requires: { tag: 'veleno', count: 3 }, bonus: { keywordMult: { veleno: 0.5 } } },
  { id: 'spietatezza', name: 'Spietatezza', kind: 'origin', requires: { tag: 'esecuzione', count: 3 }, bonus: { keywordMult: { esecuzione: 0.5 } } },
  { id: 'bastione', name: 'Bastione', kind: 'origin', requires: { tag: 'scudirigen', count: 3 }, bonus: { keywordMult: { scudo: 0.5 } } },
]
