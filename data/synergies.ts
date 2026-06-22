import type { Synergy } from '@/types'

export const SYNERGIES: Synergy[] = [
  // Houses (3+)
  { id: 'gryffindor3', name: '3 Grifondoro', kind: 'house', requires: { house: 'Grifondoro', count: 3 }, bonus: { def: 20 } },
  { id: 'slytherin3', name: '3 Serpeverde', kind: 'house', requires: { house: 'Serpeverde', count: 3 }, bonus: { atk: 20 } },
  { id: 'ravenclaw3', name: '3 Corvonero', kind: 'house', requires: { house: 'Corvonero', count: 3 }, bonus: { spd: 20 } },
  { id: 'hufflepuff3', name: '3 Tassorosso', kind: 'house', requires: { house: 'Tassorosso', count: 3 }, bonus: { regen: 12 } },
  // Roles (3+)
  { id: 'attackers3', name: '3 Attaccanti', kind: 'role', requires: { role: 'Attaccante', count: 3 }, bonus: { atk: 15 } },
  { id: 'tanks3', name: '3 Tank', kind: 'role', requires: { role: 'Tank', count: 3 }, bonus: { def: 18 } },
  { id: 'supports3', name: '3 Supporti', kind: 'role', requires: { role: 'Supporto', count: 3 }, bonus: { regen: 10 } },
  { id: 'controllers3', name: '3 Controllo', kind: 'role', requires: { role: 'Controllo', count: 3 }, bonus: { spd: 15 } },
  // Groups
  { id: 'goldenTrio', name: 'Golden Trio', kind: 'group', requires: { ids: ['harry', 'ron', 'hermione'] }, bonus: { allPct: 0.15 } },
  { id: 'weasley', name: 'Famiglia Weasley', kind: 'group', requires: { tag: 'weasley', count: 3 }, bonus: { regen: 8, def: 10 } },
  { id: 'order', name: 'Ordine della Fenice', kind: 'group', requires: { tag: 'order', count: 3 }, bonus: { allPct: 0.1 } },
  { id: 'deatheater', name: 'Mangiamorte', kind: 'group', requires: { tag: 'deatheater', count: 3 }, bonus: { atk: 25 } },
  { id: 'marauder', name: 'Malandrini', kind: 'group', requires: { tag: 'marauder', count: 2 }, bonus: { spd: 18, atk: 10 } },
  { id: 'da', name: 'Esercito di Silente', kind: 'group', requires: { tag: 'da', count: 4 }, bonus: { allPct: 0.08, def: 8 } },
]
