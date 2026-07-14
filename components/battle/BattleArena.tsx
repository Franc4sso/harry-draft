'use client'
import type React from 'react'
import { useMemo } from 'react'
import type { LogEntry, ActiveEffect, ActiveDuo } from '@/types'
import type { Replay, ReplayUnit } from '@/game/engine/combat/replay'
import { firstDuoFireFrames, unitKey } from '@/game/engine/combat/replay'
import { UnitBust } from './UnitBust'
import { ArenaBackdrop } from './ArenaBackdrop'
import { PixiArena } from './PixiArena'
import { Callout } from './Callout'
import { LiftFocus } from './LiftFocus'
import { liftMomentFor } from './liftMoment'
import { DuoPills } from './DuoPills'
import { floatFor } from './damageFloat'
import { DUO_BY_ID } from '@/data/duos'

/** Big/ultimate enemy spells worth warning the player about a beat before they land. */
const BIG_SPELLS = new Set([
  'Avada Kedavra', 'Ardemonio', 'Sectumsempra', 'Bombarda', 'Reducto', 'Confringo', 'Crucio',
])

/** Stable empty-array fallback so units with no active effects keep the SAME reference
 *  across ticks — a fresh `[]` per render would defeat UnitBust's React.memo. */
const EMPTY_EFFECTS: ActiveEffect[] = []

/**
 * Staged battlefield: player's busts on top, enemies on the bottom, the
 * spell-effect layer between them, and the Protego dome over a blocking
 * defender. Statuses are derived per frame; HP comes from the current frame.
 */
