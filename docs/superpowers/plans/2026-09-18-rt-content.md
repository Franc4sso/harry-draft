# Contenuti Showdown — Piano 2: spell, abilità, tratti, reliquie, adapter

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dare al motore rt (Piano 1, `game/engine/rt/`) tutto il contenuto reale del gioco — 37 spell con Segni/Combo/Crescita, 60 abilità con cooldown, 16 tratti shiny, 40 reliquie e i Duo/Trio/archetipi come `RtSideMods` — più l'adapter che trasforma una squadra di `DraftedWizard` in input del motore, senza toccare il motore vecchio né il run layer.

**Architecture:** Dati nuovi in file nuovi (`data/spellsRt.ts`, `data/rtLoadout.ts`, `data/abilities/*.ts`, `data/traitsRt.ts`, `data/relicsRt.ts`) che parlano il vocabolario di `types/rt.ts`; `data/wizards.ts`, `data/spells.ts`, `data/relics.ts`, `data/traits.ts` restano intatti (il motore vecchio li usa). L'adapter `game/engine/rt/adapter/` legge i dati vecchi (stat, tag, reliquie attive, Duo) e quelli nuovi e produce `RtUnitInput[]` + `RtSideMods`. Il run layer (Piano 3) chiamerà `simulateTeams`.

**Tech Stack:** TypeScript 5, vitest 4 (progetto `rt` = node per `tests/engine/rt/**`, il resto jsdom). Nessuna dipendenza nuova.

**Spec:** `docs/superpowers/specs/2026-09-17-showdown-redesign-design.md` (§4.2–4.5, §5, §5.0, §6.1–6.3, §7.1–7.2, §8.2). Il Piano 1 (`docs/superpowers/plans/2026-09-17-rt-engine.md`) è la fonte per i tipi del motore.

## Global Constraints

- Regola utente (spec §5.0): **ogni riga con trigger `lancio` dichiara un cooldown** `limit.everySeconds > 0`, oppure `limit.perBattle`, oppure l'opt-out esplicito `limit.senzaCooldown: true`. Un test dati lo impone.
- Budget per rarità (spec §5.0): T1 = 2 righe lv1 incondizionate; T2 = 2 righe (una può avere `cond`); T3 = 1–2 righe (la seconda con `cond`); T4 = 1 riga lv1. Tutti hanno `lv4`. Le righe `vittoria` non contano nel budget. Un test dati lo impone.
- Riassegnazione mago → spell (spec §4.5) in `data/rtLoadout.ts`: ogni casa ha ≥2 applicatori del proprio Segno, ≥2 detonatori, ≥1 sostegno. Ruolo → verbo: Attaccante = `danno`, Tank = `scudo`|`protego`, Supporto = `cura`|`carica`|`rianima`, Controllo = `status`. Un test dati lo impone.
- Le righe Continuo non possono avere `target: 'opposto' | 'nemicoCasuale'` (il motore le ignora) e il loro `cond` non può essere `chance` se non si vuole la pre-risoluzione una volta per battaglia. Le righe `lancio` con `cond: { bersaglio }` o `target: 'adiacenteDelBersaglio'` non hanno un bersaglio nel contesto: vietate (test dati).
- `data/wizards.ts`, `data/spells.ts`, `data/relics.ts`, `data/traits.ts`, `game/engine/combat/*` **non si toccano**.
- Ogni file di test in `tests/engine/rt/` inizia con `// @vitest-environment node`; quelli in `tests/data/` girano sotto jsdom come oggi (sono puri).
- Determinismo: nessun `Date`/`Math.random`. `npm run typecheck` prima di ogni commit. Commit in italiano: `feat(rt-content): …` / `test(rt-content): …`.
- Adapter: le stat entrano già "bonificate" dalle reliquie via `applyRelicBonuses(stats, team, relics, wizardId)` (esiste in `game/engine/relics.ts`); il livello è `clamp(dw.level ?? 1, 1, 4)` finché il Piano 3 non introduce il merge.

---

## Struttura dei file

| File | Responsabilità |
|---|---|
| `types/rt.ts` (Modify) | `limit.senzaCooldown`, `AbilityLine.desc`, `Ability.desc`, `RelicRt`, `RtRunExtras` |
| `data/spellsRt.ts` | 37 `SpellRt` + `SPELL_RT_BY_ID` |
| `data/rtLoadout.ts` | `RT_SPELL_BY_WIZARD: Record<wizardId, spellRtId>` (60) |
| `data/abilities/util.ts` | builder `riga(...)` |
| `data/abilities/grifondoro.ts` … `tassorosso.ts` | 19 + 17 + 13 + 11 `Ability` |
| `data/abilities/index.ts` | `ABILITIES`, `ABILITY_BY_ID` |
| `data/traitsRt.ts` | 16 tratti shiny → `AbilityLine[]` (extraLines del portatore) |
| `data/relicsRt.ts` | 40 reliquie → `RelicRt` (mods di lato, righe di lato, righe del portatore) |
| `game/engine/rt/adapter/unit.ts` | `fromDrafted(dw, slot, team, relics, extras?)` |
| `game/engine/rt/adapter/sideMods.ts` | `sideModsFor(team, relics)` (Duo, Trio, archetipi, reliquie) |
| `game/engine/rt/adapter/index.ts` | `simulateTeams(...)`, re-export |
| `tests/data/rtContent.test.ts` | validazione dati (spell, loadout, abilità, cooldown, budget, tratti, reliquie) |
| `tests/engine/rt/adapter.test.ts`, `tests/engine/rt/content.test.ts` | adapter + smoke/catene sul contenuto reale |

---

### Task 1: Tipi, spell rt e loadout

**Files:**
- Modify: `types/rt.ts`
- Create: `data/spellsRt.ts`, `data/rtLoadout.ts`
- Test: `tests/data/rtContent.test.ts` (prima parte)

**Interfaces:**
- Produces: `AbilityLine.limit: { perBattle?; everySeconds?; senzaCooldown?: true }`, `AbilityLine.desc?: string`, `Ability.desc?: string`; `RelicRt`, `RtRunExtras` (vedi Step 1); `SPELLS_RT: SpellRt[]`, `SPELL_RT_BY_ID: Record<string, SpellRt>`; `RT_SPELL_BY_WIZARD: Record<string, string>`.

- [ ] **Step 1: Tipi**

In `types/rt.ts`:
```ts
// in AbilityLine: sostituire la riga `limit?: …` con
  limit?: { perBattle?: number; everySeconds?: number; /** opt-out esplicito della regola "ogni riga Al lancio ha un cooldown" */ senzaCooldown?: true }
  /** Testo per la UI (una frase). */
  desc?: string
// in Ability: aggiungere
  desc?: string
// in fondo al file:
/** Traduzione rt di una reliquia (i bonus alle stat restano in applyRelicBonuses). */
export interface RelicRt {
  id: string
  mods?: Partial<RtSideMods>
  /** Righe di lato (attore = lato). */
  lines?: AbilityLine[]
  /** Righe del portatore (solo reliquie `assignable`): finiscono in `extraLines` del mago assegnato. */
  carrierLines?: AbilityLine[]
}
/** Dati di run che il Piano 3 aggiungerà a DraftedWizard; l'adapter li accetta a parte finché non esistono. */
export interface RtRunExtras { memoria?: Record<string, number>; permanenti?: { dannoFlat?: number; dannoPct?: number } }
```

- [ ] **Step 2: Test dati (spell + loadout)**

```ts
// tests/data/rtContent.test.ts
import { describe, it, expect } from 'vitest'
import { SPELLS_RT, SPELL_RT_BY_ID } from '@/data/spellsRt'
import { RT_SPELL_BY_WIZARD } from '@/data/rtLoadout'
import { WIZARDS } from '@/data/wizards'

const VERB_BY_ROLE = { Attaccante: ['danno'], Tank: ['scudo', 'protego'], Supporto: ['cura', 'carica', 'rianima'], Controllo: ['status'] } as const

describe('spell rt', () => {
  it('38 spell con id unici e verbo valido', () => {
    expect(SPELLS_RT.length).toBe(38)
    expect(new Set(SPELLS_RT.map(s => s.id)).size).toBe(38)
    for (const s of SPELLS_RT) expect(['danno', 'cura', 'scudo', 'status', 'carica', 'protego', 'rianima', 'buff']).toContain(s.verb)
  })
  it('danno ha potenza, cura ha cura, scudo ha scudo, status ha almeno un effetto', () => {
    for (const s of SPELLS_RT) {
      if (s.verb === 'danno') expect(s.potenza, s.id).toBeGreaterThan(0)
      if (s.verb === 'cura') expect(s.cura, s.id).toBeGreaterThan(0)
      if (s.verb === 'scudo') expect(s.scudo, s.id).toBeGreaterThan(0)
      if (s.verb === 'status') expect(!!(s.segno || s.gelo || s.unitStatus || s.teamStatus), s.id).toBe(true)
    }
  })
  it('circa un terzo Memoria senza cap, un terzo Crescendo, un terzo sicure', () => {
    const mem = SPELLS_RT.filter(s => s.crescita?.kind === 'memoria').length
    const cre = SPELLS_RT.filter(s => s.crescita?.kind === 'crescendo').length
    const none = SPELLS_RT.filter(s => !s.crescita).length
    expect(mem).toBeGreaterThanOrEqual(9); expect(cre).toBeGreaterThanOrEqual(8); expect(none).toBeGreaterThanOrEqual(9)
    expect(SPELLS_RT.filter(s => s.crescita?.kind === 'memoria' && s.crescita.cap === undefined).length).toBeGreaterThanOrEqual(7)
  })
})

describe('loadout rt (mago → spell)', () => {
  it('ogni mago ha una spell rt esistente e il verbo rispetta il ruolo', () => {
    for (const w of WIZARDS) {
      const id = RT_SPELL_BY_WIZARD[w.id]
      expect(id, w.id).toBeTruthy()
      const s = SPELL_RT_BY_ID[id!]
      expect(s, `${w.id} → ${id}`).toBeTruthy()
      expect(VERB_BY_ROLE[w.role] as readonly string[], `${w.id} (${w.role}) → ${s!.verb}`).toContain(s!.verb)
    }
    expect(Object.keys(RT_SPELL_BY_WIZARD).length).toBe(WIZARDS.length)
  })
  it('ogni casa: ≥2 applicatori del proprio Segno, ≥2 detonatori, ≥1 sostegno', () => {
    const SEGNO = { Grifondoro: ['fiamma'], Serpeverde: ['veleno'], Corvonero: ['scossa', 'gelo'], Tassorosso: ['scudo'] } as const
    for (const house of ['Grifondoro', 'Serpeverde', 'Corvonero', 'Tassorosso'] as const) {
      const spells = WIZARDS.filter(w => w.house === house).map(w => SPELL_RT_BY_ID[RT_SPELL_BY_WIZARD[w.id]!]!)
      const applies = (s: typeof spells[number]) => (SEGNO[house] as readonly string[]).some(k =>
        k === 'gelo' ? !!s.gelo : k === 'scudo' ? (!!s.scudo || s.verb === 'protego' || s.combo?.effect.kind === 'scudo') : s.segno?.kind === k)
      const detonator = (s: typeof spells[number]) => s.verb === 'danno' && !s.segno
      const support = (s: typeof spells[number]) => ['cura', 'carica', 'rianima'].includes(s.verb)
      expect(spells.filter(applies).length, `${house} applicatori`).toBeGreaterThanOrEqual(2)
      expect(spells.filter(detonator).length, `${house} detonatori`).toBeGreaterThanOrEqual(2)
      expect(spells.filter(support).length, `${house} sostegno`).toBeGreaterThanOrEqual(1)
    }
  })
})
```

- [ ] **Step 3: Eseguire → FAIL** (`npx vitest run tests/data/rtContent.test.ts`: moduli mancanti).

- [ ] **Step 4: `data/spellsRt.ts`**

