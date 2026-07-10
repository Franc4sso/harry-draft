'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { normalizeSeed } from '@/lib/seed'
import { EndlessRunner } from './EndlessRunner'

/** Mirrors components/screens/PlayFlow.gate.tsx (campaign): the run lives in
 *  localStorage (under a separate key — see lib/runStore.ts RUN_KEY_ENDLESS), so
 *  state differs between server (no storage) and client (possibly mid-run) renders.
 *  Render a stable placeholder until mounted so the first client paint matches the
 *  server HTML. */
export function EndlessSeedGate() {
  const params = useSearchParams()
  const seed = normalizeSeed(params.get('seed'))

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) {
    return <main className="flex-1 flex items-center justify-center text-white/50">Caricamento…</main>
  }

  return <EndlessRunner seed={seed} />
}
