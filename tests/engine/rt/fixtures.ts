import type { Ability, AbilityLine, RtUnitInput, SpellRt } from '@/types/rt'
import type { Stats } from '@/types/wizard'

export const STATS: Stats = { hp: 100, atk: 20, def: 10, spd: 20 }   // cd = 9 − 4 = 5 s

export function danno(potenza = 1, extra: Partial<SpellRt> = {}): SpellRt {
  return { id: `danno${potenza}`, name: 'Danno', desc: '', verb: 'danno', potenza, ...extra }
}
export function cura(n = 20, extra: Partial<SpellRt> = {}): SpellRt {
  return { id: `cura${n}`, name: 'Cura', desc: '', verb: 'cura', cura: n, ...extra }
}
export function scudo(n = 30, extra: Partial<SpellRt> = {}): SpellRt {
  return { id: `scudo${n}`, name: 'Scudo', desc: '', verb: 'scudo', scudo: n, ...extra }
}
export function status(extra: Partial<SpellRt>): SpellRt {
  return { id: 'status', name: 'Status', desc: '', verb: 'status', ...extra }
}
export function nulla(): SpellRt {
  // Verbo cura 0: lancia ma non fa nulla. Utile per unità "manichino".
  return { id: 'nulla', name: 'Nulla', desc: '', verb: 'cura', cura: 0, cdMod: 100 }
}

export function ability(lines: AbilityLine[], lv4?: AbilityLine, id = 'abil'): Ability {
  return { id, name: id, lines, lv4 }
}

let counter = 0
export function unit(over: Partial<RtUnitInput> = {}): RtUnitInput {
  counter += 1
  return {
    id: over.id ?? `u${counter}`,
    name: over.name ?? `Unità ${counter}`,
    house: 'Grifondoro', role: 'Attaccante', tier: 4, tags: [],
    stats: STATS, level: 1, slot: 0,
    spell: danno(1),
    ...over,
  }
}

/** Sei slot: passa fino a 6 override; `undefined` lascia lo slot vuoto. */
export function squad(...overs: (Partial<RtUnitInput> | undefined)[]): RtUnitInput[] {
  return overs.flatMap((o, slot) => (o ? [unit({ ...o, slot })] : []))
}
export function resetFixtureCounter() { counter = 0 }