```ts
// data/spellsRt.ts — catalogo spell del motore rt (spec §4.4). UN MAGO UNA MAGIA: l'assegnazione è in data/rtLoadout.ts.
import type { SpellRt } from '@/types/rt'

const S = (s: SpellRt) => s

export const SPELLS_RT: SpellRt[] = [
  // ── Applicatori ──────────────────────────────────────────────────────────────
  S({ id: 'incendio', name: 'Incendio', desc: 'Fiamme che bruciano nel tempo. Crescendo: +1 Fiamma per ogni cast precedente.', verb: 'danno', potenza: 1.2, segno: { kind: 'fiamma', stacks: 3 }, crescita: { kind: 'crescendo', trigger: 'lancio', per: 1, unit: 'segno' } }),
  S({ id: 'confringo', name: 'Confringo', desc: 'Esplosione ardente. Memoria: +1 Fiamma ogni 5 Deflagrazioni.', verb: 'danno', potenza: 1.9, segno: { kind: 'fiamma', stacks: 2 }, crescita: { kind: 'memoria', trigger: 'reazione:deflagrazione', per: 0.2, unit: 'segno' } }),
  S({ id: 'fiendfyre', name: 'Ardemonio', desc: 'Fuoco maledetto: cinque Fiamme in un colpo, cooldown lungo.', verb: 'danno', potenza: 2.8, cdMod: 1, segno: { kind: 'fiamma', stacks: 5 }, keywords: ['magieOscure'] }),
  S({ id: 'serpensortia', name: 'Serpensortia', desc: 'Un serpente velenoso. Memoria: +1 Veleno ogni 3 Miasma.', verb: 'danno', potenza: 0.45, segno: { kind: 'veleno', stacks: 2 }, crescita: { kind: 'memoria', trigger: 'reazione:miasma', per: 1 / 3, unit: 'segno' } }),
  S({ id: 'oppugno', name: 'Oppugno', desc: 'Uno stormo che becca. Crescendo: +1 Veleno ogni 2 cast.', verb: 'danno', potenza: 1.5, segno: { kind: 'veleno', stacks: 1 }, crescita: { kind: 'crescendo', trigger: 'lancio', per: 0.5, unit: 'segno' } }),
  S({ id: 'crucio', name: 'Crucio', desc: 'Dolore che scuote i nervi. Crescendo: +1 Scossa per cast consecutivo senza subire Gelo.', verb: 'danno', potenza: 0.8, segno: { kind: 'scossa', stacks: 3 }, crescita: { kind: 'crescendo', trigger: 'lancioSenzaGelo', per: 1, unit: 'segno' } }),
  S({ id: 'baubillious', name: 'Baubillious', desc: 'Un fulmine giallo. Memoria: +1 Scossa ogni 5 Frantuma.', verb: 'danno', potenza: 1.4, segno: { kind: 'scossa', stacks: 2 }, crescita: { kind: 'memoria', trigger: 'reazione:frantuma', per: 0.2, unit: 'segno' } }),
  S({ id: 'fulgari', name: 'Fulgari', desc: 'Corde di fulmine: Scossa e Lentezza.', verb: 'status', segno: { kind: 'scossa', stacks: 3 }, unitStatus: { kind: 'lentezza', secondi: 1.5 } }),
  S({ id: 'glacius', name: 'Glacius', desc: 'Gelo secco: il bersaglio si ferma.', verb: 'status', gelo: 2.4 }),
  S({ id: 'petrificus', name: 'Petrificus Totalus', desc: 'Pietrifica e rallenta.', verb: 'status', gelo: 1.8, unitStatus: { kind: 'lentezza', secondi: 1 } }),
  S({ id: 'stupeficium', name: 'Stupeficium', desc: 'Un lampo rosso che gela. Memoria: +0,1 s di Gelo per vittoria (max 2 s).', verb: 'danno', potenza: 1.6, gelo: 1, crescita: { kind: 'memoria', trigger: 'vittoria', per: 0.1, cap: 2, unit: 'secondi' } }),
  S({ id: 'imperio', name: 'Imperio', desc: 'Piega la volontà. Crescendo: ogni 2° cast anche Silenzio 2 s.', verb: 'status', cdMod: 1, gelo: 2.5, combo: { cond: { ogniNLanci: 2 }, effect: { kind: 'silenzio', secondi: 2 } } }),
  // ── Detonatori ───────────────────────────────────────────────────────────────
  S({ id: 'reducto', name: 'Reducto', desc: 'Riduce in polvere. Frantuma ×2,5. Memoria: +10% danno per Frantuma.', verb: 'danno', potenza: 1.8, frantumaMult: 2.5, crescita: { kind: 'memoria', trigger: 'reazione:frantuma', per: 0.1, unit: 'pct' } }),
  S({ id: 'diffindo', name: 'Diffindo', desc: 'Due tagli. Combo: se il nemico è Scosso, +1 Scossa. Crescendo: +1 colpo ogni 3 cast.', verb: 'danno', potenza: 0.7, multicast: 2, combo: { cond: { segnoNemico: { segno: 'scossa', min: 1 } }, effect: { kind: 'segno', segno: 'scossa', stacks: 1 }, target: 'squadraNemica' }, crescita: { kind: 'crescendo', trigger: 'lancio', per: 1 / 3, unit: 'colpi' } }),
  S({ id: 'bombarda', name: 'Bombarda', desc: 'Esplosione secca, con una scintilla.', verb: 'danno', potenza: 2.4, segno: { kind: 'fiamma', stacks: 1 } }),
  S({ id: 'avada', name: 'Avada Kedavra', desc: 'La maledizione che uccide: sotto il 25% di HP nemica, KO all\'opposto. Memoria: −0,3 s di cooldown per KO fatto.', verb: 'danno', potenza: 3.2, cdMod: 2, keywords: ['magieOscure'], combo: { cond: { hpNemicaSotto: 0.25 }, effect: { kind: 'ko' }, target: 'opposto' }, crescita: { kind: 'memoria', trigger: 'ko', per: 0.3, unit: 'cd' } }),
  S({ id: 'sectumsempra', name: 'Sectumsempra', desc: 'Taglio oscuro che lascia Vulnerabile. Memoria: +2 danno per vittoria.', verb: 'danno', potenza: 2.4, keywords: ['magieOscure'], teamStatus: { kind: 'vulnerabile', secondi: 2 }, crescita: { kind: 'memoria', trigger: 'vittoria', per: 2, unit: 'danno' } }),
  S({ id: 'expelliarmus', name: 'Expelliarmus', desc: 'Disarma. Combo: entro 2 s da un Gelo alleato, Silenzio 2 s. Memoria: +1 danno per Disarmo riuscito.', verb: 'danno', potenza: 1.4, unitStatus: { kind: 'disarmo' }, combo: { cond: { entroSecondiDa: { evento: 'gelo', secondi: 2 } }, effect: { kind: 'silenzio', secondi: 2 } }, crescita: { kind: 'memoria', trigger: 'disarmo', per: 1, unit: 'danno' } }),
  S({ id: 'levicorpus', name: 'Levicorpus', desc: 'Solleva per la caviglia: Sospeso. Crescendo: +0,5 s per cast.', verb: 'status', unitStatus: { kind: 'sospeso', secondi: 3 }, crescita: { kind: 'crescendo', trigger: 'lancio', per: 0.5, unit: 'secondi' } }),
  S({ id: 'tarantallegra', name: 'Tarantallegra', desc: 'Gambe fuori controllo. Combo: se il nemico è Scosso, crampi: Gelo 1 s.', verb: 'status', unitStatus: { kind: 'lentezza', secondi: 2.4 }, combo: { cond: { segnoNemico: { segno: 'scossa', min: 1 } }, effect: { kind: 'gelo', secondi: 1 } } }),
  S({ id: 'confundo', name: 'Confundo', desc: 'Confonde: Lentezza e Vulnerabile. Memoria: +0,2 s di Vulnerabile per vittoria.', verb: 'status', unitStatus: { kind: 'lentezza', secondi: 1.5 }, teamStatus: { kind: 'vulnerabile', secondi: 2 }, crescita: { kind: 'memoria', trigger: 'vittoria', per: 0.2, unit: 'secondi' } }),
  S({ id: 'langlock', name: 'Langlock', desc: 'Lingua al palato: Silenzio. Crescendo: +0,5 s per cast.', verb: 'status', unitStatus: { kind: 'silenzio', secondi: 3 }, crescita: { kind: 'crescendo', trigger: 'lancio', per: 0.5, unit: 'secondi' } }),
  S({ id: 'silencio', name: 'Silencio', desc: 'Silenzio e Indebolimento.', verb: 'status', unitStatus: { kind: 'silenzio', secondi: 2.4 }, combo: { cond: { ogniNLanci: 1 }, effect: { kind: 'indebolito', pct: 0.2, secondi: 3 } } }),
  S({ id: 'flipendo', name: 'Flipendo', desc: 'Spinta rapida, cooldown corto. Crescendo: +5% danno per cast.', verb: 'danno', potenza: 1.1, cdMod: -1, unitStatus: { kind: 'lentezza', secondi: 1 }, crescita: { kind: 'crescendo', trigger: 'lancio', per: 0.05, unit: 'pct' } }),
  // ── Sostegno ─────────────────────────────────────────────────────────────────
  S({ id: 'episkey', name: 'Episkey', desc: 'Cura sicura.', verb: 'cura', cura: 34 }),
  S({ id: 'vulnera', name: 'Vulnera Sanentur', desc: 'Richiude le ferite. Memoria: +4 cura per vittoria.', verb: 'cura', cura: 48, crescita: { kind: 'memoria', trigger: 'vittoria', per: 4, unit: 'cura' } }),
  S({ id: 'anapneo', name: 'Anapneo', desc: 'Libera il respiro: cura e Purifica un alleato adiacente.', verb: 'cura', cura: 26, combo: { cond: { ogniNLanci: 1 }, effect: { kind: 'purifica' }, target: 'adiacenti' } }),
  S({ id: 'aguamenti', name: 'Aguamenti', desc: 'Getto d\'acqua: cura, un po\' di Scudo e spegne la Fiamma sulla propria squadra. Memoria: +2 cura per battaglia.', verb: 'cura', cura: 18, combo: { cond: { ogniNLanci: 1 }, effect: { kind: 'rimuoviSegnoProprio', segno: 'fiamma' }, target: 'squadraPropria' }, crescita: { kind: 'memoria', trigger: 'battaglia', per: 2, unit: 'cura' } }),
  S({ id: 'ferula', name: 'Ferula', desc: 'Bende e stecche: cura e Scudo.', verb: 'cura', cura: 17, combo: { cond: { ogniNLanci: 1 }, effect: { kind: 'scudo', n: 18 }, target: 'squadraPropria' } }),
  S({ id: 'fianto', name: 'Fianto Duri', desc: 'Scudo solido.', verb: 'scudo', scudo: 48 }),
  S({ id: 'aegis', name: 'Aegis', desc: 'Scudo grande, cooldown lungo. Memoria: +5 Scudo per battaglia combattuta.', verb: 'scudo', scudo: 60, cdMod: 1, crescita: { kind: 'memoria', trigger: 'battaglia', per: 5, unit: 'scudo' } }),
  S({ id: 'protego', name: 'Protego', desc: 'Protego a un alleato adiacente (o a sé).', verb: 'protego' }),
  S({ id: 'protego_maxima', name: 'Protego Maxima', desc: 'Protego a tutta la squadra. Memoria: −0,5 s di cooldown per boss battuto.', verb: 'protego', cdMod: 3, combo: { cond: { ogniNLanci: 1 }, effect: { kind: 'protego' }, target: 'tuttiAlleati' }, crescita: { kind: 'memoria', trigger: 'boss', per: 0.5, unit: 'cd' } }),
  S({ id: 'incitamento', name: 'Incitamento', desc: 'Cura leggera e Carica l\'alleato davanti. Crescendo: +0,25 s di Carica per cast.', verb: 'cura', cura: 8, combo: { cond: { ogniNLanci: 1 }, effect: { kind: 'carica', secondi: 1 }, target: 'davanti' }, crescita: { kind: 'crescendo', trigger: 'lancio', per: 0.25, unit: 'secondi' } }),
  S({ id: 'salvio', name: 'Salvio Hexia', desc: 'Carica 0,5 s agli adiacenti. Memoria: +0,05 s per vittoria.', verb: 'carica', carica: { secondi: 0.5, target: 'adiacenti' }, crescita: { kind: 'memoria', trigger: 'vittoria', per: 0.05, unit: 'secondi' } }),
  S({ id: 'expecto', name: 'Expecto Patronum', desc: 'Scudo e Carica agli adiacenti. Crescendo: +0,25 s di Carica per cast.', verb: 'scudo', scudo: 30, combo: { cond: { ogniNLanci: 1 }, effect: { kind: 'carica', secondi: 1 }, target: 'adiacenti' }, crescita: { kind: 'crescendo', trigger: 'lancio', per: 0.25, unit: 'secondi' } }),
  S({ id: 'rennervate', name: 'Rennervate', desc: 'Rianima l\'alleato KO con lo slot più basso; se nessuno, cura 20.', verb: 'rianima', cdMod: 4 }),
  S({ id: 'riddikulus', name: 'Riddikulus', desc: '+15% danno alla squadra per il resto della battaglia (max 3).', verb: 'buff', buff: { dannoPct: 0.15, max: 3 } }),
]

export const SPELL_RT_BY_ID: Record<string, SpellRt> = Object.fromEntries(SPELLS_RT.map(s => [s.id, s]))
```
Note di traduzione rispetto a §4.4 (decisioni prese qui, non da rifare): Ardemonio perde "la Fiamma non decade 2 s" (nessun effetto di spell lo esprime) e resta una "sicura" forte; Vulnera perde "Baluardo ×2" (non esprimibile) e tiene Cura 48 + Memoria; Levicorpus è verbo `status` (Parvati e Padma sono Controllo); `expecto` è verbo `scudo` e va ai Tank (Moody), Lupin (Supporto) prende `salvio`; Lucius (Attaccante) prende `bombarda` e Dolohov `confringo`, così Serpeverde ha due traditori 🔥 per il Miasma in mono-casa e il ❄ lo porta Bellatrix con l'abilità.

- [ ] **Step 5: `data/rtLoadout.ts`**

```ts
// data/rtLoadout.ts — UN MAGO UNA MAGIA per il motore rt (spec §4.5). data/wizards.ts resta intatto per il motore vecchio.
export const RT_SPELL_BY_WIZARD: Record<string, string> = {
  // Grifondoro (🔥 seamus, dean · ❄ dumbledore, sirius)
  harry: 'expelliarmus', dumbledore: 'petrificus', mcgonagall: 'protego_maxima', sirius: 'stupeficium', lupin: 'salvio', moody: 'expecto',
  hermione: 'confundo', ron: 'protego', ginny: 'reducto', neville: 'fianto', fred: 'tarantallegra', george: 'diffindo', molly: 'episkey',
  arthur: 'incitamento', hagrid: 'fianto', seamus: 'incendio', dean: 'confringo', parvati: 'levicorpus', lavender: 'anapneo',
  // Serpeverde (☠ draco, blaise · ⚡ bellatrix · 🔥 lucius, dolohov)
  voldemort: 'avada', snape: 'sectumsempra', bellatrix: 'crucio', lucius: 'bombarda', draco: 'serpensortia', narcissa: 'vulnera',
  dolohov: 'confringo', greyback: 'fianto', slughorn: 'anapneo', pansy: 'langlock', goyle: 'fianto', crabbe: 'aegis', marcus: 'reducto',
  pettigrew: 'rennervate', theodore: 'silencio', blaise: 'oppugno', astoria: 'episkey',
  // Corvonero (⚡ flitwick, michael · ❄ cho, terry · 🔥 lo porta Fleur con l'abilità)
  kingsley: 'aegis', fleur: 'expelliarmus', viktor: 'reducto', luna: 'aguamenti', cho: 'glacius', flitwick: 'fulgari', padma: 'levicorpus',
  terry: 'petrificus', michael: 'baubillious', roger: 'fianto', marietta: 'anapneo', anthony: 'protego', penelope: 'incitamento',
  // Tassorosso (⛨ sprout, ernie, eloise · ❄ megan, cedric)
  tonks: 'confundo', cedric: 'stupeficium', sprout: 'ferula', hannah: 'episkey', susan: 'rennervate', ernie: 'protego', justin: 'flipendo',
  zacharias: 'langlock', leanne: 'tarantallegra', eloise: 'fianto', megan: 'petrificus',
}
```
`imperio` resta nel catalogo senza portatore (contenuto per nemici/boss futuri: Voldemort forza `avada`, il leader alternativo può forzare `imperio`). Il test "ogni casa…" conta `imperio` solo se assegnato.

- [ ] **Step 6: Eseguire → PASS**; `npm run typecheck`.

- [ ] **Step 7: Commit**
```bash
git add types/rt.ts data/spellsRt.ts data/rtLoadout.ts tests/data/rtContent.test.ts
git commit -m "feat(rt-content): 37 spell rt con Segni, Combo e Crescita; loadout mago→spell"
```

---

### Task 2: Abilità — builder e Grifondoro (19)

**Files:**
- Create: `data/abilities/util.ts`, `data/abilities/grifondoro.ts`
- Test: `tests/data/rtContent.test.ts` (aggiunge il blocco "abilità: regole generali", che dal Task 4 vale su tutte le case)

**Interfaces:**
- Produces: `riga(trigger, target, effect, extra?)`, `cd(s)`, `una(n=1)`, `libera()` in `util.ts`; `GRIFONDORO: Ability[]`.
- Convenzioni: `params` = numeri lv1–3; `lv4` = riga nuova; le righe `vittoria` sono lette dal run layer (Piano 3): `target` = chi riceve il bonus permanente, `effect` = `dannoFlat` | `dannoPct`.

Regole di design applicate (spec §5.0 + regola utente): ogni riga `lancio` ha `cd(n)` oppure `una()` oppure `libera()` (solo per identità piccole: +1 Segno condizionato). Le "ultimate" sono `una()` (una volta per battaglia) o `sottoSoglia` (che scatta una volta per natura). Le righe che nel §5 erano "Al lancio: +X% se…" diventano `continuo` con `cond` (niente cooldown: il bonus vale finché la condizione tiene).

- [ ] **Step 1: Builder**

```ts
// data/abilities/util.ts
import type { AbilityLine, Cond, Effect, Target, Trigger } from '@/types/rt'

type Extra = { params?: [number, number, number]; targetArg?: string; cond?: Cond; limit?: AbilityLine['limit']; desc?: string }
export const riga = (trigger: Trigger, target: Target, effect: Effect, extra: Extra = {}): AbilityLine => ({ trigger, target, effect, ...extra })
/** Cooldown in secondi per le righe "Al lancio". */
export const cd = (s: number): AbilityLine['limit'] => ({ everySeconds: s })
/** Una (o n) volta per battaglia. */
export const una = (n = 1): AbilityLine['limit'] => ({ perBattle: n })
/** Opt-out esplicito del cooldown: solo per identità piccole. */
export const libera = (): AbilityLine['limit'] => ({ senzaCooldown: true })
```

