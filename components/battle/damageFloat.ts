import type { LogEntry } from '@/types'

export type FloatTone = 'damage' | 'crit' | 'heal' | 'dodge'

export interface FloatDescriptor {
  text: string
  tone: FloatTone
}

/**
 * Maps the current replay log entry to a floating number shown over the targeted
 * unit (damage, crit, heal) or a "Schiva" tag on a dodge. Returns null when the
 * entry has nothing to float (self-buffs, KO/system narration, no entry).
 */
export function floatFor(entry: LogEntry | null): FloatDescriptor | null {
  if (!entry || entry.type === 'system') return null
  if (entry.flags.includes('dodge')) return { text: 'Schiva', tone: 'dodge' }
  if (entry.flags.includes('heal')) {
    return entry.value && entry.value > 0 ? { text: `+${entry.value}`, tone: 'heal' } : null
  }
  if (typeof entry.value === 'number' && entry.value > 0) {
    return { text: `-${entry.value}`, tone: entry.flags.includes('crit') ? 'crit' : 'damage' }
  }
  return null
}
