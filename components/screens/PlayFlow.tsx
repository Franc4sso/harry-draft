'use client'
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DraftedWizard } from '@/types'
import { DraftScreen } from './DraftScreen'
import { CampaignRunner } from './CampaignRunner'
import { randomSeed } from '@/lib/seed'

export function PlayFlow({ seed }: { seed: string }) {
  const [activeSeed, setActiveSeed] = useState(seed)
  const [team, setTeam] = useState<DraftedWizard[] | null>(null)

  const handleComplete = useCallback((t: DraftedWizard[]) => setTeam(t), [])
  const handleRestart = useCallback(() => {
    setTeam(null)
    setActiveSeed(randomSeed())
  }, [])

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={team ? `campaign-${activeSeed}` : `draft-${activeSeed}`}
        className="flex-1 flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        {team
          ? <CampaignRunner seed={activeSeed} team={team} onRestart={handleRestart} />
          : <DraftScreen seed={activeSeed} onComplete={handleComplete} />}
      </motion.div>
    </AnimatePresence>
  )
}