- [ ] **Step 2: Test regole generali (già scritto per tutte le case; al Task 2 `ABILITIES` contiene solo Grifondoro — importare da `data/abilities/grifondoro` finché `index.ts` non esiste, poi cambiare l'import nel Task 4)**

```ts
// tests/data/rtContent.test.ts — aggiungere
import { GRIFONDORO } from '@/data/abilities/grifondoro'
import { WIZARD_BY_ID } from '@/data/wizards'
import type { Ability, AbilityLine } from '@/types/rt'

const ABILITIES_SO_FAR: Ability[] = [...GRIFONDORO]   // Task 4: sostituire con ABILITIES da '@/data/abilities'

const CONTINUO_TARGET_VIETATI = new Set(['opposto', 'nemicoCasuale', 'adiacenteDelBersaglio'])
function checkLine(a: Ability, l: AbilityLine, where: string) {
  const w = `${a.id} ${where}`
  if (l.trigger === 'lancio') {
    const ok = (l.limit?.everySeconds ?? 0) > 0 || (l.limit?.perBattle ?? 0) > 0 || l.limit?.senzaCooldown === true
    expect(ok, `${w}: ogni riga 'lancio' ha cooldown, perBattle o senzaCooldown`).toBe(true)
  }
  if (l.trigger === 'continuo') {
    expect(CONTINUO_TARGET_VIETATI.has(l.target), `${w}: continuo con bersaglio ${l.target}`).toBe(false)
    expect(['dannoPct', 'cdPct', 'cdFlat', 'hpPct', 'scudoIniziale', 'immune', 'copre', 'durataStatusPct'], `${w}: effetto continuo ${l.effect.kind}`).toContain(l.effect.kind)
  }
  if (l.trigger === 'lancio' || l.trigger === 'inizio' || l.trigger === 'ogniSecondi' || l.trigger === 'sottoSoglia') {
    expect(l.target !== 'adiacenteDelBersaglio' && !(l.cond && 'bersaglio' in l.cond), `${w}: nessun bersaglio nel contesto`).toBe(true)
  }
  if (l.trigger === 'ogniSecondi') expect((l.limit?.everySeconds ?? 0) > 0, `${w}: ogniSecondi senza everySeconds`).toBe(true)
  if (l.trigger === 'sottoSoglia') expect(l.cond && 'hpPropriaSotto' in l.cond, `${w}: sottoSoglia senza hpPropriaSotto`).toBe(true)
  if (l.params) { expect(l.params.length).toBe(3); expect(l.params[0] <= l.params[1] && l.params[1] <= l.params[2] || l.params[0] >= l.params[1] && l.params[1] >= l.params[2], `${w}: params monotoni`).toBe(true) }
  if (l.target === 'alleatiTag' || l.target === 'alleatiCasa' || l.target === 'alleatiRuolo') expect(l.targetArg, `${w}: targetArg`).toBeTruthy()
}

describe('abilità: regole generali', () => {
  it('ogni abilità: id = wizard, lv4 presente, righe valide', () => {
    for (const a of ABILITIES_SO_FAR) {
      expect(WIZARD_BY_ID[a.id], a.id).toBeTruthy()
      expect(a.lv4, `${a.id} lv4`).toBeTruthy()
      a.lines.forEach((l, i) => checkLine(a, l, `#${i}`))
      checkLine(a, a.lv4!, 'lv4')
    }
  })
  it('budget per rarità (§5.0): righe lv1 senza contare "vittoria"', () => {
    // Una cond "strutturale" non conta: la soglia di un KO (spec: i KO hanno sempre soglia) e l'hpPropriaSotto di una sottoSoglia.
    const contaCond = (l: AbilityLine) => !!l.cond && !(l.effect.kind === 'ko' && 'hpNemicaSotto' in l.cond) && l.trigger !== 'sottoSoglia'
    for (const a of ABILITIES_SO_FAR) {
      const tier = WIZARD_BY_ID[a.id]!.tier
      const lines = a.lines.filter(l => l.trigger !== 'vittoria')
      if (tier === 1 || tier === 2) { expect(lines.length, a.id).toBe(2); expect(lines.filter(contaCond).length, `${a.id}: T${tier} al più una cond`).toBeLessThanOrEqual(1) }
      if (tier === 3) { expect(lines.length, a.id).toBeGreaterThanOrEqual(1); expect(lines.length, a.id).toBeLessThanOrEqual(2); if (lines.length === 2) expect(contaCond(lines[1]!), `${a.id}: T3 seconda riga condizionata`).toBe(true) }
      if (tier === 4) expect(lines.length, a.id).toBe(1)
    }
  })
})
```

- [ ] **Step 3: Grifondoro**

```ts
// data/abilities/grifondoro.ts
import type { Ability } from '@/types/rt'
import { riga, cd, una, libera } from './util'

export const GRIFONDORO: Ability[] = [
  { id: 'harry', name: 'Coraggio del Grifondoro', desc: 'Colpisce più forte subito dopo un compagno; a ogni vittoria rende più forti Ron e Hermione.', lines: [
    riga('continuo', 'se', { kind: 'dannoPct', pct: 0.5 }, { params: [0.5, 0.75, 1], cond: { entroSecondiDa: { evento: 'lancioAdiacente', secondi: 2 } }, desc: '+50% danno se un alleato adiacente ha lanciato negli ultimi 2 s' }),
    riga('vittoria', 'alleatiTag', { kind: 'dannoFlat', n: 2 }, { params: [2, 3, 4], targetArg: 'trio', desc: 'A vittoria: +2 danno permanente al Trio' }),
  ], lv4: riga('sottoSoglia', 'se', { kind: 'multicast', n: 1, durata: 'battaglia' }, { cond: { hpPropriaSotto: 0.5 }, desc: 'Sotto 50% HP: Multicast +1' }) },
  { id: 'dumbledore', name: 'Bacchetta di Sambuco', desc: 'Gela la prima fila nemica all\'inizio e carica tutta la squadra a ogni lancio.', lines: [
    riga('inizio', 'primaFilaNemica', { kind: 'gelo', secondi: 1.5 }, { params: [1.5, 2, 2.5], desc: 'All\'inizio: Gelo alla prima fila nemica' }),
    riga('lancio', 'tuttiAlleati', { kind: 'carica', secondi: 0.5 }, { params: [0.5, 0.75, 1], limit: cd(3), desc: 'Al lancio (ogni 3 s): Carica a tutti' }),
  ], lv4: riga('lancio', 'tuttiAlleati', { kind: 'protego' }, { limit: una(), desc: 'Una volta: Protego a tutti' }) },
  { id: 'mcgonagall', name: 'Trasfigurazione Marziale', desc: 'Scudo grande all\'inizio e Protego alla sua fila.', lines: [
    riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 50 }, { params: [50, 75, 100], desc: 'All\'inizio: Scudo +50' }),
    riga('inizio', 'riga', { kind: 'protego' }, { desc: 'All\'inizio: Protego alla sua fila' }),
  ], lv4: riga('ogniSecondi', 'squadraPropria', { kind: 'scudo', n: 50 }, { limit: cd(10), desc: 'Ogni 10 s: Scudo +50' }) },
  { id: 'sirius', name: 'Fuga da Azkaban', desc: 'Si carica se un Malandrino è in squadra; ogni KO nemico gli dà Multicast.', lines: [
    riga('lancio', 'se', { kind: 'carica', secondi: 1 }, { params: [1, 1.5, 2], cond: { inSquadra: { tag: 'marauder' } }, limit: cd(4), desc: 'Al lancio (ogni 4 s): Carica a sé se un Malandrino è in squadra' }),
    riga('koNemico', 'se', { kind: 'multicast', n: 1, durata: 5 }, { desc: 'Al KO nemico: Multicast +1 per 5 s' }),
  ], lv4: riga('koNemico', 'alleatiTag', { kind: 'innesco' }, { targetArg: 'marauder', limit: cd(6), desc: 'Al KO nemico: Innesco dei Malandrini' }) },
  { id: 'lupin', name: 'Furia Lupesca', desc: 'Sotto metà vita la bestia si scatena.', lines: [
    riga('sottoSoglia', 'se', { kind: 'multicast', n: 1, durata: 'battaglia' }, { cond: { hpPropriaSotto: 0.5 }, desc: 'Sotto 50% HP: Multicast +1' }),
    riga('sottoSoglia', 'se', { kind: 'dannoPct', pct: 0.3, durata: 'battaglia' }, { params: [0.3, 0.45, 0.6], cond: { hpPropriaSotto: 0.5 }, desc: 'Sotto 50% HP: +30% danno' }),
  ], lv4: riga('sottoSoglia', 'tuttiAlleati', { kind: 'immune', a: 'gelo' }, { cond: { hpPropriaSotto: 0.25 }, desc: 'Sotto 25% HP: la squadra è immune al Gelo' }) },
  { id: 'moody', name: 'Vigilanza Costante', desc: 'Protegge la sua fila e vendica un alleato caduto con un KO.', lines: [
    riga('inizio', 'riga', { kind: 'protego' }, { desc: 'All\'inizio: Protego alla sua fila' }),
    riga('koAlleato', 'opposto', { kind: 'ko' }, { cond: { hpNemicaSotto: 0.5 }, limit: una(), desc: 'Al KO alleato (una volta): KO all\'opposto se HP nemica < 50%' }),
  ], lv4: riga('inizio', 'tuttiAlleati', { kind: 'protego' }, { desc: 'All\'inizio: Protego a tutti' }) },
  { id: 'hermione', name: 'Mente Brillante', desc: 'Carica chi le sta davanti e ogni tre lanci silenzia l\'opposto.', lines: [
    riga('lancio', 'davanti', { kind: 'carica', secondi: 0.75 }, { params: [0.75, 1, 1.25], limit: cd(4), desc: 'Al lancio (ogni 4 s): Carica all\'alleato davanti' }),
    riga('lancio', 'opposto', { kind: 'silenzio', secondi: 2 }, { cond: { ogniNLanci: 3 }, limit: libera(), desc: 'Ogni 3° lancio: Silenzio 2 s all\'opposto' }),
  ], lv4: riga('continuo', 'se', { kind: 'durataStatusPct', status: 'lentezza', pct: 1 }, { desc: 'Le sue Lentezze durano il doppio' }) },
  { id: 'ron', name: 'Scacchi Magici', desc: 'Protego agli adiacenti; scudo extra con i Weasley in squadra.', lines: [
    riga('inizio', 'adiacenti', { kind: 'protego' }, { desc: 'All\'inizio: Protego agli adiacenti' }),
    riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 30 }, { params: [30, 45, 60], cond: { inSquadra: { tag: 'weasley' } }, desc: 'All\'inizio: Scudo +30 se un Weasley è in squadra' }),
  ], lv4: riga('koSubito', 'adiacenti', { kind: 'innesco' }, { desc: 'Al KO subìto: Innesco degli adiacenti' }) },
  { id: 'ginny', name: 'Fattura Mocciovolante', desc: 'Con un Weasley accanto il prossimo lancio è doppio; a vittoria cresce.', lines: [
    riga('lancio', 'se', { kind: 'multicast', n: 1, durata: 6 }, { cond: { adiacente: { tag: 'weasley' } }, limit: cd(8), desc: 'Al lancio (ogni 8 s), con un Weasley adiacente: Multicast +1 per 6 s' }),
    riga('vittoria', 'se', { kind: 'dannoFlat', n: 3 }, { params: [3, 4, 5], desc: 'A vittoria: +3 danno permanente' }),
  ], lv4: riga('lancio', 'se', { kind: 'dannoPct', pct: 0.5, durata: 3 }, { limit: cd(6), desc: 'Al lancio (ogni 6 s): +50% danno per 3 s' }) },
  { id: 'neville', name: 'Coraggio Tardivo', desc: 'Quando un alleato cade, l\'Esercito di Silente si infuria.', lines: [
    riga('koAlleato', 'alleatiTag', { kind: 'dannoPct', pct: 0.4, durata: 'battaglia' }, { params: [0.4, 0.6, 0.8], targetArg: 'da', desc: 'Al KO alleato: +40% danno agli ES per il resto della battaglia' }),
    riga('inizio', 'se', { kind: 'protego' }, { cond: { inSquadra: { tag: 'da' } }, desc: 'All\'inizio: Protego a sé se un altro ES è in squadra' }),
  ], lv4: riga('lancio', 'alleatoSlotMinimo', { kind: 'rianima' }, { limit: una(), desc: 'Una volta: Rianima un alleato' }) },
  { id: 'fred', name: 'Tiro Mancino', desc: 'Innesca l\'alleato alla sua destra (mettici George).', lines: [
    riga('lancio', 'destra', { kind: 'innesco' }, { limit: cd(4), desc: 'Al lancio (ogni 4 s): Innesco dell\'alleato a destra' }),
  ], lv4: riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'fiamma', stacks: 2 }, { limit: cd(4), desc: 'Al lancio (ogni 4 s): Fiamma +2' }) },
  { id: 'george', name: 'Scherzo Ustionante', desc: 'Innesca l\'alleato alla sua sinistra (mettici Fred).', lines: [
    riga('lancio', 'sinistra', { kind: 'innesco' }, { limit: cd(4), desc: 'Al lancio (ogni 4 s): Innesco dell\'alleato a sinistra' }),
  ], lv4: riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'scossa', stacks: 2 }, { limit: cd(4), desc: 'Al lancio (ogni 4 s): Scossa +2' }) },
  { id: 'molly', name: 'Istinto Materno', desc: 'Cura extra con i Weasley e scudo a ogni cura.', lines: [
    riga('squadraCura', 'squadraPropria', { kind: 'scudo', n: 10 }, { params: [10, 15, 20], limit: cd(3), desc: 'Quando la squadra cura (ogni 3 s): Scudo +10' }),
    riga('lancio', 'squadraPropria', { kind: 'cura', n: 10 }, { params: [10, 15, 20], cond: { inSquadra: { tag: 'weasley' } }, limit: cd(5), desc: 'Al lancio (ogni 5 s): Cura +10 se un Weasley è in squadra' }),
  ], lv4: riga('koAlleato', 'opposto', { kind: 'ko' }, { cond: { hpNemicaSotto: 0.5 }, limit: una(), desc: 'Al KO alleato (una volta): KO all\'opposto se HP nemica < 50%' }) },
  { id: 'arthur', name: 'Officina Weasley', desc: 'Carica tutti i Weasley a ogni lancio.', lines: [
    riga('lancio', 'alleatiTag', { kind: 'carica', secondi: 0.5 }, { params: [0.5, 0.75, 1], targetArg: 'weasley', limit: cd(3), desc: 'Al lancio (ogni 3 s): Carica a tutti i Weasley' }),
  ], lv4: riga('lancio', 'adiacenti', { kind: 'carica', secondi: 0.5 }, { limit: cd(3), desc: 'Al lancio (ogni 3 s): Carica agli adiacenti' }) },
  { id: 'hagrid', name: 'Cuore di Mezzogigante', desc: 'Più HP di squadra e uno scudo grosso.', lines: [
    riga('continuo', 'squadraPropria', { kind: 'hpPct', pct: 0.1 }, { params: [0.1, 0.15, 0.2], desc: 'HP di squadra +10%' }),
    riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 40 }, { cond: { inSquadra: { tag: 'da' } }, desc: 'All\'inizio: Scudo +40 se un ES è in squadra' }),
  ], lv4: riga('koSubito', 'squadraPropria', { kind: 'scudo', n: 150 }, { desc: 'Al KO subìto: Scudo +150' }) },
  { id: 'seamus', name: 'Esplosione Facile', desc: 'Fiamma a ogni lancio; ogni tanto esplode anche sui suoi.', lines: [
    riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'fiamma', stacks: 1 }, { params: [1, 2, 3], limit: cd(3), desc: 'Al lancio (ogni 3 s): Fiamma +1' }),
  ], lv4: riga('lancio', 'squadraPropria', { kind: 'segno', segno: 'fiamma', stacks: 2 }, { cond: { chance: 0.25 }, limit: cd(3), desc: 'Al lancio: 25% esplode, Fiamma +2 alla propria squadra' }) },
  { id: 'dean', name: 'Tifoso', desc: 'Più forte con Seamus accanto.', lines: [
    riga('continuo', 'se', { kind: 'dannoPct', pct: 0.15 }, { params: [0.15, 0.25, 0.35], cond: { adiacente: { wizardId: 'seamus' } }, desc: '+15% danno se Seamus è adiacente' }),
  ], lv4: riga('continuo', 'se', { kind: 'dannoPct', pct: 0.15 }, { cond: { adiacente: { casa: 'Grifondoro' } }, desc: '+15% danno se un Grifondoro è adiacente' }) },
  { id: 'parvati', name: 'Divinazione Gemella', desc: 'Con Padma in squadra lancia più spesso.', lines: [
    riga('continuo', 'se', { kind: 'cdFlat', secondi: -0.5 }, { params: [-0.5, -0.75, -1], cond: { inSquadra: { wizardId: 'padma' } }, desc: 'Cooldown −0,5 s se Padma è in squadra' }),
  ], lv4: riga('lancio', 'nemicoCasuale', { kind: 'sospeso', secondi: 3 }, { limit: cd(6), desc: 'Al lancio (ogni 6 s): Sospeso a un nemico casuale' }) },
  { id: 'lavender', name: 'Won-Won', desc: 'Cura di più con Ron accanto.', lines: [
    riga('lancio', 'squadraPropria', { kind: 'cura', n: 10 }, { params: [10, 15, 20], cond: { adiacente: { wizardId: 'ron' } }, limit: cd(5), desc: 'Al lancio (ogni 5 s): Cura +10 se Ron è adiacente' }),
  ], lv4: riga('koAlleato', 'squadraPropria', { kind: 'cura', n: 80 }, { limit: una(), desc: 'Al KO alleato (una volta): Cura 80' }) },
]
```

- [ ] **Step 4: Eseguire → PASS**; `npm run typecheck`.

- [ ] **Step 5: Commit**
```bash
git add data/abilities/util.ts data/abilities/grifondoro.ts tests/data/rtContent.test.ts
git commit -m "feat(rt-content): abilità Grifondoro (19) con cooldown, ultimate e righe Continuo"
```

---

### Task 3: Abilità — Serpeverde (17)

**Files:**
- Create: `data/abilities/serpeverde.ts`
- Modify: `tests/data/rtContent.test.ts` (`ABILITIES_SO_FAR = [...GRIFONDORO, ...SERPEVERDE]`)

**Interfaces:** Produces `SERPEVERDE: Ability[]`.

- [ ] **Step 1: Serpeverde**

```ts
// data/abilities/serpeverde.ts
import type { Ability } from '@/types/rt'
import { riga, cd, una, libera } from './util'

