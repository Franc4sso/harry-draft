'use client'
import { useMemo, useState } from 'react'
import { Play, Pause, SkipForward, FastForward, ChevronRight } from 'lucide-react'
import type { ActiveRelic, ActiveSynergy, BattleResult, DraftedWizard, LogEntry } from '@/types'
import { buildReplay } from '@/game/engine/combat/replay'
import { detectDuos } from '@/game/engine/duos'
import { livingOf } from '@/game/engine/roster'
import { useBattleReplay, REPLAY_SPEEDS } from '@/hooks/useBattleReplay'
import { BALANCE } from '@/data/constants'
import { Hourglass } from 'lucide-react'
import { InitiativeBar } from '@/components/battle/InitiativeBar'
import { BattleArena } from '@/components/battle/BattleArena'
import { ActionPanel } from '@/components/battle/ActionPanel'
import { BattleLog } from '@/components/battle/BattleLog'
import { StatusLegend } from '@/components/battle/StatusLegend'
import { BattleRecap } from '@/components/battle/BattleRecap'
import { Button } from '@/components/ui/Button'
import { SynergyRibbon } from '@/components/battle/SynergyRibbon'
import { lastRealEntryAt } from '@/lib/initiative'
import { BattleEndModal } from '@/components/battle/BattleEndModal'
import { recapTotals } from '@/lib/battleRecap'

