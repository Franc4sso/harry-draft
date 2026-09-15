'use client'
import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { Replay } from '@/game/engine/combat/replay'
import { initiativeAt, initiativeOrder, lastRealActorAt } from '@/lib/initiative'
import { cn } from '@/lib/theme'
import { PortraitImage } from '@/components/ui/PortraitImage'

const SLOT_WIDTH = 76
/** How many upcoming actors to pull from `initiativeAt` beyond the current one.
 *  The mockup ("La corsia sa il futuro") shows the lane scrolling several turns
 *  ahead; `initiativeAt`'s own default (5) is tuned for the compact InitiativeBar
 *  rail, so the lane asks for more without touching that default. */
const UPCOMING_COUNT = 7

/**
 * The "corsia del tempo": who acts next, and with which spell — the thing the
 * player could not see before. A skipped turn (stun/freeze) used to be a blank
 * frame; here the badge is visible on the slot BEFORE it happens, because the
 * order comes from `initiativeAt`'s scan of the replay's own future frames
 * (ground truth), not a recomputed spd sort — the lane's whole promise is "this
 * is what the engine will actually do next."
 *
 * Status reads (stun/freeze → will skip, silence → "colpo base") come from the
 * CURRENT frame's `statusEffects`: an upcoming actor's status doesn't change
 * between now and their turn (no other action resolves in between that could
 * clear/refresh it before they act), so the current frame is the correct,
 * and only available, source for "will this status still be active then".
 *
 * Slots key on `pos - nowOffset + i`, an ever-increasing position derived from
 * the "now" slot's absolute index in `initiativeOrder` — NOT on their index
 * within the visible window. That's what makes the slide real motion rather
 * than a remount: as `index` advances by one action, every slot's key shifts
 * up by exactly one, so React keeps the same DOM nodes and `translateX`
 * animates an actual displacement — matching the mockup's `.track` transform,
 * which shifts the whole row instead of re-laying-out each slot from scratch.
 */