export const SERPEVERDE: Ability[] = [
  { id: 'voldemort', name: 'Terrore Immortale', desc: 'Giustizia l\'opposto quando il nemico è agli sgoccioli; a vittoria i Mangiamorte crescono.', lines: [
    riga('lancio', 'opposto', { kind: 'ko' }, { cond: { hpNemicaSotto: 0.3 }, limit: cd(6), desc: 'Al lancio (ogni 6 s): KO all\'opposto se HP nemica < 30%' }),
    riga('lancio', 'squadraNemica', { kind: 'vulnerabile', secondi: 2 }, { limit: cd(4), desc: 'Al lancio (ogni 4 s): il terrore, Vulnerabile 2 s' }),
    riga('vittoria', 'alleatiTag', { kind: 'dannoPct', pct: 0.05 }, { params: [0.05, 0.07, 0.1], targetArg: 'deatheater', desc: 'A vittoria: +5% danno permanente ai Mangiamorte' }),
  ], lv4: riga('koNemico', 'alleatiTag', { kind: 'carica', secondi: 2 }, { targetArg: 'deatheater', limit: cd(3), desc: 'Al KO nemico: Carica 2 s ai Mangiamorte' }) },
  { id: 'snape', name: 'Pozioni Letali', desc: 'Veleno a ogni lancio, molto di più a ogni KO nemico.', lines: [
    riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 2 }, { params: [2, 3, 4], limit: cd(3), desc: 'Al lancio (ogni 3 s): Veleno +2' }),
    riga('koNemico', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 4 }, { params: [4, 6, 8], desc: 'Al KO nemico: Veleno +4' }),
  ], lv4: riga('continuo', 'se', { kind: 'durataStatusPct', status: 'vulnerabile', pct: 1 }, { desc: 'Le sue Vulnerabili durano il doppio' }) },
  { id: 'bellatrix', name: 'Tortura Cruciatus', desc: 'Più forte con un Mangiamorte accanto; a volte gela.', lines: [
    riga('continuo', 'se', { kind: 'dannoPct', pct: 0.25 }, { params: [0.25, 0.4, 0.5], cond: { adiacente: { tag: 'deatheater' } }, desc: '+25% danno se un Mangiamorte è adiacente' }),
    riga('lancio', 'opposto', { kind: 'gelo', secondi: 1 }, { limit: cd(6), desc: 'Al lancio (ogni 6 s): Gelo 1 s all\'opposto' }),
  ], lv4: riga('lancio', 'opposto', { kind: 'ko' }, { cond: { hpNemicaSotto: 0.4 }, limit: cd(10), desc: 'Al lancio (ogni 10 s): KO all\'opposto se HP nemica < 40%' }) },
  { id: 'lucius', name: 'Denaro e Influenza', desc: 'Carica i Mangiamorte all\'inizio e rende il nemico Vulnerabile.', lines: [
    riga('inizio', 'alleatiTag', { kind: 'carica', secondi: 1 }, { params: [1, 1.5, 2], targetArg: 'deatheater', desc: 'All\'inizio: Carica ai Mangiamorte' }),
    riga('lancio', 'squadraNemica', { kind: 'vulnerabile', secondi: 3 }, { limit: cd(5), desc: 'Al lancio (ogni 5 s): Vulnerabile 3 s' }),
  ], lv4: riga('lancio', 'primaFilaNemica', { kind: 'lentezza', secondi: 2 }, { limit: cd(8), desc: 'Al lancio (ogni 8 s): Lentezza 2 s alla prima fila nemica' }) },
  { id: 'draco', name: 'Orgoglio Malfoy', desc: 'Veleno con un Serpeverde accanto; cresce a ogni vittoria.', lines: [
    riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 1 }, { params: [1, 2, 3], cond: { adiacente: { casa: 'Serpeverde' } }, limit: libera(), desc: 'Al lancio: Veleno +1 se un Serpeverde è adiacente' }),
    riga('vittoria', 'se', { kind: 'dannoFlat', n: 3 }, { params: [3, 4, 5], desc: 'A vittoria: +3 danno permanente' }),
  ], lv4: riga('inizio', 'se', { kind: 'protego' }, { cond: { inSquadra: { wizardId: 'goyle' } }, desc: 'All\'inizio: Protego a sé se Goyle è in squadra' }) },
  { id: 'narcissa', name: 'Amore di Madre', desc: 'Scudo a ogni cura; una volta rianima; copre Draco.', lines: [
    riga('squadraCura', 'squadraPropria', { kind: 'scudo', n: 15 }, { params: [15, 22, 30], limit: cd(2), desc: 'Quando la squadra cura (ogni 2 s): Scudo +15' }),
    riga('lancio', 'alleatoSlotMinimo', { kind: 'rianima' }, { cond: { inSquadra: { tag: 'deatheater' } }, limit: una(), desc: 'Una volta: Rianima un alleato (se c\'è un Mangiamorte in squadra)' }),
  ], lv4: riga('inizio', 'se', { kind: 'copre', wizardId: 'draco' }, { desc: 'Copre Draco: gli effetti di unità diretti a lui colpiscono lei' }) },
  { id: 'dolohov', name: 'Maledizione Viola', desc: 'Fiamma sul nemico avvelenato: Miasma facile.', lines: [
    riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'fiamma', stacks: 2 }, { params: [2, 3, 4], cond: { segnoNemico: { segno: 'veleno', min: 1 } }, limit: cd(4), desc: 'Al lancio (ogni 4 s): Fiamma +2 se il nemico è avvelenato' }),
  ], lv4: riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'fiamma', stacks: 2 }, { limit: cd(4), desc: 'Al lancio (ogni 4 s): Fiamma +2' }) },
  { id: 'greyback', name: 'Morso del Lupo', desc: 'Veleno all\'inizio con alleati Veleno; scudo a ogni KO nemico.', lines: [
    riga('inizio', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 1 }, { params: [1, 2, 3], cond: { inSquadra: { tag: 'veleno' } }, desc: 'All\'inizio: Veleno +1 se un alleato Veleno è in squadra' }),
    riga('koNemico', 'squadraPropria', { kind: 'scudo', n: 40 }, { cond: { inSquadra: { tag: 'deatheater' } }, desc: 'Al KO nemico: Scudo +40 se un Mangiamorte è in squadra' }),
  ], lv4: riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 2 }, { limit: cd(4), desc: 'Al lancio (ogni 4 s): Veleno +2' }) },
  { id: 'slughorn', name: 'Lumaclub', desc: 'Le sue pozioni curano gli amici e avvelenano i nemici.', lines: [
    riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 1 }, { params: [1, 2, 3], limit: cd(5), desc: 'Al lancio (ogni 5 s): Veleno +1' }),
    riga('lancio', 'squadraPropria', { kind: 'cura', n: 10 }, { cond: { adiacente: { casa: 'Serpeverde' } }, limit: cd(5), desc: 'Al lancio (ogni 5 s): Cura +10 se un Serpeverde è adiacente' }),
  ], lv4: riga('lancio', 'squadraPropria', { kind: 'cura', n: 10 }, { limit: cd(5), desc: 'Al lancio (ogni 5 s): Cura +10' }) },
  { id: 'pansy', name: 'Pettegolezzo', desc: 'Ogni lingua bloccata è una goccia di veleno.', lines: [
    riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 1 }, { params: [1, 1, 2], limit: cd(3), desc: 'Al lancio (ogni 3 s): Veleno +1' }),
  ], lv4: riga('lancio', 'nemicoCasuale', { kind: 'silenzio', secondi: 2 }, { limit: cd(8), desc: 'Al lancio (ogni 8 s): Silenzio 2 s a un nemico casuale' }) },
  { id: 'goyle', name: 'Guardia del Corpo', desc: 'Scudo all\'inizio; a livello 4 copre Draco.', lines: [
    riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 25 }, { params: [25, 35, 45], desc: 'All\'inizio: Scudo +25' }),
  ], lv4: riga('inizio', 'se', { kind: 'copre', wizardId: 'draco' }, { desc: 'Copre Draco' }) },
  { id: 'crabbe', name: 'Guardia del Corpo', desc: 'Scudo all\'inizio; quando cade, scudo alla squadra.', lines: [
    riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 25 }, { params: [25, 35, 45], desc: 'All\'inizio: Scudo +25' }),
  ], lv4: riga('koSubito', 'squadraPropria', { kind: 'scudo', n: 100 }, { desc: 'Al KO subìto: Scudo +100' }) },
  { id: 'marcus', name: 'Capitano Brutale', desc: 'Colpisce più forte quando il nemico è sotto metà.', lines: [
    riga('continuo', 'se', { kind: 'dannoPct', pct: 0.25 }, { params: [0.25, 0.4, 0.55], cond: { hpNemicaSotto: 0.5 }, desc: '+25% danno se HP nemica < 50%' }),
  ], lv4: riga('koNemico', 'se', { kind: 'multicast', n: 1, durata: 'battaglia' }, { limit: una(3), desc: 'Al KO nemico (max 3): Multicast +1 per il resto della battaglia' }) },
  { id: 'pettigrew', name: 'Codardo', desc: 'Si protegge; quando cade, i Mangiamorte scattano.', lines: [
    riga('inizio', 'se', { kind: 'protego' }, { desc: 'All\'inizio: Protego a sé' }),
  ], lv4: riga('koSubito', 'alleatiTag', { kind: 'innesco' }, { targetArg: 'deatheater', desc: 'Al KO subìto: Innesco dei Mangiamorte' }) },
  { id: 'theodore', name: 'Ombra Silente', desc: 'Veleno nel silenzio.', lines: [
    riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 2 }, { params: [2, 3, 4], limit: cd(4), desc: 'Al lancio (ogni 4 s): Veleno +2' }),
  ], lv4: riga('continuo', 'se', { kind: 'durataStatusPct', status: 'silenzio', pct: 0.5 }, { desc: 'I suoi Silenzi durano +50%' }) },
  { id: 'blaise', name: 'Distacco', desc: 'Più forte quando la squadra ha buchi.', lines: [
    riga('continuo', 'se', { kind: 'dannoPct', pct: 0.1 }, { params: [0.1, 0.15, 0.2], cond: { slotVuotiOKo: true }, desc: '+10% danno se ci sono slot vuoti o KO' }),
  ], lv4: riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 2 }, { cond: { nessunAdiacente: true }, limit: cd(4), desc: 'Al lancio (ogni 4 s): Veleno +2 se nessun alleato è adiacente' }) },
  { id: 'astoria', name: 'Cura Discreta', desc: 'Cura di più con Serpeverde accanto.', lines: [
    riga('lancio', 'squadraPropria', { kind: 'cura', n: 8 }, { params: [8, 12, 16], cond: { adiacente: { casa: 'Serpeverde' } }, limit: cd(5), desc: 'Al lancio (ogni 5 s): Cura +8 se un Serpeverde è adiacente' }),
  ], lv4: riga('squadraCura', 'adiacenti', { kind: 'purifica' }, { limit: cd(4), desc: 'Quando la squadra cura (ogni 4 s): Purifica gli adiacenti' }) },
]
```
Nota budget: Pettigrew (T4) ha `koSubito` come lv4 e una sola riga lv1 (Protego); Marcus lv4 usa `una(3)` = "max 3 volte"; Sirius lv4 `innesco` ai Malandrini include sé stesso: scatta al KO nemico, quindi non è un loop.

- [ ] **Step 2: Test: aggiornare `ABILITIES_SO_FAR` con `SERPEVERDE`; eseguire → PASS; typecheck.**

- [ ] **Step 3: Commit**
```bash
git add data/abilities/serpeverde.ts tests/data/rtContent.test.ts
git commit -m "feat(rt-content): abilità Serpeverde (17)"
```

---

### Task 4: Abilità — Corvonero (13), Tassorosso (11), indice e validazione completa

**Files:**
- Create: `data/abilities/corvonero.ts`, `data/abilities/tassorosso.ts`, `data/abilities/index.ts`
- Modify: `tests/data/rtContent.test.ts` (import `ABILITIES` da `@/data/abilities`, `ABILITIES_SO_FAR` → `ABILITIES`, test "60 abilità")

**Interfaces:** Produces `CORVONERO`, `TASSOROSSO`, `ABILITIES: Ability[]` (60), `ABILITY_BY_ID: Record<string, Ability>`.

- [ ] **Step 1: Corvonero**

```ts
// data/abilities/corvonero.ts
import type { Ability } from '@/types/rt'
import { riga, cd, una, libera } from './util'

