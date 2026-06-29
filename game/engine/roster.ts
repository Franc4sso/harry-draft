import type { DraftedWizard } from '@/types'

/** A wizard is dead when its persisted HP is 0 (undefined currentHp means full = alive). */
export function isDead(dw: DraftedWizard): boolean {
  return (dw.currentHp ?? dw.maxHp) <= 0
}

/** The living subset of a roster — the only wizards that field in combat. */
export function livingOf(team: DraftedWizard[]): DraftedWizard[] {
  return team.filter(dw => !isDead(dw))
}
