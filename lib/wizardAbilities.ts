import { SIGNATURE_BY_ID } from '@/data/signatures'
import { WIZARD_BY_ID } from '@/data/wizards'
import { ROLE_INFO } from '@/lib/roleInfo'

/** A wizard's personal ability for the card's gold plate. Reuses the wizard's Signature
 *  (name + desc) — every wizard has one. Fallback (defensive; no wizard needs it today):
 *  derive a generic name/blurb from the role so the plate is never empty. */
export function abilityFor(id: string): { name: string; blurb: string } {
  const sig = SIGNATURE_BY_ID[id]
  if (sig) return { name: sig.name, blurb: sig.desc }
  const role = WIZARD_BY_ID[id]?.role
  return { name: role ?? 'Abilità', blurb: role ? ROLE_INFO[role] : 'Nessuna abilità speciale.' }
}
