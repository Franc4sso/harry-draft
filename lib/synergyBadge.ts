import { SYNERGIES } from '@/data/synergies'

const NAME_BY_ID = new Map(SYNERGIES.map(s => [s.id, s.name]))

/** Short display name for a synergy id (falls back to the raw id). */
export function synergyName(id: string): string {
  return NAME_BY_ID.get(id) ?? id
}
