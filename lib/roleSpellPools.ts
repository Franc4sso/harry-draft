import type { Role } from '@/types'

// Allowed spell IDs per role — a STRUCTURAL guard so a wizard can never carry a spell that
// contradicts its role (e.g. a Supporto casting serpensortia). Conservative: derived from the
// current pools, cleaned of outliers. Supporto = only Cura/Difesa (zero direct attacks).
export const ROLE_SPELL_WHITELIST: Record<Role, ReadonlySet<string>> = {
  Supporto: new Set([
    'episkey', 'protego', 'vulnera', 'rennervate', 'anapneo', 'ferula',
    'protego_maxima', 'fianto', 'colletivo_scudo', 'aegis', 'expecto',
    'incitamento', 'riddikulus', 'salvio',
  ]),
  Tank: new Set([
    'bombarda', 'diffindo', 'expelliarmus', 'fianto', 'flipendo', 'oppugno',
    'protego', 'protego_maxima', 'reducto', 'salvio', 'stupeficium',
  ]),
  Attaccante: new Set([
    'avada', 'bombarda', 'confringo', 'crucio', 'diffindo', 'expelliarmus',
    'fiendfyre', 'flipendo', 'incendio', 'levicorpus', 'oppugno', 'reducto',
    'sectumsempra', 'serpensortia', 'stupeficium', 'base_attack',
  ]),
  Controllo: new Set([
    'confringo', 'confundo', 'crucio', 'fiendfyre', 'flipendo', 'imperio',
    'langlock', 'levicorpus', 'oppugno', 'petrificus', 'reducto', 'tarantallegra',
    'glacius', 'silencio',
  ]),
}

export function isSpellAllowedForRole(role: Role, spellId: string): boolean {
  // base_attack is the universal silence/disarm fallback — always allowed.
  if (spellId === 'base_attack') return true
  return ROLE_SPELL_WHITELIST[role]?.has(spellId) ?? false
}
