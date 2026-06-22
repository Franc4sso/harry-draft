'use client'
import { useSearchParams } from 'next/navigation'
import { normalizeSeed } from '@/lib/seed'
import { PlayFlow } from './PlayFlow'

export function PlaySeedGate() {
  const params = useSearchParams()
  const seed = normalizeSeed(params.get('seed'))
  return <PlayFlow seed={seed} />
}
