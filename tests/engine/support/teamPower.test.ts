import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { teamPower } from './teamPower'
import { powerOf } from '@/game/engine/combat/teamGen'
import { createRng } from '@/game/engine/rng'
import { draftWizard } from '@/game/engine/statRoll'
import { detectDuos, SIGNAL_TIERS } from '@/game/engine/duos'
import { WIZARDS } from '@/data/wizards'
import type { DraftedWizard } from '@/types'

function draft(id: string): DraftedWizard {
  const w = WIZARDS.find(x => x.id === id)!
  return draftWizard(createRng(`tp-${id}`), w, false)
}

/** Solo il contributo delle sinergie, al netto della potenza grezza: così i confronti
 *  non dipendono da quali maghi (più o meno forti) compongono la squadra. */
function bonus(team: DraftedWizard[]): number {
  return teamPower(team, []) - team.reduce((n, d) => n + powerOf(d), 0)
}

/** Il moltiplicatore sinergico puro — bonus in frazione della base. */
function mult(team: DraftedWizard[]): number {
  const base = team.reduce((n, d) => n + powerOf(d), 0)
  return base === 0 ? 0 : bonus(team) / base
}

const VELENO = SIGNAL_TIERS.find(t => t.tag === 'veleno')!

/** `need` maghi col tag veleno: accende il grado 2 (Tossicità). */
function veleno3(): DraftedWizard[] {
  return WIZARDS.filter(w => (w.tags ?? []).includes('veleno')).slice(0, VELENO.need).map(w => draft(w.id))
}

describe('teamPower', () => {
  it('senza sinergie attive vale la somma di powerOf', () => {
    const team = [draft(WIZARDS[0]!.id)]
    expect(teamPower(team, [])).toBeCloseTo(powerOf(team[0]!), 5)
  })

  it('una squadra vuota vale zero', () => {
    expect(teamPower([], [])).toBe(0)
  })

  it('un grado 2 acceso vale piu della somma grezza', () => {
    const team = veleno3()
    expect(teamPower(team, [])).toBeGreaterThan(team.reduce((n, d) => n + powerOf(d), 0))
  })

  it('2/3 di un grado 2 vale piu di 1/3 (credito parziale)', () => {
    const three = veleno3()
    expect(bonus(three.slice(0, 2))).toBeGreaterThan(bonus(three.slice(0, 1)))
  })

  it('completare il grado 2 vale piu che restare a 2/3', () => {
    const three = veleno3()
    expect(mult(three)).toBeGreaterThan(mult(three.slice(0, 2)))
  })

  // Guardia contro il falso-verde trovato in review: un semplice confronto
  // "coppia-con-Duo vs singolo" passa ANCHE senza la logica dei Duo, perché ogni
  // coppia che accende un Duo condivide per costruzione un tag, e il solo credito
  // parziale del grado 2 basta a superarlo. Questo test invece confronta due coppie
  // con IDENTICO credito di tag: l'unica differenza è il Duo.
  it('a parita di credito tag, una coppia che accende un Duo vale di piu', () => {
    const tagged = WIZARDS.filter(w => (w.tags ?? []).includes('scudirigen'))
    const tank = tagged.find(w => w.role === 'Tank')
    const nonTank = tagged.filter(w => w.role !== 'Tank')
    expect(tank, 'serve un Tank con tag scudirigen').toBeDefined()
    expect(nonTank.length, 'servono due non-Tank con tag scudirigen').toBeGreaterThanOrEqual(2)

    const withDuo = [draft(tank!.id), draft(nonTank[0]!.id)]
    const control = [draft(nonTank[0]!.id), draft(nonTank[1]!.id)]

    // Premessa del test: stessa quantità di tag, ma solo la prima accende un Duo.
    expect(detectDuos(withDuo, []).length).toBeGreaterThan(0)
    expect(detectDuos(control, []).length).toBe(0)

    expect(mult(withDuo)).toBeGreaterThan(mult(control))
  })

  it('nessun file di gioco importa teamPower (resta solo harness)', () => {
    const sources = (dir: string, out: string[] = []): string[] => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e)
        if (statSync(p).isDirectory()) sources(p, out)
        else if (/\.(ts|tsx)$/.test(e)) out.push(p)
      }
      return out
    }
    const offenders = ['game', 'lib', 'app', 'components']
      .flatMap(r => sources(r))
      .filter(f => /from\s+['"].*teamPower['"]/.test(readFileSync(f, 'utf8')))
    expect(offenders, "teamPower e' solo per l'harness; powerOf e' la nozione del motore").toEqual([])
  })
})
