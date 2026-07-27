import { describe, expect, it } from 'vitest'
import { SIGNATURES, SIGNATURE_BY_ID } from '@/data/signatures'
import { WIZARDS } from '@/data/wizards'

/**
 * Onda 1.d — potatura delle firme (difetto D4 di core-fun-direction).
 * Spec: docs/superpowers/specs/2026-07-27-onda-1d-potare-le-firme.md
 *
 * Il catalogo aveva 60 firme che si riducevano a ~12 meccaniche ripetute: 27 maghi di
 * Tier 4 con effetti +/-10% (invisibili in un auto-battler), due cloni ESATTI
 * (goyle/crabbe = "Stazza"), e "-10% danni subiti" sotto cinque nomi diversi.
 * Ora ne restano 15, una meccanica visibile ciascuna. Questi test sono il guard:
 * bloccano il ritorno del volume e dei cloni.
 */

/** I 15 sopravvissuti, scelti per DISTINTIVITA' (non per tier): ognuno fa a schermo
 *  qualcosa che il giocatore puo' nominare. Tier 1: 3/3 - Tier 2: 6/10 - Tier 3: 6/20
 *  - Tier 4: 0/27. */
const KEEP = [
  'dumbledore', 'voldemort', 'harry',
  'snape', 'bellatrix', 'mcgonagall', 'lupin', 'kingsley', 'fleur',
  'hermione', 'cho', 'molly', 'neville', 'luna', 'tonks',
]

/** Hook che producono un numero e basta: nessuna icona, nessun turno saltato, niente da
 *  raccontare. Una firma fatta SOLO di questi e' esattamente il difetto D4. */
const FLAT_HOOKS = ['modifyOutgoingDamage', 'modifyIncomingDamage', 'modifyHealing']

/** Unica eccezione ammessa alla regola "niente firme piatte": mcgonagall e' il pilastro
 *  Tank del roster e il suo -30% e' il singolo numero difensivo piu' grande del gioco.
 *  Ammessa per id, deliberatamente, cosi' che aggiungerne un'altra rompa il test. */
const FLAT_ALLOWED = ['mcgonagall']

describe('catalogo delle firme (Onda 1.d)', () => {
  it('contiene esattamente 15 firme', () => {
    expect(SIGNATURES).toHaveLength(15)
  })

  it('contiene esattamente i 15 maghi scelti', () => {
    expect(SIGNATURES.map(s => s.id).sort()).toEqual([...KEEP].sort())
  })

  it('non ha due firme con lo stesso nome (niente cloni)', () => {
    const names = SIGNATURES.map(s => s.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('nessuna firma e\' un solo modificatore piatto (tranne il pilastro Tank)', () => {
    const flat = SIGNATURES.filter(s => {
      const only = s.triggers.length === 1 ? s.triggers[0] : undefined
      return !!only && only.kind === 'modifier' && FLAT_HOOKS.includes(only.hook)
    })
    expect(flat.map(s => s.id)).toEqual(FLAT_ALLOWED)
  })

  it('ogni firma ha almeno un trigger', () => {
    for (const s of SIGNATURES) expect(s.triggers.length).toBeGreaterThan(0)
  })

  it('SIGNATURE_BY_ID rispecchia il catalogo', () => {
    expect(Object.keys(SIGNATURE_BY_ID).sort()).toEqual([...KEEP].sort())
  })
})

describe('la potatura NON tocca i maghi', () => {
  it('tutti e 60 i maghi restano nel roster', () => {
    expect(WIZARDS).toHaveLength(60)
  })

  it('un mago senza firma conserva casata, ruolo, tier e magia', () => {
    // goyle era meta' di un clone esatto ("Stazza" identica a crabbe): la firma sparisce,
    // il mago no.
    const goyle = WIZARDS.find(w => w.id === 'goyle')
    expect(goyle).toBeDefined()
    expect(SIGNATURE_BY_ID['goyle']).toBeUndefined()
    expect(goyle!.house).toBe('Serpeverde')
    expect(goyle!.role).toBe('Tank')
    expect(goyle!.spellPool.length).toBeGreaterThan(0)
  })

  it('i tag restano intatti: dolohov perde la firma ma NON il tag veleno', () => {
    // Garanzia della spec: Duo/Trii/Sinergie leggono tag+ruolo, mai le firme.
    const dolohov = WIZARDS.find(w => w.id === 'dolohov')
    expect(SIGNATURE_BY_ID['dolohov']).toBeUndefined()
    expect(dolohov!.tags).toContain('veleno')
  })

  it('il pool del tag veleno e\' intatto: 6 maghi, come prima della potatura', () => {
    // Misurato su master c81b6ce PRIMA della potatura: bellatrix, dolohov, greyback,
    // pansy, theodore, blaise. E' questo pool — non le firme — ad alimentare la Sinergia
    // Tossicita' e i segnali Duo, quindi la potatura non puo' toccarlo.
    const veleno = WIZARDS.filter(w => w.tags?.includes('veleno')).map(w => w.id).sort()
    expect(veleno).toEqual(['bellatrix', 'blaise', 'dolohov', 'greyback', 'pansy', 'theodore'])
  })

  it('il veleno resta applicabile in combattimento dopo la potatura', () => {
    // Scoperta della slice: snape e draco NON hanno il tag veleno — il loro veleno era
    // solo firma. Dopo la potatura l'unica firma che avvelena e' quella di snape, ma
    // draco e lucius continuano ad avvelenare lanciando `serpensortia` (spellPool
    // intatto). L'archetipo veleno regge; cade solo la firma-veleno di dolohov.
    expect(SIGNATURE_BY_ID['snape']).toBeDefined()
    for (const id of ['draco', 'lucius']) {
      expect(WIZARDS.find(w => w.id === id)!.spellPool).toContain('serpensortia')
    }
  })
})
