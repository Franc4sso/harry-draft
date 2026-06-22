'use client'
import { useEffect, useRef } from 'react'
import type { DraftedWizard } from '@/types'
import { useDraft } from '@/hooks/useDraft'
import { DraftBoard } from '@/components/draft/DraftBoard'

export function DraftScreen({ seed, onComplete }: { seed: string; onComplete: (team: DraftedWizard[]) => void }) {
  const { current, picks, teamSize, done, pick } = useDraft(seed)
  const fired = useRef(false)

  useEffect(() => {
    if (done && !fired.current) {
      fired.current = true
      onComplete(picks)
    }
  }, [done, picks, onComplete])

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
      <h1 className="font-display text-3xl">Draft</h1>
      {!done && (
        <DraftBoard candidates={current} picked={picks.length} total={teamSize} onPick={pick} />
      )}
      <p className="text-[10px] text-white/30 uppercase tracking-widest">seed: {seed}</p>
    </main>
  )
}
