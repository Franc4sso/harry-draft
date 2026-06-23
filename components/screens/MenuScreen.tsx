'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { WizardCard } from '@/components/cards/WizardCard'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { normalizeSeed } from '@/lib/seed'

const teaser = draftWizard(createRng(7), WIZARD_BY_ID['harry']!)

export function MenuScreen() {
  const router = useRouter()
  const [seed, setSeed] = useState('')

  const play = () => {
    router.push(`/play?seed=${encodeURIComponent(normalizeSeed(seed))}`)
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-10 p-8 text-center">
      <div className="space-y-3">
        <h1 className="font-display text-6xl tracking-wide">Harry Draft</h1>
        <p className="text-white/60 max-w-md mx-auto">
          Componi una squadra di 5 maghi tramite draft e affronta 5 sfidanti e il Boss Finale.
        </p>
      </div>

      <WizardCard drafted={teaser} />

      <div className="flex flex-col items-center gap-3">
        <input
          aria-label="Seed (opzionale)"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') play() }}
          placeholder="Seed (opzionale)"
          className="w-64 rounded-xl bg-white/5 border border-white/15 px-4 py-2 text-center text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
        />
        <Button onClick={play}>Gioca</Button>
        <div className="flex gap-4">
          <Link href="/rules" className="text-white/70 hover:text-white text-sm uppercase tracking-wider font-display">Regole</Link>
          <Link href="/credits" className="text-white/70 hover:text-white text-sm uppercase tracking-wider font-display">Credits</Link>
        </div>
      </div>
    </main>
  )
}
