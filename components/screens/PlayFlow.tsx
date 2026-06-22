'use client'
import { useState, useCallback } from 'react'
import type { DraftedWizard } from '@/types'
import { DraftScreen } from './DraftScreen'
import { TeamScreen } from './TeamScreen'
import { randomSeed } from '@/lib/seed'

export function PlayFlow({ seed }: { seed: string }) {
  const [activeSeed, setActiveSeed] = useState(seed)
  const [team, setTeam] = useState<DraftedWizard[] | null>(null)

  const handleComplete = useCallback((t: DraftedWizard[]) => setTeam(t), [])
  const handleRestart = useCallback(() => {
    setTeam(null)
    setActiveSeed(randomSeed())
  }, [])

  if (team) {
    return <TeamScreen team={team} onRestart={handleRestart} />
  }
  return <DraftScreen key={activeSeed} seed={activeSeed} onComplete={handleComplete} />
}