export function BattleScreen({
  result, playerTeam, playerSyn, playerRelics, enemy, enemySyn, title, rightTitle, onFinish, enemyLevel = 1,
  rightMenace = 0, rightRelics, rightDamageReduction = 0, rightIgnoresTaunt = false,
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
  /** Level shown on enemy busts (menace was removed 2026-07-01); players use their own. */
  enemyLevel?: number
  /** Same values simulateBattle used for the enemy side — threaded into buildReplay so
   *  the InitiativeBar's displayed spd matches the sim's actual turn order. */
  rightMenace?: number
  rightRelics?: ActiveRelic[]
  rightDamageReduction?: number
  rightIgnoresTaunt?: boolean
}) {
  const replay = useMemo(
    () => buildReplay(result, playerTeam, enemy, {
      leftSyn: playerSyn, rightSyn: enemySyn, leftRelics: playerRelics ?? [],
      rightRelics: rightRelics ?? [], rightMenace, rightDamageReduction, rightIgnoresTaunt,
    }),
    [result, playerTeam, enemy, playerSyn, enemySyn, playerRelics, rightRelics, rightMenace, rightDamageReduction, rightIgnoresTaunt],
  )
  const r = useBattleReplay(replay)
  // Stessa lista di Duo che ha davvero agito nel motore. Il resolver (resolvers/combat.ts) fa
  // detectDuos(ready, state.relics) su `battleReadyTeam(livingOf(state.team))` — i caduti sono già
  // fuori. Qui invece `playerTeam` arriva da prepareCombat come `battleReadyTeam(run.team)`, che NON
  // filtra i caduti: senza questo `livingOf` le pill mostrerebbero Duo che in battaglia non erano
  // accesi. Il livingOf è quindi PORTANTE, non ridondante — non toglierlo.
  const activeDuos = useMemo(
    () => detectDuos(livingOf(playerTeam), playerRelics ?? []),
    [playerTeam, playerRelics],
  )
  // Lets the player dismiss the end modal to review the settled board/log,
  // then reopen it (or confirm) via the floating "Rivedi esito" button.
  const [dismissed, setDismissed] = useState(false)
  // Sticky entry for the ActionPanel: hold the last REAL action across system
  // frames so the panel doesn't flicker to "…" on every regen/DoT/KO tick.
  // BattleArena keeps the TRUE current entry (r.entry) so floats/auras/laser
  // track the real frame.
  const stickyEntry = useMemo(() => lastRealEntryAt(replay, r.index), [replay, r.index])

  // Recap frame slices: computed ONCE per tick (keyed on replay+index) and
  // shared by identity between the desktop and mobile layout copies below, so
  // React.memo(BattleRecap) can skip the second copy's render+recapTotals scan
  // entirely instead of rescanning frames 0..index up to 4x per tick.
  const leftRecapFrames = useMemo(() => replay.frames.slice(0, r.index + 1), [replay, r.index])
  const rightRecapFrames = leftRecapFrames

  // Fatigue ("Sfinimento") kicks in once the anti-stall system starts ticking
  // true damage every turn. Flag it as soon as the current turn passes the
  // threshold, or the moment a Fatica entry has actually played (whichever
  // comes first) so the banner never lags behind the log/HP bars.
  const fatigueActive = r.currentTurn > BALANCE.combat.fatigueStart
    || replay.frames.slice(0, r.index + 1).some(f => f.entry?.action === 'Fatica')

  // End-of-battle payoff: the player's top damage dealer (MVP) + the single biggest hit.
  const summary = useMemo(() => {
    const rows = recapTotals(replay.frames, replay.units, 'left')
    const top = [...rows].sort((a, b) => (b.dealt + b.healed) - (a.dealt + a.healed))[0]
    let bigHit: { name: string; value: number } | undefined
    for (const f of replay.frames) {
      const e = f.entry
      if (e && e.actorSide === 'left' && typeof e.value === 'number' && e.value > 0 && !e.flags.includes('heal')) {
        if (!bigHit || e.value > bigHit.value) {
          const actor = replay.units.find(u => u.id === e.actorId && u.side === e.actorSide)
          bigHit = { name: actor?.name ?? e.actorId ?? '—', value: e.value }
        }
      }
    }
    return { mvpName: top?.name ?? '—', mvpDealt: top?.dealt ?? 0, bigHit }
  }, [replay])

  // BattleLog entries: sliced fresh from replay.frames every tick so the log
  // grows with r.index — memoized so the array identity only changes when the
  // replay or the current index actually change, letting React.memo(BattleLog)
  // skip re-renders triggered by unrelated state (e.g. the end-modal dismiss toggle).
  const logEntries = useMemo(
    () => replay.frames.slice(1, r.index + 1).map(f => f.entry!),
    [replay, r.index],
  )

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

      {fatigueActive && (
        <div
          data-testid="fatigue-banner"
          className="flex items-center gap-2 rounded-xl border border-fuchsia-400/40 bg-fuchsia-950/40 px-4 py-1.5 text-xs font-semibold text-fuchsia-200 shadow-[0_0_16px_rgba(217,70,239,0.15)]"
        >
          <Hourglass size={14} className="shrink-0 text-fuchsia-300" aria-hidden />
          Sfinimento! Tutti i maghi perdono PV ogni turno.
        </div>
      )}

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

      <div className="grid w-full max-w-7xl grid-cols-1 lg:grid-cols-[7rem_1fr_13rem] gap-4 items-start">
        <div className="hidden lg:block">
          <InitiativeBar replay={replay} index={r.index} />
        </div>

        <div className="flex flex-col items-center gap-3 min-w-0">
          <SynergyRibbon synergies={playerSyn} relics={playerRelics ?? []} align="left" title="Le tue sinergie" tone="ally" />
          <BattleArena
            replay={replay} hp={r.hp} entry={r.entry} frameKey={r.index} rightTitle={rightTitle}
            enemyLevel={enemyLevel} speed={r.speed} duos={activeDuos}
            center={<ActionPanel entry={stickyEntry} units={replay.units} />}
          />
          <SynergyRibbon synergies={enemySyn} align="left" title="Sinergie nemiche" tone="enemy" />
        </div>

        <div className="hidden lg:flex lg:flex-col gap-3">
          <BattleRecap frames={leftRecapFrames} units={replay.units} side="left" title="I tuoi danni" tone="ally" />
          <BattleRecap frames={rightRecapFrames} units={replay.units} side="right" title="Danni nemici" tone="enemy" />
        </div>
      </div>

      {/* initiative + recaps stack here so small screens still get them */}
      <div className="flex flex-col items-center gap-3 lg:hidden w-full">
        <InitiativeBar replay={replay} index={r.index} />
        <BattleRecap frames={leftRecapFrames} units={replay.units} side="left" title="I tuoi danni" tone="ally" />
        <BattleRecap frames={rightRecapFrames} units={replay.units} side="right" title="Danni nemici" tone="enemy" />
      </div>

      <div className="flex w-full max-w-md justify-center">
        <StatusLegend />
      </div>

      <BattleLog
        entries={logEntries}
        units={replay.units}
        controlAt={controlAt}
      />

      {r.modalReady && !dismissed && (
        <BattleEndModal
          outcome={result.winner === 'left' ? 'win' : 'loss'}
          timedOut={result.timedOut}
          onConfirm={onFinish}
          onClose={() => setDismissed(true)}
          summary={summary}
        />
      )}

      {r.modalReady && dismissed && (
        <button
          type="button"
          onClick={() => setDismissed(false)}
          className="fixed bottom-6 right-6 z-50 rounded-full border border-[#C9A24B]/40 bg-[rgba(20,16,33,0.92)] px-4 py-2 text-sm font-display tracking-wide text-[#F0D98A] shadow-[0_0_24px_rgba(201,162,75,0.2)] transition-colors hover:bg-[rgba(20,16,33,1)]"
        >
          Rivedi esito
        </button>
      )}
    </main>
  )
}