export const CORVONERO: Ability[] = [
  { id: 'kingsley', name: 'Pugno dell\'Auror', desc: 'Rallenta l\'opposto; scudo extra con l\'Ordine in squadra.', lines: [
    riga('lancio', 'opposto', { kind: 'lentezza', secondi: 2 }, { params: [2, 2.5, 3], limit: cd(4), desc: 'Al lancio (ogni 4 s): Lentezza 2 s all\'opposto' }),
    riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 20 }, { params: [20, 30, 40], cond: { inSquadra: { tag: 'order' } }, desc: 'All\'inizio: Scudo +20 se un membro dell\'Ordine è in squadra' }),
  ], lv4: riga('inizio', 'alleatiTag', { kind: 'protego' }, { targetArg: 'order', desc: 'All\'inizio: Protego all\'Ordine' }) },
  { id: 'fleur', name: 'Fascino Veela', desc: 'Disarma l\'opposto e accende una Fiamma con un Corvonero accanto.', lines: [
    riga('lancio', 'opposto', { kind: 'disarmo' }, { limit: cd(6), desc: 'Al lancio (ogni 6 s): Disarmo all\'opposto' }),
    riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'fiamma', stacks: 1 }, { cond: { adiacente: { casa: 'Corvonero' } }, limit: libera(), desc: 'Al lancio: Fiamma +1 se un Corvonero è adiacente' }),
  ], lv4: riga('lancio', 'opposto', { kind: 'gelo', secondi: 1 }, { cond: { segnoNemico: { segno: 'fiamma', min: 3 } }, limit: cd(6), desc: 'Al lancio (ogni 6 s): Gelo 1 s se il nemico ha ≥3 Fiamma (Vapore)' }) },
  { id: 'viktor', name: 'Bulgaro d\'Acciaio', desc: 'Lupo solitario: più forte senza alleati accanto.', lines: [
    riga('continuo', 'se', { kind: 'dannoPct', pct: 0.3 }, { params: [0.3, 0.5, 0.7], cond: { nessunAdiacente: true }, desc: '+30% danno se nessun alleato è adiacente' }),
    riga('lancio', 'se', { kind: 'carica', secondi: 0.5 }, { limit: cd(5), desc: 'Al lancio (ogni 5 s): Carica 0,5 s a sé' }),
  ], lv4: riga('lancio', 'se', { kind: 'dannoPct', pct: 0.5, durata: 3 }, { limit: cd(6), desc: 'Al lancio (ogni 6 s): +50% danno per 3 s' }) },
  { id: 'luna', name: 'Serenità', desc: 'Cura lenta e costante; purifica chi le sta accanto.', lines: [
    riga('ogniSecondi', 'squadraPropria', { kind: 'cura', n: 10 }, { params: [10, 15, 20], limit: cd(4), desc: 'Ogni 4 s: Cura 10' }),
    riga('squadraCura', 'adiacenti', { kind: 'purifica' }, { limit: cd(2), desc: 'Quando la squadra cura (ogni 2 s): Purifica gli adiacenti' }),
  ], lv4: riga('inizio', 'tuttiAlleati', { kind: 'immune', a: 'silenzio' }, { desc: 'La squadra è immune al Silenzio' }) },
  { id: 'cho', name: 'Lacrime Gelide', desc: 'Dopo un Gelo alleato colpisce l\'opposto: Frantuma.', lines: [
    riga('lancio', 'opposto', { kind: 'danno', potenza: 1.5 }, { params: [1.5, 1.9, 2.3], cond: { entroSecondiDa: { evento: 'gelo', secondi: 2 } }, limit: cd(4), desc: 'Al lancio (ogni 4 s): Danno 1,5 all\'opposto entro 2 s da un Gelo alleato' }),
  ], lv4: riga('lancio', 'nemicoCasuale', { kind: 'gelo', secondi: 1 }, { limit: cd(6), desc: 'Al lancio (ogni 6 s): Gelo 1 s a un nemico casuale' }) },
  { id: 'flitwick', name: 'Maestro d\'Incantesimi', desc: 'Carica i Corvonero; ogni tre lanci gela l\'opposto.', lines: [
    riga('lancio', 'alleatiCasa', { kind: 'carica', secondi: 0.5 }, { params: [0.5, 0.75, 1], targetArg: 'Corvonero', limit: cd(3), desc: 'Al lancio (ogni 3 s): Carica ai Corvonero' }),
    riga('lancio', 'opposto', { kind: 'gelo', secondi: 1 }, { cond: { ogniNLanci: 3 }, limit: libera(), desc: 'Ogni 3° lancio: Gelo 1 s all\'opposto' }),
  ], lv4: riga('lancio', 'tuttiAlleati', { kind: 'carica', secondi: 0.5 }, { limit: cd(3), desc: 'Al lancio (ogni 3 s): Carica a tutti' }) },
  { id: 'padma', name: 'Divinazione Gemella', desc: 'Con Parvati in squadra lancia più spesso.', lines: [
    riga('continuo', 'se', { kind: 'cdFlat', secondi: -0.5 }, { params: [-0.5, -0.75, -1], cond: { inSquadra: { wizardId: 'parvati' } }, desc: 'Cooldown −0,5 s se Parvati è in squadra' }),
  ], lv4: riga('lancio', 'opposto', { kind: 'sospeso', secondi: 3 }, { limit: cd(6), desc: 'Al lancio (ogni 6 s): Sospeso 3 s all\'opposto' }) },
  { id: 'terry', name: 'Analisi', desc: 'Ogni due lanci una Scossa.', lines: [
    riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'scossa', stacks: 1 }, { params: [1, 1, 2], cond: { ogniNLanci: 2 }, limit: libera(), desc: 'Ogni 2° lancio: Scossa +1' }),
  ], lv4: riga('lancio', 'squadraNemica', { kind: 'vulnerabile', secondi: 1 }, { limit: cd(4), desc: 'Al lancio (ogni 4 s): Vulnerabile 1 s' }) },
  { id: 'michael', name: 'Precisione', desc: 'Colpisce forte il nemico Scosso.', lines: [
    riga('continuo', 'se', { kind: 'dannoPct', pct: 0.2 }, { params: [0.2, 0.3, 0.4], cond: { segnoNemico: { segno: 'scossa', min: 3 } }, desc: '+20% danno se il nemico ha ≥3 Scossa' }),
  ], lv4: riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'scossa', stacks: 2 }, { limit: cd(5), desc: 'Al lancio (ogni 5 s): Scossa +2' }) },
  { id: 'roger', name: 'Capitano Corvonero', desc: 'Scudo all\'inizio; a livello 4 la sua fila colpisce di più.', lines: [
    riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 25 }, { params: [25, 35, 45], desc: 'All\'inizio: Scudo +25' }),
  ], lv4: riga('continuo', 'riga', { kind: 'dannoPct', pct: 0.1 }, { desc: 'La sua fila: +10% danno' }) },
  { id: 'marietta', name: 'Spifferona', desc: 'Rende il nemico Vulnerabile.', lines: [
    riga('lancio', 'squadraNemica', { kind: 'vulnerabile', secondi: 1 }, { params: [1, 1.5, 2], limit: cd(4), desc: 'Al lancio (ogni 4 s): Vulnerabile 1 s' }),
  ], lv4: riga('lancio', 'opposto', { kind: 'silenzio', secondi: 1 }, { limit: cd(6), desc: 'Al lancio (ogni 6 s): Silenzio 1 s all\'opposto' }) },
  { id: 'anthony', name: 'Prefetto', desc: 'Scudo all\'inizio; a livello 4 protegge gli adiacenti.', lines: [
    riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 25 }, { params: [25, 35, 45], desc: 'All\'inizio: Scudo +25' }),
  ], lv4: riga('inizio', 'adiacenti', { kind: 'protego' }, { desc: 'All\'inizio: Protego agli adiacenti' }) },
  { id: 'penelope', name: 'Prefetta', desc: 'Carica chi le sta davanti.', lines: [
    riga('lancio', 'davanti', { kind: 'carica', secondi: 0.5 }, { params: [0.5, 0.75, 1], limit: cd(3), desc: 'Al lancio (ogni 3 s): Carica all\'alleato davanti' }),
  ], lv4: riga('lancio', 'dietro', { kind: 'carica', secondi: 0.75 }, { limit: cd(3), desc: 'Al lancio (ogni 3 s): Carica all\'alleato dietro' }) },
]
```

- [ ] **Step 2: Tassorosso**

```ts
// data/abilities/tassorosso.ts
import type { Ability } from '@/types/rt'
import { riga, cd, una, libera } from './util'

export const TASSOROSSO: Ability[] = [
  { id: 'tonks', name: 'Riflessi Mutanti', desc: 'Più veloce con l\'Ordine accanto.', lines: [
    riga('continuo', 'se', { kind: 'cdPct', pct: -0.15 }, { params: [-0.15, -0.2, -0.25], cond: { adiacente: { tag: 'order' } }, desc: 'Cooldown −15% se un membro dell\'Ordine è adiacente' }),
    riga('lancio', 'se', { kind: 'carica', secondi: 0.5 }, { cond: { adiacente: { tag: 'order' } }, limit: cd(4), desc: 'Al lancio (ogni 4 s): Carica 0,5 s con l\'Ordine accanto' }),
  ], lv4: riga('inizio', 'se', { kind: 'carica', secondi: 2 }, { desc: 'All\'inizio: Carica 2 s a sé' }) },
  { id: 'cedric', name: 'Campione di Hogwarts', desc: 'Scudo a ogni lancio; più forte con uno Scudo/Rigen in squadra.', lines: [
    riga('lancio', 'squadraPropria', { kind: 'scudo', n: 15 }, { params: [15, 20, 25], limit: cd(3), desc: 'Al lancio (ogni 3 s): Scudo +15' }),
    riga('continuo', 'se', { kind: 'dannoPct', pct: 0.2 }, { params: [0.2, 0.3, 0.4], cond: { inSquadra: { tag: 'scudirigen' } }, desc: '+20% danno se un altro Scudo/Rigen è in squadra' }),
  ], lv4: riga('koSubito', 'squadraPropria', { kind: 'scudo', n: 100 }, { desc: 'Al KO subìto: Scudo +100' }) },
  { id: 'sprout', name: 'Serra', desc: 'Rigenera con un Tassorosso accanto; scudo a ogni lancio.', lines: [
    riga('ogniSecondi', 'squadraPropria', { kind: 'cura', n: 3 }, { params: [3, 4, 5], cond: { adiacente: { casa: 'Tassorosso' } }, limit: cd(1), desc: 'Ogni secondo: Cura 3 se un Tassorosso è adiacente' }),
    riga('lancio', 'squadraPropria', { kind: 'scudo', n: 15 }, { params: [15, 20, 25], cond: { inSquadra: { tag: 'scudirigen' } }, limit: cd(3), desc: 'Al lancio (ogni 3 s): Scudo +15 se uno Scudo/Rigen è in squadra' }),
  ], lv4: riga('ogniSecondi', 'squadraPropria', { kind: 'rimuoviSegnoProprio', segno: 'veleno' }, { limit: cd(5), desc: 'Ogni 5 s: Mandragola, via il Veleno dalla squadra' }) },
  { id: 'hannah', name: 'Tenacia', desc: 'Cura di più con Tassorosso accanto.', lines: [
    riga('lancio', 'squadraPropria', { kind: 'cura', n: 10 }, { params: [10, 15, 20], cond: { adiacente: { casa: 'Tassorosso' } }, limit: cd(5), desc: 'Al lancio (ogni 5 s): Cura +10 se un Tassorosso è adiacente' }),
  ], lv4: riga('lancio', 'squadraPropria', { kind: 'cura', n: 20 }, { limit: cd(5), desc: 'Al lancio (ogni 5 s): Cura +20' }) },
  { id: 'susan', name: 'Memoria dei Caduti', desc: 'Si carica quando un alleato cade.', lines: [
    riga('koAlleato', 'se', { kind: 'carica', secondi: 2 }, { limit: cd(2), desc: 'Al KO alleato: Carica 2 s a sé' }),
  ], lv4: riga('lancio', 'alleatoSlotMinimo', { kind: 'rianima' }, { limit: cd(12), desc: 'Al lancio (ogni 12 s): Rianima un alleato' }) },
  { id: 'ernie', name: 'Prefetto Zelante', desc: 'Scudo a ogni lancio.', lines: [
    riga('lancio', 'squadraPropria', { kind: 'scudo', n: 15 }, { params: [15, 20, 25], limit: cd(3), desc: 'Al lancio (ogni 3 s): Scudo +15' }),
  ], lv4: riga('inizio', 'riga', { kind: 'protego' }, { desc: 'All\'inizio: Protego alla sua fila' }) },
  { id: 'justin', name: 'Nato Babbano', desc: 'Impara combattendo: ogni lancio lo rende più forte.', lines: [
    riga('lancio', 'se', { kind: 'dannoPct', pct: 0.05, durata: 'battaglia' }, { params: [0.05, 0.08, 0.1], limit: libera(), desc: 'Al lancio: +5% danno per il resto della battaglia' }),
  ], lv4: riga('lancio', 'se', { kind: 'multicast', n: 1, durata: 'battaglia' }, { limit: una(), desc: 'Una volta: Multicast +1 per il resto della battaglia' }) },
  { id: 'zacharias', name: 'Lingua Lunga', desc: 'Indebolisce l\'opposto.', lines: [
    riga('lancio', 'opposto', { kind: 'indebolito', pct: 0.1, secondi: 3 }, { params: [0.1, 0.15, 0.2], limit: cd(4), desc: 'Al lancio (ogni 4 s): Indebolito 10% per 3 s all\'opposto' }),
  ], lv4: riga('lancio', 'nemicoCasuale', { kind: 'silenzio', secondi: 2 }, { limit: cd(8), desc: 'Al lancio (ogni 8 s): Silenzio 2 s a un nemico casuale' }) },
  { id: 'leanne', name: 'Amica Fedele', desc: 'Rende il nemico Vulnerabile.', lines: [
    riga('lancio', 'squadraNemica', { kind: 'vulnerabile', secondi: 1 }, { params: [1, 1.5, 2], limit: cd(4), desc: 'Al lancio (ogni 4 s): Vulnerabile 1 s' }),
  ], lv4: riga('continuo', 'se', { kind: 'durataStatusPct', status: 'lentezza', pct: 0.5 }, { desc: 'Le sue Lentezze durano +50%' }) },
  { id: 'eloise', name: 'Pelle Dura', desc: 'Scudo all\'inizio.', lines: [
    riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 25 }, { params: [25, 35, 45], desc: 'All\'inizio: Scudo +25' }),
  ], lv4: riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 40 }, { desc: 'All\'inizio: Scudo +40' }) },
  { id: 'megan', name: 'Gelo Tassorosso', desc: 'I Gelo della squadra durano di più.', lines: [
    riga('continuo', 'se', { kind: 'durataStatusPct', status: 'gelo', pct: 0.15 }, { params: [0.15, 0.25, 0.35], desc: 'I Gelo della squadra durano +15%' }),
  ], lv4: riga('lancio', 'opposto', { kind: 'gelo', secondi: 1 }, { limit: cd(6), desc: 'Al lancio (ogni 6 s): Gelo 1 s all\'opposto' }) },
]
```

- [ ] **Step 3: Indice**

```ts
// data/abilities/index.ts
import type { Ability } from '@/types/rt'
import { GRIFONDORO } from './grifondoro'
import { SERPEVERDE } from './serpeverde'
import { CORVONERO } from './corvonero'
import { TASSOROSSO } from './tassorosso'

