// tests/engine/rt/determinism.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { simulateRt } from '@/game/engine/rt'
import { createRng } from '@/game/engine/rng'
import type { AbilityLine, Effect, RtUnitInput, SpellRt, Target, Trigger } from '@/types/rt'
import { unit } from './fixtures'

const TRIGGERS: Trigger[] = ['inizio', 'lancio', 'continuo', 'koSubito', 'koAlleato', 'koNemico', 'adiacenteLancia', 'squadraCura', 'sottoSoglia', 'ogniSecondi']
const TARGETS: Target[] = ['se', 'dietro', 'davanti', 'sinistra', 'destra', 'adiacenti', 'riga', 'tuttiAlleati', 'opposto', 'nemicoCasuale', 'tuttiNemici', 'primaFilaNemica', 'squadraNemica', 'squadraPropria']
const EFFECTS: Effect[] = [
  { kind: 'danno', potenza: 1 }, { kind: 'cura', n: 15 }, { kind: 'scudo', n: 20 }, { kind: 'segno', segno: 'fiamma', stacks: 2 }, { kind: 'segno', segno: 'veleno', stacks: 2 },
  { kind: 'segno', segno: 'scossa', stacks: 2 }, { kind: 'gelo', secondi: 1 }, { kind: 'silenzio', secondi: 2 }, { kind: 'lentezza', secondi: 2 }, { kind: 'disarmo' },
  { kind: 'carica', secondi: 1 }, { kind: 'innesco' }, { kind: 'multicast', n: 1, durata: 3 }, { kind: 'ko' }, { kind: 'protego' }, { kind: 'purifica' }, { kind: 'rianima' },
  { kind: 'dannoPct', pct: 0.2, durata: 'battaglia' }, { kind: 'cdFlat', secondi: -0.5 }, { kind: 'vulnerabile', secondi: 2 }, { kind: 'hpPct', pct: 0.1 }, { kind: 'immune', a: 'gelo' },
]
const VERBS: SpellRt[] = [
  { id: 'd', name: 'D', desc: '', verb: 'danno', potenza: 1.5 }, { id: 'f', name: 'F', desc: '', verb: 'danno', potenza: 1, segno: { kind: 'fiamma', stacks: 3 } },
  { id: 'v', name: 'V', desc: '', verb: 'danno', potenza: 0.5, segno: { kind: 'veleno', stacks: 2 } }, { id: 's', name: 'S', desc: '', verb: 'danno', potenza: 1, segno: { kind: 'scossa', stacks: 2 } },
  { id: 'g', name: 'G', desc: '', verb: 'status', gelo: 2 }, { id: 'c', name: 'C', desc: '', verb: 'cura', cura: 25 }, { id: 'k', name: 'K', desc: '', verb: 'scudo', scudo: 30 },
  { id: 'r', name: 'R', desc: '', verb: 'rianima' }, { id: 'p', name: 'P', desc: '', verb: 'protego' }, { id: 'a', name: 'A', desc: '', verb: 'carica', carica: { secondi: 1, target: 'adiacenti' } },
  { id: 'm', name: 'M', desc: '', verb: 'danno', potenza: 0.7, multicast: 2, crescita: { kind: 'crescendo', trigger: 'lancio', per: 0.1, unit: 'pct' } },
]

function randomSquad(seed: number): RtUnitInput[] {
  const rng = createRng(seed)
  const n = rng.int(1, 6)
  const slots = rng.shuffle([0, 1, 2, 3, 4, 5]).slice(0, n)
  return slots.map(slot => {
    const lines: AbilityLine[] = Array.from({ length: rng.int(0, 2) }, () => {
      const effect = rng.pick(EFFECTS)
      let target = rng.pick(TARGETS)
      // `dannoPct` su `squadraNemica` è rifiutato dal motore per design (va espresso come riga Continuo): il fuzz non lo genera.
      if (effect.kind === 'dannoPct' && target === 'squadraNemica') target = 'squadraPropria'
      return { trigger: rng.pick(TRIGGERS), target, effect, limit: { everySeconds: 3 } }
    })
    // id/name espliciti dal seed: `unit()` usa un contatore globale che renderebbe due squad "uguali" diverse.
    return unit({ id: `u${seed}s${slot}`, name: `U${seed}s${slot}`, slot, level: rng.int(1, 4) as 1 | 2 | 3 | 4, stats: { hp: rng.int(50, 160), atk: rng.int(10, 40), def: rng.int(5, 40), spd: rng.int(8, 38) }, spell: rng.pick(VERBS), ability: { id: `ab${slot}`, name: 'x', lines } })
  })
}

describe('fuzz e determinismo', () => {
  it('200 battaglie casuali: nessuna eccezione, sempre un vincitore, mai oltre 60 s', () => {
    for (let i = 0; i < 200; i++) {
      const r = simulateRt(randomSquad(i * 2 + 1), randomSquad(i * 2 + 2), createRng(1000 + i))
      expect(['left', 'right']).toContain(r.winner)
      expect(r.durata).toBeLessThanOrEqual(60)
      expect(r.frames.length).toBeGreaterThan(0)
    }
  })
  it('stesso seed → stessi eventi, seed diverso → prima o poi eventi diversi', () => {
    let diff = 0
    for (let i = 0; i < 30; i++) {
      const a = simulateRt(randomSquad(i), randomSquad(i + 500), createRng(i))
      const b = simulateRt(randomSquad(i), randomSquad(i + 500), createRng(i))
      expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events))
      const c = simulateRt(randomSquad(i), randomSquad(i + 500), createRng(i + 9999))
      if (JSON.stringify(c.events) !== JSON.stringify(a.events)) diff++
    }
    expect(diff).toBeGreaterThan(0)
  })
  it('prestazioni: 300 battaglie 6v6 in meno di 6 s', () => {
    const t0 = performance.now()
    for (let i = 0; i < 300; i++) simulateRt(randomSquad(7), randomSquad(8), createRng(i))
    expect(performance.now() - t0).toBeLessThan(6000)
  })
})
