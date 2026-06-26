import type { DraftedWizard, Tier, Wizard } from '@/types'
import { createRng } from './rng'
import { draftRngChannel } from './run'
import { createDraftPool, generateScreen, commitPick } from './draft'
import { draftWizard } from './statRoll'
import { BALANCE } from '@/data/constants'

export interface DraftSession {
  seed: string
  pool: Wizard[]
  picks: DraftedWizard[]
  current: DraftedWizard[]
  screenIndex: number
  done: boolean
}

function rollScreen(seed: string, pool: Wizard[], pickedTiers: Tier[], screenIndex: number): DraftedWizard[] {
  const root = createRng(seed).fork(draftRngChannel)
  const screenRng = root.fork(screenIndex * 2 + 1)
  const rollRng = root.fork(screenIndex * 2 + 2)
  const shown = generateScreen(screenRng, pool, pickedTiers, screenIndex)
  return shown.map((w) => draftWizard(rollRng, w, true))
}

export function startDraft(seed: string): DraftSession {
  const pool = createDraftPool()
  const current = rollScreen(seed, pool, [], 0)
  return { seed, pool, picks: [], current, screenIndex: 0, done: false }
}

export function pickFrom(session: DraftSession, candidateIndex: number): DraftSession {
  const chosen = session.current[candidateIndex]
  if (!chosen) throw new Error(`invalid candidate index ${candidateIndex}`)

  const shownWizards = session.current.map((c) => c.wizard)
  const nextPool = commitPick(session.pool, shownWizards, chosen.wizard.id)
  const picks = [...session.picks, chosen]
  const screenIndex = session.screenIndex + 1

  if (picks.length >= BALANCE.draft.teamSize) {
    return { ...session, pool: nextPool, picks, current: [], screenIndex, done: true }
  }
  const pickedTiers = picks.map((p) => p.wizard.tier)
  const current = rollScreen(session.seed, nextPool, pickedTiers, screenIndex)
  return { ...session, pool: nextPool, picks, current, screenIndex, done: false }
}
