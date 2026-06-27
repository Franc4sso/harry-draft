'use client'
import { motion } from 'framer-motion'
import type { House } from '@/types'
import { HOUSES } from '@/data/houses'
import { HouseCrest } from '@/components/ui/HouseCrest'

export function HouseSelectScreen({ onSelect }: { onSelect: (house: House) => void }) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
      <h1 className="font-display text-4xl text-center">Scegli la tua Casa</h1>
      <p className="text-white/60 text-center max-w-md">
        La tua Casa guida i reclutamenti: ogni terna garantisce almeno un mago della tua Casa.
      </p>
      <div className="grid grid-cols-2 gap-5 max-w-2xl w-full">
        {Object.values(HOUSES).map((h, i) => (
          <motion.button
            key={h.id}
            onClick={() => onSelect(h.id)}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -4, scale: 1.02 }}
            className="glass rounded-xl p-6 flex flex-col items-center gap-3 border"
            style={{ borderColor: h.color, boxShadow: `0 0 24px -8px ${h.glow}` }}
          >
            <HouseCrest house={h.id} size={48} />
            <span className="font-display text-2xl">{h.label}</span>
          </motion.button>
        ))}
      </div>
    </main>
  )
}
