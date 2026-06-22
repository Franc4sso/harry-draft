'use client'
import { useMemo } from 'react'
import { Play, Pause, SkipForward, FastForward } from 'lucide-react'
import type { ActiveSynergy, BattleResult, DraftedWizard } from '@/types'
import { buildReplay } from '@/game/engine/combat/replay'
import { useBattleReplay, REPLAY_SPEEDS } from '@/hooks/useBattleReplay'
import { BattleStage } from '@/components/battle/BattleStage'
import { BattleLog } from '@/components/battle/BattleLog'
import { Button } from '@/components/ui/Button'

export function BattleScreen({
  result, playerTeam, playerSyn, enemy, enemySyn, title, rightTitle, onFinish,
}: {
  result: BattleResult
  playerTeam: DraftedWizard[]
  playerSyn: ActiveSynergy[]
  enemy: DraftedWizard[]
  enemySyn: ActiveSynergy[]
  title: string
  rightTitle?: string
  onFinish: () => void
}) {
  const replay = useMemo(
    () => buildReplay(result, playerTeam, enemy, { leftSyn: playerSyn, rightSyn: enemySyn }),
    [result, playerTeam, enemy, playerSyn, enemySyn],
  )
  const r = useBattleReplay(replay)

  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-6">
      <div className="flex flex-col items-center gap-1">
        <h1 className="font-display text-2xl">{title}</h1>
        <p className="text-[11px] uppercase tracking-widest text-white/35">
          Turno {r.entry?.turn ?? 0} · azione {r.index}/{r.total - 1}
        </p>
      </div>

      <BattleStage replay={replay} hp={r.hp} entry={r.entry} rightTitle={rightTitle} />

      <BattleLog entries={replay.frames.slice(1, r.index + 1).map(f => f.entry!)} units={replay.units} />

      <div className="flex items-center gap-3">
        {!r.done ? (
          <>
            <Button variant="ghost" onClick={r.toggle} className="px-4">
              {r.playing ? <Pause size={18} /> : <Play size={18} />}
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
          </>
        ) : (
          <Button onClick={onFinish}>
            {result.winner === 'left' ? 'Continua' : 'Vedi esito'}
          </Button>
        )}
      </div>
    </main>
  )
}
