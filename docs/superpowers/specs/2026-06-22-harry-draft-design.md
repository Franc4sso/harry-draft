# Harry Draft — Design Spec

**Data:** 2026-06-22
**Tipo:** Gioco web roguelite a draft, ambientato nell'universo di Harry Potter, ispirato al sistema di draft di 7a0.

---

## 1. Obiettivo

Gioco web completo (non prototipo): il giocatore costruisce una squadra di **5 maghi** tramite draft, poi affronta **5 squadre CPU + 1 Boss Finale**. Ogni run è diversa (seed unico). Combattimento simulato, deterministico, senza controllo del giocatore e senza AI.

**Obiettivi di qualità:** codice professionale, modulare, facilmente estendibile (100+ maghi, nuove magie/case, reliquie, eventi, achievement, PvP, save online in futuro).

---

## 2. Stack

- Next.js 15 (App Router)
- React + TypeScript **strict**
- TailwindCSS
- Framer Motion
- Lucide Icons
- **Nessun database** in v1. Tutti i dati locali (TS/JSON).

---

## 3. Analisi game design (problemi risolti)

1. **Combattimento può non terminare** (es. 2 supporti che si curano). → Cap turni (100); a cap raggiunto vince la squadra con maggiore % HP totale residua (tiebreak deterministico su id).
2. **"Max 1 Tier 1 per draft"** ambiguo. → Max 1 Tier-1 per **schermata** di 5 carte; la luck-protection garantisce qualità sull'intera run.
3. **Luck protection (pity)** definita: se dopo 2 pick il team non ha alcun mago Tier ≤2, la 3ª schermata forza almeno una carta Tier ≤2.
4. **Crit/schivata** parametrizzati: crit derivato da Velocità, schivata da gap Velocità/Difesa; moltiplicatori in `data/constants.ts`.
5. **Bilanciamento sinergie:** bonus piatti/percentuali in JSON → ribilanciabili senza toccare codice.
6. **Coerenza magia↔ruolo:** `spellPool` per mago filtrato per coerenza di ruolo (un Supporto non pesca solo attacchi), ma con varietà piena dentro il ruolo.

**Miglioramenti adottati:**
- Bias di tier sul roll stat (Tier1 rolla vicino al max del range).
- Boss e squadre CPU sono **solo dati** (stessa struttura squadra + flag/modificatori), nessun codice speciale.
- Difficoltà CPU = power budget crescente per nemico (curva in config).

---

## 4. Decisioni chiave (confermate dall'utente)

- **Targeting combattimento:** euristica a priorità per ruolo. Regola esplicita: un **Attaccante** colpisce prima un **Tank**, poi l'HP più basso.
- **RNG:** seed unico per run, condivisibile. PRNG seeded iniettato nelle funzioni pure dell'engine. Sub-stream separati per fase (draft vs combat) così modifiche al combat non alterano il draft.
- **Visualizzazione combattimento:** replay animato a step (engine pre-calcola tutto il log; la UI lo riproduce). Skip previsto in milestone successiva.
- **Milestone 1:** fondamenta pure + test (types + data + engine), zero UI.
- **Magie:** ogni mago riceve **1** magia random dal proprio `spellPool` (4-6 magie compatibili per mago).
- **Contenuti v1:** **~45 maghi** (minimo 40), ~30-40 magie riusate tra i pool, sinergie complete (case, ruoli, gruppi, origini).

---

## 5. Architettura e cartelle

Principio: **engine = funzioni pure, RNG iniettato, zero React/DOM.** La UI consuma l'engine via hooks. Tutto deterministico dal seed.

```
harry-draft/
├── app/                          # Next 15 App Router
│   ├── layout.tsx
│   ├── page.tsx                  # menu iniziale
│   ├── rules/page.tsx
│   ├── credits/page.tsx
│   └── play/page.tsx             # macchina a stati: draft→team→battle→...
├── components/
│   ├── ui/                       # primitivi (Button, Bar, GlowCard...)
│   ├── cards/                    # WizardCard, CardBack, TierBadge
│   ├── draft/                    # DraftBoard, DraftSlot
│   ├── team/                     # TeamRoster, SynergyPanel, StatBlock
│   ├── battle/                   # BattleStage, HpBar, DamageFloat, BattleLog
│   └── screens/                  # MenuScreen, VictoryScreen, BossScreen
├── game/
│   └── engine/                   # PURO, no React, no DOM
│       ├── rng.ts                # PRNG seeded (mulberry32) + helpers
│       ├── statRoll.ts           # roll stat da range/tier bias
│       ├── draft.ts              # genera schermate, regole tier, luck-protection
│       ├── synergy.ts            # rileva sinergie attive, applica bonus
│       ├── combat/
│       │   ├── simulate.ts       # loop principale → BattleResult + log
│       │   ├── targeting.ts      # euristica bersaglio per ruolo
│       │   ├── selectSpell.ts    # scelta magia (cooldown, ruolo)
│       │   ├── resolve.ts        # calcolo danno/cura/crit/schivata
│       │   └── teamGen.ts        # costruisce squadre CPU/boss da budget
│       └── run.ts                # orchestratore: stato campagna end-to-end (sottile)
├── data/                         # SOLO dati, modificabili a mano
│   ├── wizards.ts                # ~45 maghi
│   ├── spells.ts                 # magie
│   ├── synergies.ts              # sinergie (case/origini/gruppi/ruoli)
│   ├── bosses.ts                 # boss
│   ├── houses.ts                 # case + colori/tema
│   └── constants.ts              # TUTTI i numeri tunabili (bilanciamento)
├── hooks/
│   ├── useRun.ts                 # gestisce intera run (reducer)
│   ├── useDraft.ts
│   └── useBattleReplay.ts        # riproduce log step-by-step animato
├── lib/                          # util generiche (cn, format, clamp)
├── types/                        # tipi TS condivisi
│   ├── wizard.ts spell.ts synergy.ts combat.ts run.ts index.ts
└── ...                           # config Next/Tailwind/TS strict
```

