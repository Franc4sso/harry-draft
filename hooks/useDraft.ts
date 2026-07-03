'use client'
import { useState, useCallback, useEffect } from 'react'
import type { DraftedWizard } from '@/types'
import { startDraft, pickFrom, type DraftSession } from '@/game/engine/draftSession'
import { BALANCE } from '@/data/constants'

export function useDraft(seed: string, targetPicks: number = BALANCE.draft.teamSize): {
  current: DraftedWizard[]
  picks: DraftedWizard[]
  screenIndex: number
  teamSize: number
  done: boolean
  pick: (candidateIndex: number) => void
} {
  const [session, setSession] = useState<DraftSession>(() => startDraft(seed, targetPicks))

  useEffect(() => {
    setSession(startDraft(seed, targetPicks))
  }, [seed, targetPicks])

  const pick = useCallback((candidateIndex: number) => {
    setSession((s) => (s.done ? s : pickFrom(s, candidateIndex)))
  }, [])

  return {
    current: session.current,
    picks: session.picks,
    screenIndex: session.screenIndex,
    teamSize: BALANCE.draft.teamSize,
    done: session.done,
    pick,
  }
}
