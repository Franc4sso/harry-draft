'use client'
import { useMemo } from 'react'
import { Play, Pause, SkipForward, FastForward, ChevronRight } from 'lucide-react'
import type { ActiveRelic, ActiveSynergy, BattleResult, DraftedWizard, LogEntry } from '@/types'
import { buildReplay } from '@/game/engine/combat/replay'
import { useBattleReplay, REPLAY_SPEEDS } from '@/hooks/useBattleReplay'
import { InitiativeBar } from '@/components/battle/InitiativeBar'
import { BattleArena } from '@/components/battle/BattleArena'
import { ActionPanel } from '@/components/battle/ActionPanel'
import { BattleLog } from '@/components/battle/BattleLog'
import { BattleRecap } from '@/components/battle/BattleRecap'
import { Button } from '@/components/ui/Button'
import { SynergyRibbon } from '@/components/battle/SynergyRibbon'
import { lastRealEntryAt } from '@/lib/initiative'
import { BattleEndModal } from '@/components/battle/BattleEndModal'

export function BattleScreen({
  result, playerTeam, playerSyn, playerRelics, enemy, enemySyn, title, rightTitle, onFinish, enemyLevel = 1,
}: {
  result: BattleResult
  playerTeam: DraftedWizard[]
  playerSyn: ActiveSynergy[]
  playerRelics?: ActiveRelic[]
  enemy: DraftedWizard[]
  enemySyn: ActiveSynergy[]
  title: string
  rightTitle?: string
  onFinish: () => void
  /** Level shown on enemy busts (derived from menace); players use their own. */
  enemyLevel?: number
}) {
  const replay = useMemo(
    () => buildReplay(result, playerTeam, enemy, { leftSyn: playerSyn, rightSyn: enemySyn, leftRelics: playerRelics ?? [] }),
    [result, playerTeam, enemy, playerSyn, enemySyn, playerRelics],
  )
  const r = useBattleReplay(replay)
  // Sticky entry for the ActionPanel: hold the last REAL action across system
  // frames so the panel doesn't flicker to "…" on every regen/DoT/KO tick.
  // BattleArena keeps the TRUE current entry (r.entry) so floats/auras/laser
  // track the real frame.
  const stickyEntry = useMemo(() => lastRealEntryAt(replay, r.index), [replay, r.index])

  const controlAt = useMemo(() => {
    const kinds = ['stun', 'freeze', 'silence', 'disarm'] as const
    return (entry: LogEntry) => {
      const fi = replay.frames.findIndex(f => f.entry === entry)
      if (fi < 0 || !entry.actorSide) return undefined
      const key = `${entry.actorSide}:${entry.actorId}`
      const effs = replay.frames[fi]?.statusEffects?.[key] ?? []
      return kinds.find(k => effs.some(e => e.kind === k))
    }
  }, [replay])

  return (
    <main className="flex-1 flex flex-col items-center gap-5 p-4 sm:p-6">
      <div className="flex flex-col items-center gap-1">
        <h1 className="font-display text-2xl text-[#F0D98A] [text-shadow:0_0_18px_rgba(201,162,75,0.25)]">{title}</h1>
        <p className="text-[11px] uppercase tracking-widest text-white/35">
          Turno {r.entry?.turn ?? 0}
          {r.entry?.actorId ? <> · agisce <span className="text-white/60">{replay.units.find(u => u.id === r.entry!.actorId && u.side === r.entry!.actorSide)?.name ?? r.entry!.actorId}</span></> : null}
        </p>
      </div>

      {!r.done && (
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <Button variant="ghost" onClick={r.toggle} className="px-4" aria-label={r.playing ? 'Pausa' : 'Riproduci'}>
            {r.playing ? <Pause size={18} /> : <Play size={18} />}
          </Button>
          <Button variant="ghost" onClick={r.step} className="px-4 gap-1 inline-flex items-center" aria-label="Passo">
            <ChevronRight size={16} /> Passo
          </Button>
          <Button
            variant="ghost"
            onClick={() => r.setSpeed(REPLAY_SPEEDS[(REPLAY_SPEEDS.indexOf(r.speed) + 1) % REPLAY_SPEEDS.length]!)}
            className="px-4 gap-1 inline-flex items-center"
          >
            <FastForward size={16} /> {r.speed}×
          </Button>
          <Button variant="ghost" onClick={r.skip} className="px-4 gap-1 inline-flex items-center">
            <SkipForward size={16} /> Salta
          </Button>
        </div>
      )}

      <div className="grid w-full max-w-5xl grid-cols-1 lg:grid-cols-[7rem_1fr_13rem] gap-4 items-start">
        <div className="hidden lg:block">
          <InitiativeBar replay={replay} index={r.index} />
        </div>

        <div className="flex flex-col items-center gap-3 min-w-0">
          <SynergyRibbon synergies={playerSyn} relics={playerRelics ?? []} align="left" title="Le tue sinergie" tone="ally" />
          <BattleArena
            replay={replay} hp={r.hp} entry={r.entry} frameKey={r.index} rightTitle={rightTitle}
            enemyLevel={enemyLevel}
            center={<ActionPanel entry={stickyEntry} units={replay.units} />}
          />
          <SynergyRibbon synergies={enemySyn} align="left" title="Sinergie nemiche" tone="enemy" />
        </div>

        <div className="hidden lg:flex lg:flex-col gap-3">
          <BattleRecap frames={replay.frames.slice(0, r.index + 1)} units={replay.units} side="left" title="I tuoi danni" tone="ally" />
          <BattleRecap frames={replay.frames.slice(0, r.index + 1)} units={replay.units} side="right" title="Danni nemici" tone="enemy" />
        </div>
      </div>

      {/* initiative + recaps stack here so small screens still get them */}
      <div className="flex flex-col items-center gap-3 lg:hidden w-full">
        <InitiativeBar replay={replay} index={r.index} />
        <BattleRecap frames={replay.frames.slice(0, r.index + 1)} units={replay.units} side="left" title="I tuoi danni" tone="ally" />
        <BattleRecap frames={replay.frames.slice(0, r.index + 1)} units={replay.units} side="right" title="Danni nemici" tone="enemy" />
      </div>

      <BattleLog
        entries={replay.frames.slice(1, r.index + 1).map(f => f.entry!)}
        units={replay.units}
        controlAt={controlAt}
      />

      {r.modalReady && (
        <BattleEndModal
          outcome={result.winner === 'left' ? 'win' : 'loss'}
          timedOut={result.timedOut}
          onConfirm={onFinish}
        />
      )}
    </main>
  )
}
