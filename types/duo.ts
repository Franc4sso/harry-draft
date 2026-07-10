import type { DraftedWizard } from './combat'
import type { ActiveRelic } from './relic'

export type DuoSignal =
  | 'veleno' | 'esecuzione' | 'scudirigen' | 'magieOscure'
  | 'taunt' | 'attaccante' | 'supporto' | 'controllo'

export interface Duo {
  id: string
  name: string
  /** Effect text — HIDDEN in the Codex until first discovery. */
  desc: string
  signals: [DuoSignal, DuoSignal]
}

export interface ActiveDuo { duo: Duo }

export interface DuoProgress {
  duo: Duo
  lit: [boolean, boolean]
  active: boolean
  missing: DuoSignal[]
}
