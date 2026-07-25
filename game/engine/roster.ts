import type { DraftedWizard } from '@/types'

/** A wizard is dead when its persisted HP is 0 (undefined currentHp means full = alive). */
export function isDead(dw: DraftedWizard): boolean {
  return (dw.currentHp ?? dw.maxHp) <= 0
}

/** The living subset of a roster — the only wizards that field in combat. */
export function livingOf(team: DraftedWizard[]): DraftedWizard[] {
  return team.filter(dw => !isDead(dw))
}

/** I tag EFFETTIVI di un mago arruolato: quelli nativi del `Wizard` più quelli concessi a
 *  runtime (`grantedTags` — il Marchio delle Spoglie della Vittoria). Deduplicato, con ordine
 *  deterministico: prima i nativi nel loro ordine, poi i concessi nell'ordine di concessione.
 *
 *  REGOLA: un tag concesso conta ESATTAMENTE come uno nativo, ovunque. Ogni lettura dei tag di
 *  un `DraftedWizard` deve passare di qui — se un sito legge ancora `d.wizard.tags` da solo, la
 *  UI e il motore divergono (il giocatore vede "CANCRENA attiva" e la Duo non si accende).
 *  Vive in roster.ts perché è una query pura su un DraftedWizard, senza dipendenze verso
 *  duos/synergy: così duos.ts, synergy.ts, darkMagic.ts e alwaysHit.ts possono importarla
 *  tutte senza creare cicli. Pura; nessun RNG. */
export function tagsOf(d: DraftedWizard): string[] {
  const out: string[] = []
  for (const t of d.wizard.tags ?? []) if (!out.includes(t)) out.push(t)
  for (const t of d.grantedTags ?? []) if (!out.includes(t)) out.push(t)
  return out
}
