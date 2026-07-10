import type { Metadata } from 'next'
import { Suspense } from 'react'
import { EndlessSeedGate } from '@/components/screens/EndlessFlow.gate'

export const metadata: Metadata = { title: 'Modalità infinita — Harry Draft' }

export default function Page() {
  return (
    <Suspense fallback={<main className="flex-1 flex items-center justify-center text-white/50">Caricamento…</main>}>
      <EndlessSeedGate />
    </Suspense>
  )
}
