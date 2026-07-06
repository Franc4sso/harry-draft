import { describe, it, expect } from 'vitest'
import { WIZARDS } from '@/data/wizards'
import { SPELL_BY_ID } from '@/data/spells'

const SUPPORTO = () => WIZARDS.filter(w => w.role === 'Supporto')

// A proactive spell has effect even at full team HP: Difesa (shield/ward/buff) or a
// regen/buff Cura (ferula = regen-over-time; incitamento = atkUp). Pure instant heals
// (episkey/vulnera/anapneo/rennervate) do NOT count — they need a wounded ally.
const PROACTIVE = new Set(['protego', 'protego_maxima', 'fianto', 'colletivo_scudo', 'aegis', 'expecto', 'incitamento', 'riddikulus', 'salvio', 'ferula'])

describe('Supporto archetypes', () => {
  it('no Supporto carries a direct-attack spell', () => {
    const bad: string[] = []
    for (const w of SUPPORTO()) for (const s of w.spellPool ?? []) {
      const t = SPELL_BY_ID[s]?.type
      if (t === 'Attacco' || t === 'Controllo') bad.push(`${w.id}: ${s} (${t})`)
    }
    expect(bad, bad.join('\n')).toEqual([])
  })

  it('every Supporto has at least one proactive spell (no guaranteed dead turn)', () => {
    const dead: string[] = []
    for (const w of SUPPORTO()) {
      if (!(w.spellPool ?? []).some(s => PROACTIVE.has(s))) dead.push(w.id)
    }
    expect(dead, `no proactive spell: ${dead.join(', ')}`).toEqual([])
  })

  it('serpensortia is gone from all Supporto pools', () => {
    const still = SUPPORTO().filter(w => (w.spellPool ?? []).includes('serpensortia')).map(w => w.id)
    expect(still, still.join(', ')).toEqual([])
  })
})
