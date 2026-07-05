import type { Role } from '@/types'
import { ROLE_PREY } from '@/game/engine/combat/roleCounter'

/**
 * Player-facing description of what each role DOES in battle (its baseline
 * behaviour, not just its stat lean). Surfaced as the role-icon tooltip on the
 * wizard card so the draft explains taunt / penetration / bypass / heal — which
 * are otherwise invisible engine logic.
 */
export const ROLE_INFO: Record<Role, string> = {
  Tank: 'Muro della squadra: i nemici lo attaccano per primo. Tanta vita e difesa, poco danno.',
  Attaccante: 'Cannone di vetro: ignora parte della difesa nemica. Tanto attacco, poca vita.',
  Controllo: 'Disturbatore: scavalca il Tank e colpisce le retrovie nemiche. Molto veloce.',
  Supporto: 'Guaritore: ogni turno cura l\'alleato più ferito. Tiene in piedi la squadra.',
}

/** Full tooltip string: role name followed by its behaviour blurb. */
export function roleTooltip(role: Role): string {
  return `${role} — ${ROLE_INFO[role]}`
}

/** The role this one deals bonus damage to — the counter cycle from `roleCounter.ts`,
 *  re-exported here so UI code has a single place to import role-facing helpers from. */
export function rolePreyOf(role: Role): Role {
  return ROLE_PREY[role]
}
