'use client'
import { motion, AnimatePresence } from 'framer-motion'
import type { LogEntry } from '@/types'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import { unitKey } from '@/game/engine/combat/replay'
import { cn } from '@/lib/cn'

export type LogTone = 'crit' | 'heal' | 'dodge' | 'kill' | 'dot' | 'stun' | 'pen' | 'normal'

function toneFor(entry: LogEntry): LogTone {
  if (entry.flags.includes('kill')) return 'kill'
  if (entry.flags.includes('crit')) return 'crit'
  if (entry.flags.includes('heal')) return 'heal'
  if (entry.flags.includes('dodge')) return 'dodge'
  if (entry.flags.includes('dot')) return 'dot'
  if (entry.flags.includes('stun')) return 'stun'
  if (entry.flags.includes('pen')) return 'pen'
  return 'normal'
}

const TONE_CLASS: Record<LogTone, string> = {
  crit: 'text-amber-300',
  heal: 'text-emerald-300',
  dodge: 'text-white/45',
  kill: 'text-rose-400',
  dot: 'text-fuchsia-300',
  stun: 'text-sky-300',
  pen: 'text-orange-300',
  normal: 'text-white/75',
}

/** Renders a single log entry into Italian narration. Exported for testing. */
export function describeEntry(
  entry: LogEntry,
  names: Record<string, string>,
  controlKind?: 'stun' | 'freeze' | 'silence' | 'disarm',
): string {
  const actor = entry.actorSide ? names[unitKey(entry.actorSide, entry.actorId)] ?? entry.actorId : entry.actorId
  const target = entry.targetId && entry.targetSide
    ? names[unitKey(entry.targetSide, entry.targetId)] ?? entry.targetId
    : undefined

  if (entry.action === 'KO') return `${target ?? actor} viene eliminato`
  if (entry.action === 'Stordito') {
    const who = actor
    switch (controlKind) {
      case 'freeze':  return `${who} è congelato e salta il turno`
      case 'silence': return `${who} è silenziato: niente incantesimi`
      case 'disarm':  return `${who} è disarmato: niente attacchi`
      default:        return `${who} è stordito e salta il turno`
    }
  }
  if (entry.action === 'Veleno') return `${actor} subisce ${entry.value ?? 0} danni da veleno`

  if (entry.flags.includes('heal')) return `${actor} lancia ${entry.action} e cura ${entry.value ?? 0} HP`
  if (entry.flags.includes('dodge')) return `${actor} lancia ${entry.action} ma ${target ?? 'il bersaglio'} schiva`
  if (entry.type === 'Difesa') return `${actor} si protegge con ${entry.action}`

  const crit = entry.flags.includes('crit') ? ' (critico!)' : ''
  const pen = entry.flags.includes('pen') ? ' [armatura ignorata]' : ''
  if (typeof entry.value === 'number' && entry.value > 0) {
    return `${actor} lancia ${entry.action} su ${target ?? '?'}: ${entry.value} danni${crit}${pen}`
  }
  return `${actor} lancia ${entry.action}${target ? ` su ${target}` : ''}`
}

export function BattleLog({
  entries, units, max = 7, controlAt,
}: {
  entries: LogEntry[]
  units: ReplayUnit[]
  max?: number
  controlAt?: (entry: LogEntry) => 'stun' | 'freeze' | 'silence' | 'disarm' | undefined
}) {
  const names: Record<string, string> = {}
  for (const u of units) names[u.key] = u.name
  const recent = entries.slice(Math.max(0, entries.length - max))

  return (
    <div className="glass rounded-2xl p-3 w-full max-w-md h-44 overflow-hidden flex flex-col justify-end">
      <ul className="space-y-1 text-xs">
        <AnimatePresence initial={false}>
          {recent.map((entry, i) => {
            const globalIdx = entries.length - recent.length + i
            return (
              <motion.li
                key={globalIdx}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={cn('leading-snug', TONE_CLASS[toneFor(entry)])}
              >
                <span className="text-white/30 tabular-nums mr-1">T{entry.turn}</span>
                {describeEntry(entry, names, controlAt?.(entry))}
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
    </div>
  )
}