export const ABILITIES: Ability[] = [...GRIFONDORO, ...SERPEVERDE, ...CORVONERO, ...TASSOROSSO]
export const ABILITY_BY_ID: Record<string, Ability> = Object.fromEntries(ABILITIES.map(a => [a.id, a]))
```

- [ ] **Step 4: Test — sostituire `ABILITIES_SO_FAR` con `ABILITIES` (import da `@/data/abilities`) e aggiungere:**

```ts
describe('abilità: catalogo', () => {
  it('60 abilità, una per mago, nessun mago senza', () => {
    expect(ABILITIES.length).toBe(WIZARDS.length)
    for (const w of WIZARDS) expect(ABILITY_BY_ID[w.id], w.id).toBeTruthy()
  })
  it('la casa di ogni abilità coincide con il file (Grifondoro in grifondoro.ts, ecc.)', () => {
    for (const [house, list] of [['Grifondoro', GRIFONDORO], ['Serpeverde', SERPEVERDE], ['Corvonero', CORVONERO], ['Tassorosso', TASSOROSSO]] as const)
      for (const a of list) expect(WIZARD_BY_ID[a.id]!.house, a.id).toBe(house)
  })
  it('varietà: almeno 8 ultimate (perBattle), almeno 6 righe libere, almeno 10 Continuo, almeno 6 sottoSoglia/koSubito', () => {
    const all = ABILITIES.flatMap(a => [...a.lines, a.lv4!])
    expect(all.filter(l => l.limit?.perBattle).length).toBeGreaterThanOrEqual(8)
    expect(all.filter(l => l.limit?.senzaCooldown).length).toBeGreaterThanOrEqual(6)
    expect(all.filter(l => l.trigger === 'continuo').length).toBeGreaterThanOrEqual(10)
    expect(all.filter(l => l.trigger === 'sottoSoglia' || l.trigger === 'koSubito').length).toBeGreaterThanOrEqual(6)
  })
  it('i riferimenti a maghi/tag/case esistono', () => {
    const tags = new Set(WIZARDS.flatMap(w => w.tags ?? []))
    for (const a of ABILITIES) for (const l of [...a.lines, a.lv4!]) {
      if (l.target === 'alleatiTag') expect(tags.has(l.targetArg!), `${a.id}: tag ${l.targetArg}`).toBe(true)
      if (l.target === 'alleatiCasa') expect(['Grifondoro', 'Serpeverde', 'Corvonero', 'Tassorosso']).toContain(l.targetArg)
      const c = l.cond as Record<string, unknown> | undefined
      const ref = (c?.adiacente ?? c?.inSquadra) as { wizardId?: string; tag?: string } | undefined
      if (ref?.wizardId) expect(WIZARD_BY_ID[ref.wizardId], `${a.id}: ${ref.wizardId}`).toBeTruthy()
      if (ref?.tag) expect(tags.has(ref.tag), `${a.id}: tag ${ref.tag}`).toBe(true)
      if (l.effect.kind === 'copre') expect(WIZARD_BY_ID[l.effect.wizardId], `${a.id}: copre ${l.effect.wizardId}`).toBeTruthy()
    }
  })
})
```
(Importare anche `GRIFONDORO`, `SERPEVERDE`, `CORVONERO`, `TASSOROSSO` e `ABILITY_BY_ID`.) Se il conteggio "varietà" non torna, correggere i NUMERI del test alla realtà del catalogo e annotarlo nel report — non inventare righe per farlo passare.

- [ ] **Step 5: Eseguire → PASS; typecheck. Commit**
```bash
git add data/abilities tests/data/rtContent.test.ts
git commit -m "feat(rt-content): abilità Corvonero (13) e Tassorosso (11); catalogo di 60 con validazione"
```

---

### Task 5: Tratti shiny e reliquie nel vocabolario rt

**Files:**
- Create: `data/traitsRt.ts`, `data/relicsRt.ts`
- Modify: `tests/data/rtContent.test.ts`

**Interfaces:** Produces `TRAIT_LINES_RT: Record<traitId, AbilityLine[]>` (16) e `RELICS_RT: Record<relicId, RelicRt>` (40) + `relicRt(id)`.
I bonus alle stat delle reliquie (`bonus`, `carrierBonus`, `condition`, `conditional`, `drawback`, `scaling`) NON si traducono: restano in `applyRelicBonuses` (usata dall'adapter). Qui si traducono solo hook, keyword-mult e grant (spec §7.1).

- [ ] **Step 1: Tratti**

```ts
// data/traitsRt.ts — spec §7.2. Righe extra del portatore shiny (RtUnitInput.extraLines).
import type { AbilityLine } from '@/types/rt'
import { riga, cd } from './abilities/util'

export const TRAIT_LINES_RT: Record<string, AbilityLine[]> = {
  esecuzione:     [riga('continuo', 'se', { kind: 'dannoPct', pct: 0.5 }, { cond: { hpNemicaSotto: 0.3 }, desc: '+50% danno mentre HP nemica < 30%' })],
  furia:          [riga('sottoSoglia', 'se', { kind: 'dannoPct', pct: 0.3, durata: 'battaglia' }, { cond: { hpPropriaSotto: 0.5 }, desc: 'Sotto 50% HP: +30% danno' }), riga('sottoSoglia', 'se', { kind: 'dannoPct', pct: 0.3, durata: 'battaglia' }, { cond: { hpPropriaSotto: 0.25 }, desc: 'Sotto 25% HP: altri +30%' })],
  roccia:         [riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 40 }, { desc: 'All\'inizio: Scudo +40' })],
  sifone:         [riga('lancio', 'opposto', { kind: 'lentezza', secondi: 1 }, { limit: cd(3), desc: 'Al lancio (ogni 3 s): Lentezza 1 s all\'opposto' })],
  benedizione:    [riga('squadraCura', 'squadraPropria', { kind: 'scudo', n: 25 }, { limit: cd(3), desc: 'Quando la squadra cura (ogni 3 s): Scudo +25' })],
  pietrificazione:[riga('lancio', 'opposto', { kind: 'gelo', secondi: 1 }, { cond: { chance: 0.3 }, limit: cd(3), desc: 'Al lancio: 30% Gelo 1 s' })],
  bavaglio:       [riga('lancio', 'opposto', { kind: 'silenzio', secondi: 2 }, { cond: { chance: 0.3 }, limit: cd(3), desc: 'Al lancio: 30% Silenzio 2 s' })],
  disarmo:        [riga('lancio', 'opposto', { kind: 'disarmo' }, { cond: { chance: 0.3 }, limit: cd(3), desc: 'Al lancio: 30% Disarmo' })],
  logoramento:    [riga('lancio', 'opposto', { kind: 'indebolito', pct: 0.25, secondi: 3 }, { cond: { chance: 0.4 }, limit: cd(3), desc: 'Al lancio: 40% Indebolito 25% per 3 s' })],
  ferocia:        [riga('lancio', 'se', { kind: 'dannoFlat', n: 6 }, { limit: { perBattle: 5 }, desc: 'Al lancio (max 5): +6 danno per il resto della battaglia' })],
  rigenerazione:  [riga('ogniSecondi', 'squadraPropria', { kind: 'cura', n: 12 }, { limit: cd(3), desc: 'Ogni 3 s: Cura 12' })],
  anticipo:       [riga('inizio', 'se', { kind: 'carica', secondi: 2 }, { desc: 'All\'inizio: Carica 2 s a sé' })],
  crescendo:      [riga('ogniSecondi', 'se', { kind: 'dannoPct', pct: 0.06, durata: 'battaglia' }, { limit: cd(3), desc: 'Ogni 3 s: +6% danno per il resto della battaglia' })],
  vendetta:       [riga('koAlleato', 'se', { kind: 'dannoPct', pct: 0.3, durata: 'battaglia' }, { desc: 'Al KO alleato: +30% danno' })],
  frantumazione:  [riga('lancio', 'squadraNemica', { kind: 'vulnerabile', secondi: 2 }, { cond: { chance: 0.5 }, limit: cd(3), desc: 'Al lancio: 50% Vulnerabile 2 s' })],
  gelo:           [riga('lancio', 'opposto', { kind: 'gelo', secondi: 2 }, { cond: { chance: 0.25 }, limit: cd(4), desc: 'Al lancio: 25% Gelo 2 s' })],
}
```
(`crescendo`/`vendetta` dello spec parlano di `+atk`: qui diventano `dannoPct` perché `atk` non è modificabile a runtime dal motore; equivalenza ≈ +6 atk su 20 = +30% → si usa +6%/3 s per non esagerare. `roccia` "−5% danno subito" → Scudo iniziale, perché `dannoSubitoPct` non è un effetto di riga.)

- [ ] **Step 2: Reliquie**

```ts
// data/relicsRt.ts — spec §7.1. Solo hook/grant/keywordMult: le stat restano in applyRelicBonuses.
import type { AbilityLine, RelicRt, RtSideMods } from '@/types/rt'
import { riga, cd } from './abilities/util'

const R = (id: string, r: Omit<RelicRt, 'id'>): RelicRt => ({ id, ...r })
const ogni = (s: number, line: AbilityLine): AbilityLine => ({ ...line, trigger: 'ogniSecondi', limit: cd(s) })

export const RELICS_RT: Record<string, RelicRt> = Object.fromEntries(([
  // ── stat-only: nessuna traduzione (applyRelicBonuses) ──
  R('giratempo', {}), R('mantello-invisibilita', {}), R('medaglione-serpeverde', {}), R('diadema-corvonero', {}), R('pensatoio', {}), R('bacchetta-sambuco', {}),
  R('patto-vorace', {}), R('sete-di-sangue', { lines: [ogni(3, riga('ogniSecondi', 'squadraPropria', { kind: 'danno', potenza: 0 }))] }),   // vedi sotto: sete → danno 6 ogni 3 s
  R('fame-vorace', {}), R('collezionista-anime', {}), R('marchio-vorace', { mods: {} }), R('marcia-di-guerra', {}), R('fortezza-vivente', {}), R('vento-crescente', {}), R('eredita-dei-caduti', {}),
  R('ultimo-baluardo', {}), R('branco-ristretto', {}), R('diario-riddle', {}), R('mano-della-gloria', {}), R('specchio-erised', { lines: [riga('ogniSecondi', 'squadraPropria', { kind: 'cura', n: 10 }, { limit: cd(3) })] }),
  // ── esecuzione ──
  R('mappa-malandrino', { lines: [riga('continuo', 'squadraPropria', { kind: 'dannoPct', pct: 0.12 }, { cond: { hpNemicaSotto: 0.5 } })] }),
  R('spada-grifondoro', { lines: [riga('continuo', 'squadraPropria', { kind: 'dannoPct', pct: 0.4 }, { cond: { hpNemicaSotto: 0.3 } })] }),
  R('sigillo-carnefice', { mods: { sogliaBonusPerKo: { step: 0.05, cap: 0.25 } } }),
  R('corona-spettrale', { lines: [riga('continuo', 'squadraPropria', { kind: 'dannoPct', pct: 0.5 }, { cond: { hpNemicaSotto: 0.4 } })] }),
  // ── scudo / rigen ──
  R('ricordatutto', { lines: [riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 10 })] }),
  R('pietra-resurrezione', { lines: [riga('inizio', 'squadraPropria', { kind: 'scudoIniziale', n: 30 })] }),
  R('coppa-tassorosso', { lines: [riga('ogniSecondi', 'squadraPropria', { kind: 'cura', n: 14 }, { limit: cd(3), cond: { inSquadra: { tag: 'tassorosso3' } } })] }),   // vedi nota: condizione di casa
  R('egida-tassorosso', { mods: { curaEccessoToScudo: 0.5 } }),
  R('cuore-del-tasso', { mods: { scudoProdottoMult: 1.5 } }),
  // ── veleno ──
  R('ampolla-veleno', { mods: { velenoMult: 1.5 } }),
  R('pugnale-bellatrix', { lines: [riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 1 }, { limit: cd(2) })] }),
  R('boccino-doro', { lines: [riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 1 }, { cond: { chance: 0.25 }, limit: { senzaCooldown: true } })] }),
  R('zanna-vorace', { lines: [riga('lancio', 'squadraNemica', { kind: 'segno', segno: 'veleno', stacks: 2 }, { limit: cd(2) })] }),
  R('calice-avvelenato', { mods: { velenoMult: 2 } }),
  // ── magie oscure ──
  R('marchio-nero', { mods: { magieOscure: { bonus: 0.5, recoil: 0.2 } } }),
  R('patto-di-sangue', { carrierLines: [riga('continuo', 'se', { kind: 'dannoPct', pct: 0.6 })], mods: { magieOscure: { bonus: 0, recoil: 0.25 } } }),
  R('diadema-corrotto', { mods: { magieOscure: { bonus: 0.15, recoil: 0 } } }),
  // ── altro ──
  R('occhio-magico', { mods: { ignoraCopertura: true } }),
  R('lacrime-fenice', {}),   // consumabile: il run layer lo trasforma in +3 vite (spec §7.1)
  R('furia-morente', { lines: [riga('sottoSoglia', 'squadraPropria', { kind: 'dannoPct', pct: 0.2, durata: 6 }, { cond: { hpPropriaSotto: 0.4 } })] }),
  R('canto-del-cigno', { lines: [riga('koAlleato', 'squadraPropria', { kind: 'dannoPct', pct: 0.2, durata: 6 })] }),
  R('assalto-d-apertura', { lines: [riga('inizio', 'squadraPropria', { kind: 'dannoPct', pct: 0.2, durata: 6 })] }),
] as RelicRt[]).map(r => [r.id, r]))

export const relicRt = (id: string): RelicRt => RELICS_RT[id] ?? { id }
```
Correzioni da applicare nel file prima di committare (sono decisioni, non opzioni): (1) `sete-di-sangue`: il motore non ha "danno a sé stessi" da riga; usare `lines: [riga('ogniSecondi', 'squadraPropria', { kind: 'cura', n: -6 }, { limit: cd(3) })]`? No: `heal` con n negativo non è supportato. Ruling: `sete-di-sangue` = `{}` (solo il +50 atk di `bonus`; il drawback di regen sparisce: lo si registra nel report e nel testo della reliquia al Piano 5). (2) `coppa-tassorosso`: la condizione "≥3 Tassorosso" la valuta già `applyRelicBonuses` per le stat; per la riga, usare `cond: { inSquadra: { tag: undefined } }`? Non esiste una cond "casa ≥3". Ruling: la riga `ogniSecondi cura 14` è **senza cond** e l'adapter la include solo se `relicMatchesCondition(team, relic.condition)` è vero (esiste in `game/engine/relics.ts`). Scrivere quindi `R('coppa-tassorosso', { lines: [riga('ogniSecondi', 'squadraPropria', { kind: 'cura', n: 14 }, { limit: cd(3) })] })` e l'adapter (Task 6) applica il gate. (3) `marchio-vorace`: `{ mods: {} }` → `{}`. (4) Per `magieOscure`, `RtSideMods.magieOscure` è unico per lato: l'adapter **somma** i bonus e i recoil di tutte le reliquie oscure attive (Task 6). (5) `patto-di-sangue` ha `carrierLines` (riga Continuo del portatore) e `mods` con solo recoil: il +60% è del portatore, il contraccolpo è di lato.

- [ ] **Step 3: Test**

```ts
// tests/data/rtContent.test.ts — aggiungere
import { TRAIT_LINES_RT } from '@/data/traitsRt'
import { RELICS_RT } from '@/data/relicsRt'
import { TRAITS } from '@/data/traits'
import { RELICS } from '@/data/relics'