**Confini:**
- `game/engine/*` → input dati + seed, output dati. Testabile senza browser.
- `hooks/*` → ponte engine↔UI, gestiscono stato/animazione.
- `components/*` → solo presentazione, ricevono props già calcolate.
- `data/*` → nessuna logica, solo contenuto.

**Flusso dati:** `seed → run.ts → {draft screens, battle results, logs}` → hooks → componenti.

---

## 6. Motori

### 6.1 PRNG seeded (`rng.ts`)
`mulberry32(seed)` → stream deterministico. Helper: `int(min,max)`, `float()`, `pick(arr)`, `chance(p)`, `shuffle(arr)`. L'oggetto Rng viene passato esplicitamente a ogni funzione che consuma casualità. Sub-stream per fase.

### 6.2 Draft (`draft.ts`)
`generateScreen(rng, pool, pickedSoFar, screenIndex) → Wizard[5]`, regole in ordine:
1. Estrai 5 candidati pesati per tier (Tier4 frequente … Tier1 rarissimo).
2. **Cap Tier1:** max 1 Tier1 per schermata.
3. **Garanzia alta:** se la schermata ha 0 carte Tier ≤2, forza almeno una Tier2.
4. **Luck-protection (pity):** se dopo 2 pick il team ha 0 maghi Tier ≤2, la 3ª schermata forza una Tier ≤2.
Pesi/soglie in `data/constants.ts`. Le carte scartate non ritornano nella stessa run (varietà).

### 6.3 Stat roll (`statRoll.ts`)
Mago in `data/` ha `ranges` (`hp:[90,110]`…). `rollStats(rng, wizard)` pesca nel range con **bias di tier** (Tier alto → verso il max). `pickSpell(rng, wizard)` pesca 1 magia dal `spellPool`.

### 6.4 Sinergie (`synergy.ts`)
`data/synergies.ts` dichiarativo. Esempi:
```ts
{ id:'gryffindor3', kind:'house', requires:{ house:'Grifondoro', count:3 }, bonus:{ def:20 } }
{ id:'goldenTrio', kind:'group', requires:{ ids:['harry','ron','hermione'] }, bonus:{ allPct:0.15 } }
```
`detectSynergies(team) → ActiveSynergy[]`; `applyBonuses(unit, synergies) → buffedStats`. Bonus piatti + percentuali + regen. Nuova sinergia = solo dati.

Sinergie v1: Case ×4 (≥3), Ruoli ×4, Gruppi (Golden Trio, Famiglia Weasley, Mangiamorte, Ordine della Fenice, Malandrini, Esercito di Silente). Tag multipli per mago (un Weasley è Grifondoro + Weasley + Ordine).

### 6.5 Combat (`combat/*`)
Pre-calcola l'intero scontro → `BattleResult { winner, turns, log, mvpId, finalSnapshot }`.

**Loop turno:**
1. Ordina unità vive per Velocità (tiebreak deterministico su id).
2. Ogni unità: `selectSpell` (rispetta cooldown) → `selectTarget` → `resolve` → applica → log entry → rimuovi KO.
3. Ripeti finché una squadra è vuota o turno-cap (100) → tiebreak su % HP totale.

**Targeting per ruolo:**
- Attaccante → Tank nemico prioritario, poi HP più basso.
- Controllo → nemico con minaccia/velocità più alta (debuff/stun/dot).
- Supporto → alleato più ferito (cura); fallback attacco se nessuno ferito.
- Tank → nemico vicino a KO o che minaccia il supporto.

**Ruolo Controllo:** indebolisce i nemici (stun = salta turno, debuff = −stat per N turni, dot = danno nel tempo). Abilita gli altri ruoli; mantiene utili anche maghi di Tier basso.

**resolve (moltiplicatori in `constants.ts`):**
- danno = `atk * spell.power * tipoMod − def*k`, minimo 1.
- crit: `chance = base + spd*scale` → ×critMult.
- schivata: `chance = base + gap(spd,def)*scale` → 0 danno, flag `dodge`.
- cura/debuff/dot/stun da campi `spell`.
- ogni evento → `LogEntry`.

