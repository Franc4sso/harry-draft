import type { House } from '@/types'
import type { ResolverChoice } from './resolvers/types'

// Bump when any change to the engine could alter a replay's outcome (Decision 3).
export const ENGINE_VERSION = 'endless-1'

export type PlayerAction =
  | { t: 'move'; nodeId: string }
  | { t: 'resolve'; choice: ResolverChoice }
  | { t: 'set-spell'; wizardId: string; spellId: string }
  | { t: 'use-consumable'; relicId: string }

export interface RunLog {
  v: 1
  engine: string
  seed: string
  house: House
  starterIds: string[]
  actions: PlayerAction[]
}