describe('tratti e reliquie rt', () => {
  it('ogni tratto shiny ha una traduzione con righe valide', () => {
    for (const t of TRAITS) {
      const lines = TRAIT_LINES_RT[t.id]
      expect(lines, t.id).toBeTruthy(); expect(lines!.length).toBeGreaterThan(0)
      lines!.forEach((l, i) => checkLine({ id: t.id, name: t.name, lines: [], lv4: undefined } as unknown as Ability, l, `tratto #${i}`))
    }
    expect(Object.keys(TRAIT_LINES_RT).length).toBe(TRAITS.length)
  })
  it('ogni reliquia ha una voce rt (anche vuota) e le righe sono valide', () => {
    for (const r of RELICS) {
      const rt = RELICS_RT[r.id]
      expect(rt, r.id).toBeTruthy()
      ;[...(rt!.lines ?? []), ...(rt!.carrierLines ?? [])].forEach((l, i) => checkLine({ id: r.id, name: r.name, lines: [], lv4: undefined } as unknown as Ability, l, `reliquia #${i}`))
      if (rt!.carrierLines?.length) expect(r.assignable, `${r.id}: carrierLines solo su reliquie assegnabili`).toBe(true)
    }
    expect(Object.keys(RELICS_RT).length).toBe(RELICS.length)
  })
  it('le reliquie con hook/keyword nel motore vecchio hanno una traduzione non vuota', () => {
    for (const r of RELICS) {
      const old = !!(r.triggers?.length || r.keywordMult || r.grantsExecute || r.grantsAlwaysHit || r.grantsShieldConvert || r.grantsDarkMagic)
      const rt = RELICS_RT[r.id]!
      const has = !!((rt.lines?.length ?? 0) || (rt.carrierLines?.length ?? 0) || (rt.mods && Object.keys(rt.mods).length))
      if (old && r.id !== 'coppa-tassorosso') expect(has, `${r.id}: aveva hook/keyword, ora vuota`).toBe(true)
    }
  })
})
```
`checkLine` accetta un `Ability` finto: la firma è `(a: Ability, l, where)` e legge solo `a.id`. Rendere `checkLine` esportata a livello di modulo del test (già lo è).

- [ ] **Step 4: Eseguire → PASS; typecheck. Commit**
```bash
git add data/traitsRt.ts data/relicsRt.ts tests/data/rtContent.test.ts
git commit -m "feat(rt-content): tratti shiny (16) e reliquie (40) nel vocabolario rt"
```

---

### Task 6: Adapter — da DraftedWizard a RtUnitInput, da squadra a RtSideMods

**Files:**
- Create: `game/engine/rt/adapter/unit.ts`, `game/engine/rt/adapter/sideMods.ts`, `game/engine/rt/adapter/index.ts`
- Modify: `game/engine/rt/index.ts` (re-export dell'adapter), `game/engine/rt/damage.ts` (una riga: `heal` non emette l'evento `cura` se `n <= 0`)
- Test: `tests/engine/rt/adapter.test.ts`

**Interfaces:**
- Consumes: `applyRelicBonuses(stats, team, relics, wizardId)` e `relicMatchesCondition(team, condition)` da `@/game/engine/relics`; `tagsOf(dw)` da `@/game/engine/roster`; `detectDuos(team, relics)` da `@/game/engine/duos`; `trioGates(team, duos)` da `@/game/engine/trios`; `signalGrade(sig, team, relics)` da `@/game/engine/duos`; `draftWizard(rng, wizard)` da `@/game/engine/statRoll` (per i test); `WIZARD_BY_ID`; `SPELL_RT_BY_ID`, `RT_SPELL_BY_WIZARD`, `ABILITY_BY_ID`, `TRAIT_LINES_RT`, `RELICS_RT`.
- Produces:
  - `fromDrafted(dw: DraftedWizard, slot: number, team: DraftedWizard[], relics: ActiveRelic[], extras?: RtRunExtras): RtUnitInput`
  - `sideModsFor(team: DraftedWizard[], relics: ActiveRelic[]): RtSideMods`
  - `toRtSide(team, relics, extrasById?): { units: RtUnitInput[]; mods: RtSideMods }` — slot = `dw.slot ?? indice` (il campo `slot` non esiste ancora su `DraftedWizard`: leggere `(dw as { slot?: number }).slot`)
  - `simulateTeams(left: DraftedWizard[], right: DraftedWizard[], rng: Rng, opts?: { leftRelics?: ActiveRelic[]; rightRelics?: ActiveRelic[]; kind?: 'normal'|'elite'|'boss'; leftExtras?: Record<string, RtRunExtras>; rightExtras?: Record<string, RtRunExtras>; maxSeconds?: number }): RtBattleResult`

Mappa Duo → mods (spec §6.1): `cancrena → cancrenaSotto 0.4` · `miasma → contagioOnKo 3` · `untore → untore true` · `muro-vivente → muroVivente 0.5` · `esecuzione-a-freddo → esecuzioneAFreddo true` · `mietitore → mietitore 6`.
Trio (spec §6.2, `trioGates` restituisce `{house, grade}`): Grifondoro → `fiammaNonDecade true` (+ grado 1: `segnoOnCast.fiamma 1`) · Serpeverde → `segnoOnCast.veleno 1` (grado 1: 2) · Corvonero → `segnoOnCast.scossa 1` (grado 1: 2) · Tassorosso → `scudoInizialeMult 1.5` (grado 1: 2).
Archetipi grado 2 (`signalGrade(sig, team, relics) === 2`, spec §6.3): veleno → `velenoMult ×1.5` e `conduzioneSecondi 8` · esecuzione → `sogliaBonusPerKo {0.05, 0.25}` · scudirigen → `scudoProdottoMult ×1.5`, `curaEccessoToScudo 0.35` · magieOscure → `magieOscure.bonus +0.3`.
Reliquie: per ogni `ActiveRelic` con `RELICS_RT[id]`: `mods` fusi (moltiplicatori si moltiplicano, `magieOscure` si somma, booleani OR, `sogliaBonusPerKo` prende step/cap massimi), `lines` aggiunte solo se `relicMatchesCondition(team, relic.condition)`; `carrierLines` vanno nel `fromDrafted` del mago `assignedTo`.

- [ ] **Step 1: Test**

```ts
// tests/engine/rt/adapter.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { fromDrafted, sideModsFor, toRtSide, simulateTeams } from '@/game/engine/rt/adapter'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARD_BY_ID } from '@/data/wizards'
import { RELIC_BY_ID } from '@/data/relics'
import type { ActiveRelic, DraftedWizard } from '@/types'

const dw = (id: string, seed = 1) => draftWizard(createRng(seed), WIZARD_BY_ID[id]!)
const team = (...ids: string[]) => ids.map((id, i) => dw(id, i + 1))
const relic = (id: string, assignedTo?: string): ActiveRelic => ({ relic: RELIC_BY_ID[id]!, stageObtained: 0, assignedTo })

describe('fromDrafted', () => {
  it('mappa stat, tag, spell rt, abilità, livello clampato', () => {
    const t = team('harry'); const u = fromDrafted({ ...t[0]!, level: 9 }, 2, t, [])
    expect(u.id).toBe('harry'); expect(u.slot).toBe(2); expect(u.level).toBe(4)
    expect(u.spell.id).toBe('expelliarmus'); expect(u.ability!.id).toBe('harry'); expect(u.tags).toContain('trio')
    expect(u.stats.atk).toBe(t[0]!.stats.atk)
  })
  it('reliquia assegnata: stat del portatore e carrierLines', () => {
    const t = team('snape'); const r = [relic('giratempo', 'snape'), relic('patto-di-sangue', 'snape')]
    const u = fromDrafted(t[0]!, 0, t, r)
    expect(u.stats.spd).toBe(t[0]!.stats.spd + 30)
    expect(u.extraLines?.some(l => l.effect.kind === 'dannoPct')).toBe(true)
  })
  it('shiny: righe del tratto in extraLines; extras: memoria e permanenti', () => {
    const t = team('cho'); const u = fromDrafted({ ...t[0]!, shiny: { traitId: 'gelo' } }, 0, t, [], { memoria: { glacius: 3 }, permanenti: { dannoFlat: 2 } })
    expect(u.extraLines?.length).toBe(1); expect(u.memoria).toEqual({ glacius: 3 }); expect(u.permanenti).toEqual({ dannoFlat: 2 })
  })
  it('corrotto passa; mago senza abilità rt lancia', () => {
    const t = team('draco'); expect(fromDrafted({ ...t[0]!, corrotto: true }, 0, t, []).corrotto).toBe(true)
    const fake = { ...t[0]!, wizard: { ...t[0]!.wizard, id: 'nessuno' } } as DraftedWizard
    expect(() => fromDrafted(fake, 0, [fake], [])).toThrow(/nessuno/)
  })
})

describe('sideModsFor', () => {
  it('Duo Cancrena (veleno + esecuzione) → cancrenaSotto', () => {
    const t = team('snape', 'bellatrix', 'harry')   // veleno: bellatrix; esecuzione: snape, bellatrix, harry → entrambi accesi? veleno servono 2: bellatrix + ...
    const m = sideModsFor(team('bellatrix', 'dolohov', 'harry', 'snape'), [])   // veleno: bellatrix, dolohov; esecuzione: harry, snape, bellatrix
    expect(m.cancrenaSotto).toBe(0.4)
    void t
  })
  it('Trio Serpeverde (≥3 Serpeverde + un Duo) → segnoOnCast veleno', () => {
    const m = sideModsFor(team('bellatrix', 'dolohov', 'snape', 'draco'), [])   // Duo cancrena + 4 Serpeverde → grado 1
    expect(m.segnoOnCast?.veleno).toBe(2)
  })
  it('archetipo veleno grado 2 (3 tag) → velenoMult 1.5 e conduzione 8', () => {
    const m = sideModsFor(team('bellatrix', 'dolohov', 'greyback'), [])
    expect(m.velenoMult).toBeCloseTo(1.5); expect(m.conduzioneSecondi).toBe(8)
  })
  it('reliquie: mods fusi, righe gated dalla condizione di casa, magie oscure sommate', () => {
    const t = team('hannah', 'ernie', 'sprout')
    const m = sideModsFor(t, [relic('ampolla-veleno'), relic('calice-avvelenato'), relic('coppa-tassorosso'), relic('marchio-nero', 'hannah'), relic('diadema-corrotto')])
    expect(m.velenoMult).toBeCloseTo(3)
    expect(m.lines?.some(l => l.effect.kind === 'cura')).toBe(true)
    expect(m.magieOscure).toEqual({ bonus: 0.65, recoil: 0.2 })
    const m2 = sideModsFor(team('harry'), [relic('coppa-tassorosso')])
    expect(m2.lines ?? []).toHaveLength(0)
  })
})

describe('toRtSide e simulateTeams', () => {
  it('slot dal campo slot se presente, altrimenti indice; simulazione reale finisce con un vincitore', () => {
    const l = team('harry', 'ron', 'hermione'); (l[2] as { slot?: number }).slot = 4
    const side = toRtSide(l, [])
    expect(side.units.map(u => u.slot)).toEqual([0, 1, 4])
    const r = simulateTeams(l, team('draco', 'goyle', 'pansy'), createRng(3))
    expect(['left', 'right']).toContain(r.winner); expect(r.events.some(e => e.kind === 'cast')).toBe(true)
  })
  it('è deterministico con le stesse squadre e lo stesso seed', () => {
    const a = simulateTeams(team('harry', 'ron', 'hermione'), team('draco', 'goyle', 'pansy'), createRng(3))
    const b = simulateTeams(team('harry', 'ron', 'hermione'), team('draco', 'goyle', 'pansy'), createRng(3))
    expect(a.events).toEqual(b.events)
  })
})
```
Il primo test di `sideModsFor` ha una riga inutile (`const t…; void t`): toglierla. Se una squadra scelta non accende il Duo atteso (i tag sono in `data/wizards.ts`: veleno = bellatrix, dolohov, greyback, pansy, theodore, blaise; esecuzione = voldemort, harry, snape, bellatrix, sirius, lucius, draco, greyback, marcus), cambiare la squadra nel test, non l'adapter.

- [ ] **Step 2: Implementare**

```ts
// game/engine/rt/adapter/unit.ts
import type { ActiveRelic, DraftedWizard } from '@/types'
import type { AbilityLine, RtRunExtras, RtUnitInput } from '@/types/rt'
import { applyRelicBonuses } from '@/game/engine/relics'
import { tagsOf } from '@/game/engine/roster'
import { SPELL_RT_BY_ID } from '@/data/spellsRt'
import { RT_SPELL_BY_WIZARD } from '@/data/rtLoadout'
import { ABILITY_BY_ID } from '@/data/abilities'
import { TRAIT_LINES_RT } from '@/data/traitsRt'
import { RELICS_RT } from '@/data/relicsRt'

const clampLevel = (n: number | undefined): 1 | 2 | 3 | 4 => Math.max(1, Math.min(4, Math.round(n ?? 1))) as 1 | 2 | 3 | 4

export function fromDrafted(dw: DraftedWizard, slot: number, team: DraftedWizard[], relics: ActiveRelic[], extras: RtRunExtras = {}): RtUnitInput {
  const id = dw.wizard.id
  const spellId = RT_SPELL_BY_WIZARD[id]
  const spell = spellId ? SPELL_RT_BY_ID[spellId] : undefined
  if (!spell) throw new Error(`nessuna spell rt per ${id}`)
  const ability = ABILITY_BY_ID[id]
  if (!ability) throw new Error(`nessuna abilità rt per ${id}`)
  const extraLines: AbilityLine[] = []
  if (dw.shiny) extraLines.push(...(TRAIT_LINES_RT[dw.shiny.traitId] ?? []))
  for (const ar of relics) if (ar.assignedTo === id) extraLines.push(...(RELICS_RT[ar.relic.id]?.carrierLines ?? []))
  return {
    id, name: dw.wizard.name, house: dw.wizard.house, role: dw.wizard.role, tier: dw.wizard.tier, tags: tagsOf(dw),
    stats: applyRelicBonuses(dw.stats, team, relics, id), level: clampLevel(dw.level), slot, spell, ability,
    extraLines: extraLines.length ? extraLines : undefined,
    memoria: extras.memoria, permanenti: extras.permanenti, corrotto: dw.corrotto ?? false,
  }
}
```

```ts
// game/engine/rt/adapter/sideMods.ts
import type { ActiveRelic, DraftedWizard } from '@/types'
import type { AbilityLine, RtSideMods } from '@/types/rt'
import { detectDuos, signalGrade } from '@/game/engine/duos'
import { trioGates } from '@/game/engine/trios'
import { relicMatchesCondition } from '@/game/engine/relics'
import { RELICS_RT } from '@/data/relicsRt'

function mergeMods(into: RtSideMods, add: Partial<RtSideMods>): void {
  for (const [k, v] of Object.entries(add) as [keyof RtSideMods, unknown][]) {
    if (v === undefined) continue
    switch (k) {
      case 'velenoMult': case 'scudoInizialeMult': case 'scudoProdottoMult': into[k] = (into[k] ?? 1) * (v as number); break
      case 'muroVivente': case 'curaEccessoToScudo': case 'dannoPct': case 'dannoSubitoPct': case 'curaPct': case 'contagioOnKo': case 'mietitore': into[k] = (into[k] ?? 0) + (v as number); break
      case 'cancrenaSotto': case 'conduzioneSecondi': into[k] = Math.max(into[k] ?? 0, v as number); break
      case 'magieOscure': { const cur = into.magieOscure ?? { bonus: 0, recoil: 0 }; const n = v as { bonus: number; recoil: number }; into.magieOscure = { bonus: cur.bonus + n.bonus, recoil: cur.recoil + n.recoil }; break }
      case 'sogliaBonusPerKo': { const cur = into.sogliaBonusPerKo; const n = v as { step: number; cap: number }; into.sogliaBonusPerKo = cur ? { step: Math.max(cur.step, n.step), cap: Math.max(cur.cap, n.cap) } : n; break }
      case 'segnoOnCast': { into.segnoOnCast = { ...(into.segnoOnCast ?? {}) }; for (const [s, n] of Object.entries(v as Record<string, number>)) (into.segnoOnCast as Record<string, number>)[s] = ((into.segnoOnCast as Record<string, number>)[s] ?? 0) + n; break }
      case 'lines': into.lines = [...(into.lines ?? []), ...(v as AbilityLine[])]; break
      default: (into as Record<string, unknown>)[k] = (into as Record<string, unknown>)[k] || v   // booleani: OR
    }
  }
}

