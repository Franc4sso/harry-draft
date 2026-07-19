'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { normalizeSeed } from '@/lib/seed'
import { TUTORIAL_SEED } from '@/game/engine/tutorialOffer'
import { PlayFlow } from './PlayFlow'

export function PlaySeedGate() {
  const params = useSearchParams()
  const tutorial = params.get('tutorial') === '1'
  const seed = tutorial ? TUTORIAL_SEED : normalizeSeed(params.get('seed'))

  // The run lives in localStorage, so PlayFlow's state differs between the
  // server (no storage → fresh draft) and the client (restored mid-run). Render
  // a stable placeholder until mounted so the first client paint matches the
  // server HTML; the persisted run only renders after hydration.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) {
    return <main className="flex-1 flex items-center justify-center text-white/50">Caricamento…</main>
  }

  return <PlayFlow seed={seed} tutorial={tutorial} />
}
