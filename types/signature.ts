import type { TraitTrigger } from './trait'

/** A fixed, unique ability bound 1:1 to a wizard by id. Reuses the trait trigger
 *  shape; tier-1 legends carry 2 triggers, everyone else 1. */
export interface Signature {
  id: string        // === wizard.id
  name: string
  desc: string
  triggers: TraitTrigger[]
}