const DUO_MODS: Record<string, Partial<RtSideMods>> = {
  'cancrena': { cancrenaSotto: 0.4 }, 'miasma': { contagioOnKo: 3 }, 'untore': { untore: true },
  'muro-vivente': { muroVivente: 0.5 }, 'esecuzione-a-freddo': { esecuzioneAFreddo: true }, 'mietitore': { mietitore: 6 },
}

export function sideModsFor(team: DraftedWizard[], relics: ActiveRelic[]): RtSideMods {
  const m: RtSideMods = {}
  const duos = detectDuos(team, relics)
  for (const d of duos) mergeMods(m, DUO_MODS[d.duo.id] ?? {})
  for (const { house, grade } of trioGates(team, duos)) {
    if (house === 'Grifondoro') mergeMods(m, grade === 1 ? { fiammaNonDecade: true, segnoOnCast: { fiamma: 1 } } : { fiammaNonDecade: true })
    if (house === 'Serpeverde') mergeMods(m, { segnoOnCast: { veleno: grade === 1 ? 2 : 1 } })
    if (house === 'Corvonero') mergeMods(m, { segnoOnCast: { scossa: grade === 1 ? 2 : 1 } })
    if (house === 'Tassorosso') mergeMods(m, { scudoInizialeMult: grade === 1 ? 2 : 1.5 })
  }
  if (signalGrade('veleno', team, relics) === 2) mergeMods(m, { velenoMult: 1.5, conduzioneSecondi: 8 })
  if (signalGrade('esecuzione', team, relics) === 2) mergeMods(m, { sogliaBonusPerKo: { step: 0.05, cap: 0.25 } })
  if (signalGrade('scudirigen', team, relics) === 2) mergeMods(m, { scudoProdottoMult: 1.5, curaEccessoToScudo: 0.35 })
  if (signalGrade('magieOscure', team, relics) === 2) mergeMods(m, { magieOscure: { bonus: 0.3, recoil: 0 } })
  for (const ar of relics) {
    const rt = RELICS_RT[ar.relic.id]
    if (!rt) continue
    if (rt.mods) mergeMods(m, rt.mods)
    if (rt.lines?.length && relicMatchesCondition(team, ar.relic.condition)) mergeMods(m, { lines: rt.lines })
  }
  return m
}
```

```ts
// game/engine/rt/adapter/index.ts
import type { ActiveRelic, DraftedWizard } from '@/types'
import type { Rng } from '@/game/engine/rng'
import type { RtBattleResult, RtRunExtras, RtSideMods, RtUnitInput } from '@/types/rt'
import { simulateRt } from '../simulate'
import { fromDrafted } from './unit'
import { sideModsFor } from './sideMods'
export { fromDrafted, sideModsFor }

export function toRtSide(team: DraftedWizard[], relics: ActiveRelic[], extrasById: Record<string, RtRunExtras> = {}): { units: RtUnitInput[]; mods: RtSideMods } {
  const units = team.map((dw, i) => fromDrafted(dw, (dw as { slot?: number }).slot ?? i, team, relics, extrasById[dw.wizard.id]))
  return { units, mods: sideModsFor(team, relics) }
}

export interface SimulateTeamsOpts { leftRelics?: ActiveRelic[]; rightRelics?: ActiveRelic[]; kind?: 'normal' | 'elite' | 'boss'; leftExtras?: Record<string, RtRunExtras>; rightExtras?: Record<string, RtRunExtras>; maxSeconds?: number }

export function simulateTeams(left: DraftedWizard[], right: DraftedWizard[], rng: Rng, opts: SimulateTeamsOpts = {}): RtBattleResult {
  const L = toRtSide(left, opts.leftRelics ?? [], opts.leftExtras)
  const R = toRtSide(right, opts.rightRelics ?? [], opts.rightExtras)
  return simulateRt(L.units, R.units, rng, { leftMods: L.mods, rightMods: R.mods, kind: opts.kind, maxSeconds: opts.maxSeconds })
}
```
In `game/engine/rt/index.ts` aggiungere `export { fromDrafted, sideModsFor, toRtSide, simulateTeams } from './adapter'`. In `damage.ts` `heal`: spostare l'`emit` dell'evento `cura` dentro `if (n > 0)` (chiude il minor parcheggiato dal Piano 1) e adeguare il test esistente se asseriva l'evento a 0.

- [ ] **Step 3: Eseguire → PASS (`npx vitest run tests/engine/rt`); typecheck. Commit**
```bash
git add game/engine/rt/adapter game/engine/rt/index.ts game/engine/rt/damage.ts tests/engine/rt
git commit -m "feat(rt-content): adapter — da DraftedWizard a RtUnitInput, Duo/Trio/archetipi/reliquie a RtSideMods, simulateTeams"
```

---

### Task 7: Integrazione — catene, mono-casa, copertura delle abilità

**Files:**
- Test: `tests/engine/rt/content.test.ts`

**Interfaces:** nessuna nuova. Prova che il contenuto reale, passato per l'adapter, produce le catene di §5 e che ogni abilità scatta almeno una volta in una sonda.

- [ ] **Step 1: Test**

```ts
// tests/engine/rt/content.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { simulateTeams } from '@/game/engine/rt/adapter'
import { draftWizard } from '@/game/engine/statRoll'
import { createRng } from '@/game/engine/rng'
import { WIZARDS, WIZARD_BY_ID } from '@/data/wizards'
import { ABILITIES } from '@/data/abilities'
import type { DraftedWizard } from '@/types'

const dw = (id: string, seed = 1, level = 1) => ({ ...draftWizard(createRng(seed), WIZARD_BY_ID[id]!), level })
const team = (...ids: string[]) => ids.map((id, i) => dw(id, i + 1))
const dummies = (n: number, hp = 400) => Array.from({ length: n }, (_, i) => ({ ...dw('goyle', 100 + i), stats: { hp, atk: 1, def: 0, spd: 1 } }))
const ev = (r: ReturnType<typeof simulateTeams>, kind: string, name?: string) => r.events.filter(e => e.kind === kind && (!name || e.name === name))

describe('catene di §5', () => {
  it('Weasley-motore: Fred e George si innescano a vicenda, Arthur carica', () => {
    const l = team('arthur', 'fred', 'george', 'ginny', 'molly', 'ron')
    const r = simulateTeams(l, dummies(3, 2000), createRng(1), { maxSeconds: 20 })
    expect(ev(r, 'innesco').length).toBeGreaterThanOrEqual(2)
    expect(ev(r, 'carica').length).toBeGreaterThanOrEqual(2)
  })
  it('Mangiamorte-KO: sotto il 30% Voldemort fa KO', () => {
    const l = team('lucius', 'bellatrix', 'voldemort', 'snape')
    const r = simulateTeams(l, dummies(3, 300), createRng(2), { maxSeconds: 40 })
    expect(ev(r, 'ko').length).toBeGreaterThanOrEqual(1)
  })
  it('Gelo-frantuma: Cho/Terry gelano, Viktor frantuma', () => {
    const l = team('cho', 'terry', 'viktor', 'michael')
    const r = simulateTeams(l, dummies(3, 1500), createRng(3), { maxSeconds: 30 })
    expect(ev(r, 'reazione', 'Frantuma').length).toBeGreaterThanOrEqual(1)
  })
  it('Veleno: Snape/Draco stack, Dolohov innesca Miasma', () => {
    const l = team('snape', 'draco', 'dolohov', 'blaise')
    const r = simulateTeams(l, dummies(3, 1500), createRng(4), { maxSeconds: 30 })
    expect(ev(r, 'reazione', 'Miasma').length).toBeGreaterThanOrEqual(1)
    expect(r.frames.at(-1)!.segni[1].veleno).toBeGreaterThan(0)
  })
  it('Corvonero-deflagrazione: Michael/Flitwick scossa + Fleur fiamma', () => {
    const l = team('flitwick', 'michael', 'fleur', 'terry')
    const r = simulateTeams(l, dummies(3, 1500), createRng(5), { maxSeconds: 30 })
    expect(ev(r, 'reazione', 'Deflagrazione').length).toBeGreaterThanOrEqual(1)
  })
  it('Tassorosso-muro: scudo continuo, Baluardo sulle cure', () => {
    const l = team('ernie', 'eloise', 'cedric', 'sprout', 'hannah')
    const r = simulateTeams(l, dummies(3, 1500), createRng(6), { maxSeconds: 30 })
    expect(ev(r, 'scudo').length).toBeGreaterThanOrEqual(3)
    expect(ev(r, 'reazione', 'Baluardo').length).toBeGreaterThanOrEqual(1)
  })
  it('Trio d\'oro: Hermione carica Harry davanti', () => {
    const l = [ { ...dw('harry', 1), slot: 1 }, { ...dw('hermione', 2), slot: 4 }, { ...dw('ron', 3), slot: 0 } ] as DraftedWizard[]
    const r = simulateTeams(l, dummies(3, 1500), createRng(7), { maxSeconds: 20 })
    expect(ev(r, 'carica').some(e => e.targetSlot === 1)).toBe(true)
  })
})

describe('mono-casa 6v6: finisce, entrambi lanciano, nessuna eccezione', () => {
  const HOUSES = { Grifondoro: ['harry', 'ron', 'hermione', 'ginny', 'neville', 'seamus'], Serpeverde: ['snape', 'draco', 'bellatrix', 'greyback', 'narcissa', 'pansy'], Corvonero: ['flitwick', 'cho', 'viktor', 'luna', 'kingsley', 'michael'], Tassorosso: ['cedric', 'sprout', 'ernie', 'tonks', 'hannah', 'justin'] }
  for (const [h, ids] of Object.entries(HOUSES)) it(h, () => {
    const r = simulateTeams(team(...ids), team('voldemort', 'lucius', 'dolohov', 'goyle', 'crabbe', 'theodore'), createRng(11))
    expect(['left', 'right']).toContain(r.winner)
    expect(ev(r, 'cast').some(e => e.side === 'left')).toBe(true); expect(ev(r, 'cast').some(e => e.side === 'right')).toBe(true)
  })
})

describe('copertura: ogni abilità scatta almeno una volta in una sonda', () => {
  // Sonda: il mago a lv4 (così lv4 è attiva) con due alleati della sua casa e, se l'abilità cita un mago/tag, quel mago/un portatore del tag;
  // nemici: 3 manichini con HP tarati per far scattare anche le soglie. Trigger non sondabili in una battaglia sola: 'vittoria' (run layer).
  const SKIP = new Set<string>([])   // riempire SOLO con id la cui riga non può scattare in questa sonda, motivando nel report
  const needsAlly = (a: typeof ABILITIES[number]) => {
    const out = new Set<string>()
    for (const l of [...a.lines, a.lv4!]) {
      const c = l.cond as Record<string, { wizardId?: string; tag?: string }> | undefined
      const ref = c?.adiacente ?? c?.inSquadra
      if (ref?.wizardId) out.add(ref.wizardId)
      if (ref?.tag) { const w = WIZARDS.find(w => w.id !== a.id && (w.tags ?? []).includes(ref.tag!)); if (w) out.add(w.id) }
      if (l.target === 'alleatiTag' && l.targetArg) { const w = WIZARDS.find(w => w.id !== a.id && (w.tags ?? []).includes(l.targetArg!)); if (w) out.add(w.id) }
      if (l.effect.kind === 'copre') out.add(l.effect.wizardId)
    }
    return [...out]
  }
  for (const a of ABILITIES) it(a.id, () => {
    if (SKIP.has(a.id)) return
    const w = WIZARD_BY_ID[a.id]!
    const mates = WIZARDS.filter(x => x.house === w.house && x.id !== a.id).slice(0, 2).map(x => x.id)
    const ids = [a.id, ...needsAlly(a), ...mates].filter((x, i, arr) => arr.indexOf(x) === i).slice(0, 6)
    const l = ids.map((id, i) => ({ ...dw(id, i + 1, id === a.id ? 4 : 1), slot: i })) as DraftedWizard[]
    // nemici: uno debole (per KO/soglie) e due medi
    const enemy = [{ ...dw('goyle', 50), stats: { hp: 60, atk: 12, def: 0, spd: 20 } }, ...dummies(2, 500).map(d => ({ ...d, stats: { ...d.stats, atk: 15, spd: 15 } }))]
    const r = simulateTeams(l, enemy, createRng(99), { maxSeconds: 40 })
    const fired = r.events.some(e => e.kind === 'trigger' && e.abilityId === a.id)
    const hasNonVittoria = [...a.lines, a.lv4!].some(x => x.trigger !== 'vittoria')
    if (hasNonVittoria) expect(fired, `${a.id}: nessuna riga scattata (eventi trigger: ${r.events.filter(e => e.kind === 'trigger').map(e => e.abilityId).join(',')})`).toBe(true)
  })
})
```
Regola per l'implementer: se un'abilità non scatta nella sonda, PRIMA capire perché (posizione? cond? cooldown?) e correggere la sonda (es. slot diversi, HP dei manichini) o — se la riga è davvero irraggiungibile — correggere l'abilità in `data/abilities/*` rendendola raggiungibile (è un difetto di contenuto). `SKIP` solo con motivazione scritta nel report. Le righe `continuo` non emettono `trigger`: un'abilità con SOLE righe continuo si considera scattata se `r.events` contiene almeno un `cast` del mago (aggiungere questa eccezione nel test: `const soloContinuo = [...a.lines, a.lv4!].every(x => x.trigger === 'continuo' || x.trigger === 'vittoria')` → allora `expect(ev(r,'cast').some(e => e.side === 'left' && e.slot === 0)).toBe(true)`).

- [ ] **Step 2: Eseguire; iterare finché è verde (`npx vitest run tests/engine/rt/content.test.ts`); poi `npx vitest run tests/engine/rt` e `npm run typecheck`. Commit**
```bash
git add tests/engine/rt/content.test.ts data/abilities
git commit -m "test(rt-content): catene di squadra, mono-casa 6v6 e copertura di tutte le abilità"
```

---

## Self-review

**Copertura della spec:** §4.4 spell → Task 1 (38 spell, tre note di traduzione dichiarate). §4.5 riassegnazione → Task 1 (`rtLoadout`, regola per casa e per ruolo testata). §5 abilità + §5.0 budget + regola cooldown → Task 2–4 (60, test di budget e cooldown). §7.2 tratti → Task 5. §7.1 reliquie → Task 5 (hook/grant/keyword) + Task 6 (stat via `applyRelicBonuses`, gate di condizione). §6.1–6.3 Duo/Trio/archetipi → Task 6. §8.2 `RtRunExtras` → Task 1/6. §5 catene → Task 7. Fuori piano (Piano 3): slot/livello/merge/memoria/permanenti su `DraftedWizard`, `vittoria`, boss, nemici; (Piano 5): testi delle reliquie cambiate (`sete-di-sangue`).

**Placeholder scan:** nessun TBD. I "ruling" scritti nei task sono decisioni, non opzioni.

**Coerenza dei nomi:** `riga/cd/una/libera` (util), `SPELLS_RT/SPELL_RT_BY_ID`, `RT_SPELL_BY_WIZARD`, `GRIFONDORO/SERPEVERDE/CORVONERO/TASSOROSSO/ABILITIES/ABILITY_BY_ID`, `TRAIT_LINES_RT`, `RELICS_RT/relicRt`, `fromDrafted/sideModsFor/toRtSide/simulateTeams`, `RtRunExtras/RelicRt`. `AbilityLine.limit.senzaCooldown` è nuovo (Task 1) e usato da `libera()`.

**Ordine:** 1 → 2 → 3 → 4 → 5 → 6 → 7.
