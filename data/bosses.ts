import type { Synergy } from '@/types'

export interface BossDef {
  id: string
  name: string
  budget: number
  hpMult: number
  forcedSpellIds?: string[]
  exclusiveSynergy?: Synergy
}

export const BOSSES: BossDef[] = [
  {
    id: 'voldemort_boss',
    name: 'Lord Voldemort',
    budget: 1800,
    hpMult: 1.4,
    forcedSpellIds: ['avada', 'fiendfyre'],
    exclusiveSynergy: {
      id: 'darkLord', name: "L'Oscuro Signore", kind: 'group',
      requires: { count: 1 }, bonus: { allPct: 0.2 },
    },
  },
]
