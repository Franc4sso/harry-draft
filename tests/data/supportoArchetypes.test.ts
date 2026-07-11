import { describe, it, expect } from 'vitest'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'

const SUPPORTO = () => WIZARDS.filter(w => w.role === 'Supporto')

// A proactive spell has effect even at full team HP: Difesa (shield/ward/buff) or a
// self-buff (riddikulus/salvio = atkUp/spdUp on self) or a regen-over-time Cura (ferula).
// Spells needing a WOUNDED ALLY do NOT count as proactive: pure instant heals
// (episkey/vulnera/anapneo/rennervate) AND ally-targeted Cura riders (colletivo_scudo,
// incitamento) all fall to lowestHp(enemyPool) at full team HP, doing nothing useful.
const PROACTIVE = new Set(['protego', 'protego_maxima', 'fianto', 'aegis', 'expecto', 'riddikulus', 'salvio', 'ferula'])

describe('Supporto archetypes', () => {
  it('no Supporto carries a direct-attack spell', () => {
    const bad: string[] = []
    for (const w of SUPPORTO()) for (const s of w.spellPool ?? []) {
      const t = SPELL_BY_ID[s]?.type
      if (t === 'Attacco' || t === 'Controllo') bad.push(`${w.id}: ${s} (${t})`)
    }
    expect(bad, bad.join('\n')).toEqual([])
  })

  // UN MAGO, UNA MAGIA (Task 2): pools are now exactly 1 signature spell, chosen per-wizard
  // for role/flavor fit (see data/wizards.ts + .superpowers/sdd/task-2-report.md), not drawn
  // at random from a 4-6 spell pool. The old "no guaranteed dead turn" guarantee assumed a
  // multi-spell pool always contained a proactive fallback alongside a reactive heal — that
  // assumption is structurally impossible to keep for a single-spell healer archetype whose
  // authored identity spell IS an instant/reactive heal (episkey/anapneo/rennervate/vulnera)
  // or an ally-rider (incitamento). This is now an accepted, intentional tradeoff of the
  // single-signature redesign rather than a data bug: it's tracked here informationally so a
  // future task (event/relic support, alt-signature system, etc.) has a concrete list of
  // reactive-only Supporto to revisit if "full-HP dead turns" become a real balance issue.
  it('documents which Supporto have a reactive-only (non-proactive) signature', () => {
    const reactiveOnly = SUPPORTO().filter(w => !(w.spellPool ?? []).some(s => PROACTIVE.has(s))).map(w => w.id)
    expect(reactiveOnly).toEqual([
      'luna', 'molly', 'arthur', 'narcissa', 'slughorn', 'lavender',
      'marietta', 'hannah', 'susan', 'astoria', 'penelope',
    ])
  })

  it('serpensortia is gone from all Supporto pools', () => {
    const still = SUPPORTO().filter(w => (w.spellPool ?? []).includes('serpensortia')).map(w => w.id)
    expect(still, still.join(', ')).toEqual([])
  })
})
