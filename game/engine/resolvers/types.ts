import type { RunNode, RunNodeType, RunState } from '@/types'
import type { Rng } from '../rng'

export type ResolverChoice =
  | { kind: 'recruit-pick'; wizardId: string; replaceId?: string }
  | { kind: 'relic-pick'; relicId: string; assignedTo?: string }
  | { kind: 'event-choice'; optionId: string }
  | { kind: 'spell-upgrade'; wizardId: string }
  | { kind: 'shop-buy'; slotId: string; carrierId?: string; targetWizardId?: string }
  | { kind: 'altare-buy'; relicId: string; costWizardId?: string; costRelicId?: string }
  | { kind: 'combat-ack' }
  | { kind: 'skip' }

export interface ResolverEntry {
  offers: { wizardIds?: string[]; relicIds?: string[] }
  isCombat: boolean
  /** Present for 'event' nodes: the picked event's display summary. */
  event?: { id: string; title: string; text: string; choices: { id: string; label: string }[] }
}

export interface NodeResolver {
  id: string
  enter(state: RunState, node: RunNode, rng: Rng): ResolverEntry
  resolve(state: RunState, node: RunNode, choice: ResolverChoice, rng: Rng): RunState
}

export type { RunNodeType }
