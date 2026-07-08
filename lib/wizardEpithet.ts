import { WIZARD_BY_ID } from '@/data/wizards'
import type { Role } from '@/types'

const ROLE_EPITHET: Record<Role, string> = {
  Tank: 'Muro della squadra',
  Attaccante: 'Cannone di vetro',
  Supporto: 'Sostegno della squadra',
  Controllo: 'Disturbatore',
}

/** Short epithet under the wizard name. Role-derived (kept simple — no hand-written 60). */
export function epithetFor(id: string): string {
  const role = WIZARD_BY_ID[id]?.role
  return role ? ROLE_EPITHET[role] : ''
}
