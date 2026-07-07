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
  Attaccante: 'Cannone di vetro: ignora parte della difesa nemica e si tuffa sui bersagli fragili. Tanto attacco, poca vita.',
  Controllo: 'Disturbatore: stordisce e rallenta. Scavalca la provocazione del Tank solo se riesce a stordirlo. Molto veloce.',
  Supporto: 'Sostegno: cura, scuda e pulisce i controlli dalla squadra. La tiene in piedi.',
}

/** Full tooltip string: role name followed by its behaviour blurb. */
export function roleTooltip(role: Role): string {
  return `${role} — ${ROLE_INFO[role]}`
}

/** One-word action verb per role, player-facing. */
export const ROLE_VERB: Record<Role, string> = {
  Tank: 'Provoca', Attaccante: 'Colpisce', Supporto: 'Cura', Controllo: 'Disabilita',
}

/** Role accent color (poster cards / role gem). */
export const ROLE_ACCENT: Record<Role, string> = {
  Tank: '#3aa0f2', Attaccante: '#ff5140', Supporto: '#20d894', Controllo: '#b355ff',
}

/** The role this one deals bonus damage to — the counter cycle from `roleCounter.ts`,
 *  re-exported here so UI code has a single place to import role-facing helpers from. */
export function rolePreyOf(role: Role): Role {
  return ROLE_PREY[role]
}
