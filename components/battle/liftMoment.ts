import type { LogEntry } from '@/types'
import { DUO_BY_ID } from '@/data/duos'

export type LiftMoment = { kind: 'kill' | 'crit' | 'duo'; duoName?: string }

/** Il momento è "chiave" (merita il lift & focus) se è un'uccisione, un critico, o il PRIMO
 *  scatto di un Duo. Priorità kill > crit > duo (allineata a calloutFor). Puro. */
export function liftMomentFor(
  entry: LogEntry | null, frameKey: number, firstDuo: Map<string, number>,
): LiftMoment | null {
  if (!entry) return null
  if (entry.flags.includes('kill')) return { kind: 'kill' }
  if (entry.flags.includes('crit')) return { kind: 'crit' }
  if (entry.duoId && firstDuo.get(entry.duoId) === frameKey) {
    return { kind: 'duo', duoName: DUO_BY_ID[entry.duoId]?.name ?? entry.duoId }
  }
  return null
}
