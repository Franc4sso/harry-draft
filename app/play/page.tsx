import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PlaySeedGate } from '@/components/screens/PlayFlow.gate'

export const metadata: Metadata = { title: 'Draft — Harry Draft' }

export default function Page() {
  return (
    <Suspense fallback={<main className="flex-1 flex items-center justify-center text-white/50">Caricamento…</main>}>
      <PlaySeedGate />
    </Suspense>
  )
}