export function BattleArena({
  replay, hp, entry, frameKey = 0, leftTitle = 'La tua squadra', rightTitle = 'Avversari', center, enemyLevel = 1, speed = 1, duos = [],
}: {
  replay: Replay
  hp: Record<string, number>
  entry: LogEntry | null
  frameKey?: number
  leftTitle?: string
  rightTitle?: string
  center?: React.ReactNode
  /** Level shown on every enemy bust (menace was removed 2026-07-01). Players use their own. */
  enemyLevel?: number
  /** Replay playback speed — feeds the Pixi VFX layer's time budget. */
  speed?: number
  /** Duo attivi del giocatore in questa battaglia (player-only). */
  duos?: ActiveDuo[]
}) {
  // Una riga di sistema marchiata da un Duo non ha un vero "attore che agisce": MIASMA la attribuisce
  // al CADAVERE che contagia (giusto nel log, ma in arena accenderebbe l'aura "sta agendo" su un morto),
  // e le altre (KO del Mietitore, sputo dell'Untore) sono conseguenze passive, non azioni. Su questi
  // frame l'evidenziazione dell'attore resta spenta: parlano la pill che lampeggia e l'annuncio.
  const duoSystemFrame = !!entry?.duoId && entry.type === 'system'
  // A frame Stordito (type system, action 'Stordito') is a SKIPPED turn, not an action: the
  // engine emits it on the dedicated frame that covers every control gating 'action' (stun,
  // freeze, ...). The "sta agendo" aura must NOT light up here — it was misleading (the
  // skipped unit looked like it was acting).
  const skipFrame = entry?.type === 'system' && entry.action === 'Stordito'
  const actingKey = entry?.actorSide && !duoSystemFrame && !skipFrame ? unitKey(entry.actorSide, entry.actorId) : null
  const targetKey = entry?.targetSide && entry.targetId ? unitKey(entry.targetSide, entry.targetId) : null
  const float = floatFor(entry)
  const frame = replay.frames[frameKey]
  const statusEffects = frame?.statusEffects ?? {}
  const cooldowns = frame?.cooldowns ?? {}

  // The unit that's skipping this frame, and which control kind to flash (stun vs freeze) —
  // read from its OWN statusEffects this frame (the log entry only carries the generic 'stun'
  // flag, but the flash should say CONGELATO's kind too).
  const skipKey = skipFrame && entry?.actorSide ? unitKey(entry.actorSide, entry.actorId) : null
  const skipKind: 'stun' | 'freeze' | null = skipKey
    ? (statusEffects[skipKey]?.some(e => e.kind === 'freeze') ? 'freeze' : 'stun')
    : null

  // A control status (stun/freeze/silence/disarm) carries no flag of its own, so detect
  // one freshly applied to the target THIS frame by diffing against the previous frame —
  // this is what lets the Callout announce SILENZIATO / DISARMATO / STORDITO / CONGELATO.
  const appliedControl = useMemo(() => {
    if (!targetKey) return null
    const CONTROLS = new Set(['stun', 'freeze', 'silence', 'disarm'])
    const prev = replay.frames[frameKey - 1]?.statusEffects?.[targetKey] ?? []
    const prevKeys = new Set(prev.map(e => e.statusId ?? e.kind))
    const fresh = (statusEffects[targetKey] ?? []).find(e => CONTROLS.has(e.kind) && !prevKeys.has(e.statusId ?? e.kind))
    return fresh?.kind ?? null
  }, [replay.frames, frameKey, targetKey, statusEffects])

  // Boss telegraph: peek at the NEXT frame — if an enemy is about to unleash a big/ultimate
  // spell, warn the player one beat before it lands.
  const telegraph = useMemo(() => {
    const next = replay.frames[frameKey + 1]?.entry
    if (next && next.actorSide === 'right' && BIG_SPELLS.has(next.action)) {
      const caster = replay.units.find(u => u.id === next.actorId && u.side === 'right')
      return { name: caster?.name ?? 'Il nemico', spell: next.action }
    }
    return null
  }, [replay.frames, replay.units, frameKey])

  // Primo scatto di ogni Duo in QUESTA battaglia: l'indice del primo frame che lo marchia. La stessa
  // funzione pura la usa `useBattleReplay` per allungare SOLO quel frame — annuncio e ritmo devono
  // concordare, quindi la mappa è una sola (game/engine/combat/replay.ts).
  const firstFireAt = useMemo(() => firstDuoFireFrames(replay.frames), [replay.frames])

  const firingId = entry?.duoId ?? null
  // L'annuncio grosso col nome SOLO al primo scatto; dopo, la pill lampeggia e basta.
  const duoName = firingId && firstFireAt.get(firingId) === frameKey
    ? (DUO_BY_ID[firingId]?.name ?? null)
    : null

  const left = useMemo(() => replay.units.filter(u => u.side === 'left'), [replay.units])
  const right = useMemo(() => replay.units.filter(u => u.side === 'right'), [replay.units])

  // A frame-lift (kill/crit/primo-scatto-duo) oscura TUTTE le originali forte — non solo le
  // non-coinvolte — così l'overlay dei cloni (LiftFocus) resta l'unico elemento a fuoco.
  const lifting = !!liftMomentFor(entry, frameKey, firstFireAt)

  const anyAction = !!actingKey
  // A lone enemy reads as a boss encounter → ominous treatment on that bust.
  const bossFight = right.length === 1
  const renderSide = (units: ReplayUnit[], mirrored: boolean, boss = false) =>
    units.map(u => {
      const involved = u.key === actingKey || u.key === targetKey
      return (
        <div key={u.key} className="relative transition-opacity duration-200" style={{ opacity: lifting ? 0.15 : anyAction && !involved ? 0.45 : 1 }}>
          <UnitBust
            unit={u}
            hp={hp[u.key] ?? 0}
            acting={u.key === actingKey}
            targeted={u.key === targetKey}
            mirrored={mirrored}
            boss={boss}
            float={u.key === targetKey ? float : null}
            // Only the targeted bust shows a float/impact (keyed by frameKey to
            // re-trigger its AnimatePresence). Every other bust gets a STABLE key so
            // React.memo(UnitBust) can actually skip it — otherwise a per-tick frameKey
            // on all busts makes the memo a no-op during playback.
            floatKey={u.key === targetKey ? frameKey : undefined}
            skipping={u.key === skipKey ? skipKind : null}
            effects={statusEffects[u.key] ?? EMPTY_EFFECTS}
            cooldown={cooldowns[u.key]?.[u.spell.id] ?? 0}
            level={u.side === 'right' ? enemyLevel : u.level}
          />
        </div>
      )
    })

  return (
    <div data-testid="battle-arena" className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-4 rounded-3xl px-2 py-4">
      <ArenaBackdrop />
      <DuoPills duos={duos} firingId={firingId} />
      {telegraph && (
        <div
          key={`tg-${frameKey}`}
          data-testid="boss-telegraph"
          className="pointer-events-none absolute left-1/2 top-1 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-rose-500/50 bg-black/85 px-4 py-1.5 text-xs font-semibold text-rose-200 motion-safe:animate-pulse sm:text-sm"
          style={{ boxShadow: '0 0 26px rgba(224,90,74,.45)' }}
        >
          ⚠ {telegraph.name} sta caricando {telegraph.spell}…
        </div>
      )}
      {/* Teams as horizontal rows (player on top, enemies below) — clearest read of
          who-hits-whom. A fixed-height center keeps the field from reflowing. */}
      <section className="flex w-full flex-col items-center gap-2">
        <h3 className="text-xs uppercase tracking-widest text-white/40">{leftTitle}</h3>
        <div data-testid="row-player" className="flex flex-nowrap justify-center gap-2 sm:gap-3">{renderSide(left, false)}</div>
      </section>

      <div className="flex min-h-[5.5rem] w-full items-center justify-center self-center">
        {center ?? <span className="font-display text-2xl text-white/30 select-none">VS</span>}
      </div>

      <section className="flex w-full flex-col items-center gap-2">
        <div data-testid="row-enemies" className="flex flex-nowrap justify-center gap-2 sm:gap-3">{renderSide(right, true, bossFight)}</div>
        <h3 className="text-xs uppercase tracking-widest text-white/40">{rightTitle}</h3>
      </section>

      <PixiArena entry={entry} frameKey={frameKey} speed={speed} />
      <Callout entry={entry} frameKey={frameKey} appliedControl={appliedControl} duoName={duoName} />
      <LiftFocus entry={entry} frameKey={frameKey} units={replay.units} firstDuo={firstFireAt} speed={speed} hp={hp} />
    </div>
  )
}
