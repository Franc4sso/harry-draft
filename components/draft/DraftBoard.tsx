'use client'
import { AnimatePresence } from 'framer-motion'
import type { DraftedWizard } from '@/types'
import { DraftSlot } from './DraftSlot'
import { DraftProgress } from './DraftProgress'

export function DraftBoard({
  candidates, picked, total, onPick,
}: {
  candidates: DraftedWizard[]
  picked: number
  total: number
  onPick: (index: number) => void
}) {
  return (
    <div className="flex flex-col items-center gap-8">
      <DraftProgress picked={picked} total={total} />
      <div className="flex flex-wrap justify-center gap-5">
        <AnimatePresence mode="popLayout">
          {candidates.map((c, i) => (
            <DraftSlot key={c.wizard.id} drafted={c} onPick={() => onPick(i)} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