export function TurnLane({ replay, index, className }: { replay: Replay; index: number; className?: string }) {
  const reduce = useReducedMotion()
  const frame = replay.frames[index] ?? replay.frames[replay.frames.length - 1]
  const statusEffects = frame?.statusEffects ?? {}

  const byKey = useMemo(() => Object.fromEntries(replay.units.map(u => [u.key, u])), [replay])
  const order = useMemo(() => initiativeOrder(replay), [replay])

  // `initiativeAt` is the lane's ground truth for "who acts next": it scans the
  // replay's own future frames rather than re-deriving a predicted order, so it
  // can never disagree with what the engine actually does (unlike a recomputed
  // spd sort). It only reports a non-null `current` (and therefore a non-empty
  // `upcoming`) when `index` itself lands on a real (non-system, actor-bearing)
  // frame — so it needs redirecting to the nearest real frame in TWO distinct
  // situations, which must not be conflated:
  //  (a) `index` precedes the first real action (the initial full-HP frame) —
  //      nothing has happened yet, so preview the first turn the engine will
  //      report as current the moment that frame lands: `firstRealIndex`.
  //  (b) `index` IS a genuine mid-battle system frame (KO narration,
  //      "Ricarica", a stun-skip announcement — everything `type: 'system'`).
  //      Someone HAS already acted here, and system frames — including the
  //      skip itself — are exactly the case this lane exists to make legible.
  //      Redirecting to `firstRealIndex` (or worse, `order[0]`) here would
  //      show the battle's first-ever actor, a stranger unrelated to frame
  //      `index`'s actual state. The established fix in this codebase for
  //      "stick through system frames" is `lastRealActorAt` (already used by
  //      InitiativeBar/BattleArena for the same problem); redirecting to that
  //      SAME frame keeps `initiativeAt`'s `upcoming` scan anchored there too,
  //      not just its `current`.
  const firstRealIndex = useMemo(
    () => replay.frames.findIndex(f => f.entry && f.entry.type !== 'system' && f.entry.actorSide),
    [replay],
  )
  const lastRealIndex = useMemo(() => {
    for (let i = Math.min(index, replay.frames.length - 1); i >= 0; i--) {
      const e = replay.frames[i]?.entry
      if (e && e.type !== 'system' && e.actorSide) return i
    }
    return -1
  }, [replay, index])
  const effectiveIndex =
    firstRealIndex < 0 ? -1 : index < firstRealIndex ? firstRealIndex : lastRealIndex >= 0 ? lastRealIndex : firstRealIndex
  const { current, upcoming } = initiativeAt(replay, Math.max(0, effectiveIndex), UPCOMING_COUNT)
  const nowKey = current ?? lastRealActorAt(replay, index) ?? order[0]?.key ?? null

  // Absolute position of the "now" slot within the full order, so slot keys
  // stay stable across renders (real sliding, not a remount) — see file doc.
  const pos = useMemo(() => order.findIndex(s => s.key === nowKey), [order, nowKey])
  const startPos = Math.max(0, pos - 1)
  const nowOffset = pos < 0 ? 0 : pos - startPos // index within `sequence` of the "now" slot (0 or 1)

  const sequence = useMemo(() => {
    if (pos < 0) return []
    const past = startPos < pos ? [order[startPos]!] : []
    const rest = [{ key: nowKey!, turn: order[pos]!.turn }, ...upcoming.map(k => ({ key: k, turn: -1 }))]
    return [...past, ...rest]
  }, [order, pos, startPos, nowKey, upcoming])

  return (
    // No built-in height class: the mockup's 128px assumed the lane was the only
    // newcomer to a screen with room to spare, but the arena's real minimum
    // (~591px, from the approved WizardCards' name/spell/stat band on top of the
    // fixed 118px portrait — see BattleScreen's PORTRAIT_HEIGHT comment) leaves
    // far less than that in the 768px budget. Per design ruling: the portrait
    // never shrinks and the arena is Task 5's approved territory, so the LANE
    // pays for its own seat — the caller sizes it (BattleScreen uses ~100px)
    // and every measurement below (avatar sizes, offsets, gaps) is tuned to fit
    // that, down from the mockup's roomier 128px sizing.
    <div
      data-testid="turn-lane"
      className={cn('relative overflow-hidden rounded-[13px] border border-amber-300/25', className)}
      style={{ background: 'linear-gradient(90deg, rgba(202,162,74,.12), rgba(16,13,28,.74) 32%)' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 bottom-0 z-[2] w-24"
        style={{ background: 'linear-gradient(90deg, rgba(202,162,74,.16), transparent)' }}
      />
      <motion.div
        className="absolute left-5 top-2 flex items-start"
        initial={false}
        animate={{ x: -startPos * SLOT_WIDTH }}
        transition={reduce ? { duration: 0 } : { duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
      >
        {sequence.map((slot, i) => {
          const u = byKey[slot.key]
          if (!u) return null
          const isNow = i === nowOffset
          const isPast = i < nowOffset
          const key = slot.key
          const effects = statusEffects[key] ?? []
          const willSkip = effects.some(e => (e.statusId ?? e.kind) === 'stun' || (e.statusId ?? e.kind) === 'freeze')
          const skipKind = effects.find(e => (e.statusId ?? e.kind) === 'stun')
            ? 'stun'
            : effects.find(e => (e.statusId ?? e.kind) === 'freeze')
              ? 'freeze'
              : null
          const silenced = effects.some(e => (e.statusId ?? e.kind) === 'silence')
          const mine = u.side === 'left'
          // Shrunk from the mockup's 50/40 (see the file-level comment on the
          // root height): the lane's whole vertical budget is ~100px here, not
          // 128px, so avatars pay their share of the cut alongside the offsets
          // and gaps below.
          const avatarSize = isNow ? 40 : 32
          const ring = mine ? 'rgba(124,220,125,.4)' : 'rgba(240,114,114,.45)'

          return (
            <div
              key={pos - nowOffset + i}
              data-testid="lane-slot"
              data-unit={key}
              data-now={isNow ? 'true' : 'false'}
              className="flex flex-col items-center gap-1"
              style={{ width: SLOT_WIDTH, flex: `0 0 ${SLOT_WIDTH}px`, opacity: isPast ? 0.22 : 1, transition: reduce ? undefined : 'opacity 0.4s' }}
            >
              <div
                className="relative overflow-hidden rounded-full"
                style={{
                  width: avatarSize,
                  height: avatarSize,
                  border: `2px solid ${ring}`,
                  transition: reduce ? undefined : 'all 0.42s cubic-bezier(.22,1,.36,1)',
                }}
              >
                <PortraitImage id={u.id} house={u.house} alt={u.name} variant="bust" />
                {willSkip && (
                  <span
                    data-testid="lane-skip"
                    data-kind={skipKind ?? 'stun'}
                    title="salterà il turno"
                    className="absolute -right-1 -top-1 flex h-[15px] w-[15px] items-center justify-center rounded-full text-[9px] font-black leading-none text-[#0a0814]"
                    style={{ background: skipKind === 'freeze' ? '#7dd3ff' : '#f0d48a' }}
                  >
                    {skipKind === 'freeze' ? '❄' : '✦'}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'truncate text-[8.5px] font-extrabold leading-none',
                  isNow ? 'text-amber-100' : 'text-white/35',
                )}
              >
                {u.name}
              </span>
              <span
                className={cn(
                  'truncate text-[8px] font-semibold leading-none',
                  isNow ? 'text-amber-300' : 'text-white/[.24]',
                )}
              >
                {silenced ? 'Colpo Base' : u.spell.name}
              </span>
            </div>
          )
        })}
      </motion.div>
    </div>
  )
}