**MVP:** unità con (danno + cura) pesati più alti, dal log.

### 6.6 TeamGen (`teamGen.ts`)
`generateEnemyTeam(rng, powerBudget, opts) → DraftedWizard[5]` con le stesse regole del draft ma auto-pick verso il budget. Nemico N: budget crescente (curva config). Boss: budget alto + `boss:true` (HP×, magie speciali, sinergia esclusiva) — solo dati.

---

## 7. Tipi TypeScript (core)

```ts
type House = 'Grifondoro'|'Serpeverde'|'Corvonero'|'Tassorosso'
type Role = 'Attaccante'|'Tank'|'Supporto'|'Controllo'
type Tier = 1|2|3|4
type SpellType = 'Attacco'|'Difesa'|'Cura'|'Controllo'
type Stat = 'hp'|'atk'|'def'|'spd'

type Range = readonly [number, number]
interface StatRanges { hp:Range; atk:Range; def:Range; spd:Range }
interface Stats { hp:number; atk:number; def:number; spd:number }

interface Wizard {
  id:string; name:string; house:House; role:Role; tier:Tier
  ranges:StatRanges; spellPool:string[]; tags?:string[]
}

interface Spell {
  id:string; name:string; desc:string; type:SpellType
  power?:number; heal?:number; hitChance:number
  cooldown?:number; effects?:SpellEffect[]
}
interface SpellEffect { kind:'buff'|'debuff'|'dot'|'stun'; stat?:Stat; amount?:number; duration?:number }

interface Synergy {
  id:string; name:string; kind:'house'|'role'|'group'|'origin'
  requires:{ house?:House; role?:Role; count?:number; ids?:string[]; tag?:string }
  bonus: Partial<Record<Stat,number>> & { allPct?:number; regen?:number }
}

interface DraftedWizard { wizard:Wizard; stats:Stats; maxHp:number; spell:Spell }

interface ActiveEffect { kind:SpellEffect['kind']; stat?:Stat; amount?:number; remaining:number }
interface BattleUnit extends DraftedWizard {
  side:'left'|'right'; hp:number; cooldowns:Record<string,number>
  statusEffects:ActiveEffect[]; buffedStats:Stats; alive:boolean
}

interface LogEntry {
  turn:number; actorId:string; action:string; targetId?:string
  type:SpellType|'system'; value?:number; flags:('crit'|'dodge'|'kill'|'heal'|'block')[]
}
interface UnitSnapshot { id:string; hp:number; maxHp:number; alive:boolean }
interface BattleResult {
  winner:'left'|'right'; turns:number; log:LogEntry[]
  mvpId:string; finalSnapshot:UnitSnapshot[]
}

interface ActiveSynergy { synergy:Synergy; memberIds:string[] }
interface RunState {
  seed:string
  phase:'menu'|'draft'|'team'|'battle'|'victory'|'defeat'|'boss'|'win'
  team:DraftedWizard[]; activeSynergies:ActiveSynergy[]
  stage:number; lastBattle?:BattleResult
}
```
Tutto esportato da `types/index.ts`. Firma esempio: `simulateBattle(left:DraftedWizard[], right:DraftedWizard[], rng:Rng): BattleResult`.

---

## 8. Milestone

**M1 — Fondamenta (pure + test)** ← prima esecuzione
Scaffold Next15 + TS strict + Tailwind. Tutti i `types/`. `data/` completo (~45 maghi, magie, sinergie, boss, costanti). Engine: rng, statRoll, draft, synergy, combat completo, teamGen, run. Test unitari engine (determinismo da seed, regole tier, luck-protection, terminazione combattimento, sinergie). **Zero UI.**

**M2 — Shell UI + menu + design system**
Layout, tema case (colori/glow), primitivi `ui/`, `WizardCard` premium (glassmorphism/glow/hover Framer), menu + regole + credits.

**M3 — Draft giocabile**
`DraftBoard`, `useDraft`, animazioni scelta/scarto, transizione a team.

**M4 — Team + sinergie**
Roster, `StatBlock`, `SynergyPanel` (sinergie attive evidenziate), conferma squadra.

**M5 — Combattimento + replay**
`BattleStage`, `useBattleReplay` (step-by-step), HpBar animate, DamageFloat, glow magie, BattleLog, bottone Skip.

**M6 — Campagna + vittoria + boss**
`useRun` orchestrazione 5 nemici → boss, VictoryScreen (MVP/stats/prossimo), BossScreen dedicata, schermate win/defeat.

**M7 — Rifinitura**
Bilanciamento, seed condivisibile in UI, polish animazioni, edge cases.

**Roadmap futuro** (abilitato dall'architettura, fuori v1): reliquie, oggetti, eventi durante il draft, achievement, classifiche, seed condivisibili UI, modalità infinita, PvP, save online.

---

## 9. Stile grafico

Nessuna immagine/sprite/artwork. Stile carte da gioco moderno premium: ombre, glassmorphism leggero, glow, hover, transizioni Framer Motion. Ogni casa con palette propria.
