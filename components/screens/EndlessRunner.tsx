'use client'
import { useEndless } from '@/hooks/useEndless'
import { DraftScreen } from './DraftScreen'
import { RunBRunner } from './RunBRunner'
import { EndlessResult } from './EndlessResult'

/** Endless-mode run screen. Reuses RunBRunner (and every node/battle/map view it
 *  drives) via the shared controller shape (components/screens/RunBRunner.tsx's
 *  RunnerController) — zero view rebuild for map/battle/recruit/relic/event/
 *  infirmary/area-cleared. The draft phase now reuses the campaign
 *  DraftScreen too (screen-draft, no house pick) — the anti-cheat replay
 *  (game/engine/endlessReplay.ts) drives the SAME seeded DraftSession and
 *  validates each recorded pick, so live play and replay stay in lockstep. The
 *  terminal wipeout screen (EndlessResult below) still renders OUTSIDE
 *  RunBRunner once a score exists, instead of campaign's ResultScreen. */
export function EndlessRunner({ seed }: { seed: string }) {
  const c = useEndless(seed)

  if (c.score !== null) {
    return <EndlessResult score={c.score} floor={c.floor} challengeCode={c.getChallengeCode()} />
  }

  if (c.run.phase === 'draft') {
    return <DraftScreen seed={c.run.seed} onComplete={c.completeDraft} />
  }

  return <RunBRunner seed={seed} controller={c} />
}
