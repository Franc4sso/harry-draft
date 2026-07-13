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

/** How close a single signal is: how many contributing mages the team has (`have`) vs how many
 *  it needs (`need`), or whether a relic already lights it on its own (`byRelic`). Drives the
 *  "1/2" / "✓ reliquia" gem count in the run Duo panel. */
export interface SignalCount {
  have: number
  need: number
  byRelic: boolean
}
