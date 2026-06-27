'use client'
import { RunBRunner } from './RunBRunner'

export function PlayFlow({ seed }: { seed: string }) {
  return <RunBRunner seed={seed} />
}
