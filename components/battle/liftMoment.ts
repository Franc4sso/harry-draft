import type { LogEntry } from '@/types'

export type LiftMoment = { kind: 'kill' | 'crit' }

/** Il momento è "chiave" (merita il lift & focus cinematografico) se è un'uccisione o un critico —
 *  colpi drammatici veri. NON i Duo di per sé: i Duo drammatici (Esecuzione a Freddo, Mietitore)
 *  portano già `kill` e scattano qui via quel ramo; i Duo passivi (Cancrena tick-veleno, Miasma,
 *  Untore, Muro Vivente riflesso) NON devono far volare le carte — restano annunciati dal Callout
 *  + dalla pill. Priorità kill > crit (allineata a calloutFor). Puro. */
export function liftMomentFor(entry: LogEntry | null): LiftMoment | null {
  if (!entry) return null
  if (entry.flags.includes('kill')) return { kind: 'kill' }
  if (entry.flags.includes('crit')) return { kind: 'crit' }
  return null
}
