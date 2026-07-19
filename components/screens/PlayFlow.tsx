'use client'
import { RunBRunner } from './RunBRunner'

export function PlayFlow({ seed, tutorial }: { seed: string; tutorial?: boolean }) {
  return <RunBRunner seed={seed} tutorial={tutorial} />
}
