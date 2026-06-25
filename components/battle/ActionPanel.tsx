'use client'
import { ArrowRight } from 'lucide-react'
import type { LogEntry } from '@/types'
import type { ReplayUnit } from '@/game/engine/combat/replay'
import { unitKey } from '@/game/engine/combat/replay'
import { RarityFrame } from '@/components/ui/RarityFrame'
import { PortraitImage } from '@/components/ui/PortraitImage'
import { floatFor } from './damageFloat'
import { describeEntry } from './BattleLog'
import { archetypeFor } from '@/lib/spellArchetype'
import { cn } from '@/lib/cn'

export type ResultTone = 'damage' | 'heal' | 'dodge' | 'crit' | 'block'

interface ResultDescriptor {
  tone: ResultTone
  text: string
}

const RESULT_CLASS: Record<ResultTone, string> = {
  damage: 'text-rose-300',
  heal: 'text-emerald-300',
  dodge: 'text-white/45 text-xs uppercase tracking-wider',
  crit: 'text-amber-300 text-lg font-bold drop-shadow-[0_0_8px_rgba(252,211,77,0.55)]',
  block: 'text-sky-300',
}

/**
 * Derives the colored result shown near the target. Reuses `floatFor` for the
 * damage/heal number + tone to stay in sync with the floating numbers, then
 * folds in block (shield) and crit, which floatFor doesn't surface as labels.
 */
function resultFor(entry: LogEntry): ResultDescriptor | null {
  const blocked = entry.flags.includes('block') || archetypeFor(entry) === 'shield'
  if (blocked) return { tone: 'block', text: 'Bloccato' }

  const float = floatFor(entry)
  if (!float) return null

  if (float.tone === 'dodge') return { tone: 'dodge', text: 'Schivato' }
  if (float.tone === 'crit') return { tone: 'crit', text: `${float.text} CRITICO!` }
  if (float.tone === 'heal') return { tone: 'heal', text: float.text }
  return { tone: 'damage', text: float.text }
}

/** Mini portrait + name used for both attacker and target. */
function Combatant({ unit, role }: { unit: ReplayUnit; role: 'attacker' | 'target' }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-14 sm:w-16">
        <RarityFrame tier={unit.tier}>
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg">
            <PortraitImage id={unit.id} house={unit.house} alt={unit.name} variant="bust" />
          </div>
        </RarityFrame>
      </div>
      <span data-role={role} className="max-w-[6rem] truncate text-center text-xs font-medium leading-tight">
        {unit.name}
      </span>
    </div>
  )
}

/**
 * Prominent central panel for the current action: attacker → spell → target with
 * a colored result, replacing the thin ActionBanner. Direction follows the actor
 * side (left→right, or mirrored right→left). Degrades to actor + narration for
 * system / actorless / targetless entries, and to a calm placeholder when null.
 */
export function ActionPanel({ entry, units }: { entry: LogEntry | null; units: ReplayUnit[] }) {
  const names: Record<string, string> = {}
  const byKey: Record<string, ReplayUnit> = {}
  for (const u of units) {
    names[u.key] = u.name
    byKey[u.key] = u
  }

  // Shell (no display class) + a centered grid variant for placeholder/degraded.
  const shell = 'rounded-2xl border border-[#C9A24B]/20 bg-[rgba(20,16,33,0.55)] px-4 py-3 w-full max-w-xl min-h-[5rem] backdrop-blur-sm'
  const centered = cn(shell, 'grid place-items-center')

  if (!entry) {
    return (
      <div data-testid="action-panel" className={centered}>
        <span className="text-white/30 text-sm">…</span>
      </div>
    )
  }

  const attacker = entry.actorSide ? byKey[unitKey(entry.actorSide, entry.actorId)] : undefined
  const target = entry.targetSide && entry.targetId ? byKey[unitKey(entry.targetSide, entry.targetId)] : undefined
  const isSystem = entry.type === 'system'

  // Degraded mode: no resolvable attacker/target pairing, or a system entry.
  if (!attacker || !target || isSystem) {
    return (
      <div data-testid="action-panel" className={centered}>
        <span data-role="effect" className="text-center text-sm text-white/80">
          {describeEntry(entry, names)}
        </span>
      </div>
    )
  }

  const result = resultFor(entry)
  // Direction follows the arena: left-side actor stays left (arrow →), right-side
  // actor is mirrored to the right (arrow ←), so panel position maps to the arena.
  const mirrored = entry.actorSide === 'right'

  // Self-target (e.g. Episkey heal-on-self): a single unit, no arrow/target pair.
  const selfTarget = attacker.key === target.key
  if (selfTarget) {
    return (
      <div data-testid="action-panel" className={cn(shell, 'flex items-center justify-center gap-3 sm:gap-5')}>
        <Combatant unit={attacker} role="attacker" />
        <div className="flex flex-col items-center gap-1 min-w-[5rem]">
          <span data-role="spell" className="text-center text-base font-display text-[#F0D98A]">
            {entry.action}
          </span>
          {result && (
            <span
              data-role="result"
              data-tone={result.tone}
              className={cn('text-center font-display tabular-nums leading-tight', RESULT_CLASS[result.tone])}
            >
              {result.text}
            </span>
          )}
        </div>
      </div>
    )
  }

  // Attacker/target slotted by arena side; the result sits under the TARGET.
  const attackerCol = <Combatant unit={attacker} role="attacker" />
  const targetCol = (
    <div className="flex flex-col items-center gap-1">
      <Combatant unit={target} role="target" />
      {result && (
        <span
          data-role="result"
          data-tone={result.tone}
          className={cn('text-center font-display tabular-nums leading-tight', RESULT_CLASS[result.tone])}
        >
          {result.text}
        </span>
      )}
    </div>
  )

  const middle = (
    <div className="flex flex-col items-center gap-1 min-w-[5rem]">
      <span data-role="spell" className="text-center text-base font-display text-[#F0D98A]">
        {entry.action}
      </span>
      <ArrowRight size={22} className={cn('text-white/40', mirrored && 'rotate-180')} aria-hidden />
    </div>
  )

  const narration = describeEntry(entry, names)

  return (
    <div data-testid="action-panel" className={cn(shell, 'flex flex-col items-center gap-1.5')}>
      <div className="flex items-center justify-center gap-3 sm:gap-5 w-full">
        {mirrored ? (
          <>
            {targetCol}
            {middle}
            {attackerCol}
          </>
        ) : (
          <>
            {attackerCol}
            {middle}
            {targetCol}
          </>
        )}
      </div>
      <p role="note" data-role="narration" className="text-center text-[11px] text-white/55 leading-snug">
        {narration}
      </p>
    </div>
  )
}
