'use client'
import { motion } from 'framer-motion'
import type { DraftedWizard } from '@/types'
import { WizardCard } from '@/components/cards/WizardCard'

export function DraftSlot({
  drafted, onPick, disabled,
}: {
  drafted: DraftedWizard
  onPick: () => void
  disabled?: boolean
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -32, scale: 0.85, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      <WizardCard drafted={drafted} onClick={disabled ? undefined : onPick} />
    </motion.div>
  )
}
