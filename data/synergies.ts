import type { Synergy } from '@/types'

export const SYNERGIES: Synergy[] = [
  // Groups
  { id: 'goldenTrio', name: 'Golden Trio', kind: 'group', requires: { ids: ['harry', 'ron', 'hermione'] }, bonus: { allPct: 0.15 } },
  { id: 'weasley', name: 'Famiglia Weasley', kind: 'group', requires: { tag: 'weasley', count: 3 }, bonus: { regen: 8, def: 10 } },
  { id: 'order', name: 'Ordine della Fenice', kind: 'group', requires: { tag: 'order', count: 3 }, bonus: { allPct: 0.1 } },
  { id: 'deatheater', name: 'Mangiamorte', kind: 'group', requires: { tag: 'deatheater', count: 3 }, bonus: { atk: 25 } },
  { id: 'tossicita', name: 'Tossicità', kind: 'origin', requires: { tag: 'veleno', count: 3 }, bonus: { keywordMult: { veleno: 0.5 } } },
  { id: 'spietatezza', name: 'Spietatezza', kind: 'origin', requires: { tag: 'esecuzione', count: 3 }, bonus: { atk: 5 } },
  { id: 'bastione', name: 'Bastione', kind: 'origin', requires: { tag: 'scudirigen', count: 3 }, bonus: { def: 8 } },
  { id: 'oscurita', name: 'Oscurità', kind: 'origin', requires: { tag: 'magieOscure', count: 3 }, bonus: { atk: 5 } },
  { id: 'marauder', name: 'Malandrini', kind: 'group', requires: { tag: 'marauder', count: 2 }, bonus: { spd: 18, atk: 10 } },
  { id: 'da', name: 'Esercito di Silente', kind: 'group', requires: { tag: 'da', count: 4 }, bonus: { allPct: 0.08, def: 8 } },
]
