# Patto Oscuro (archetipo Oscurità) — Design

**Data:** 2026-07-23
**Scope:** attivazione (A) — accendere la sinergia `oscurita` dormiente e cablarla nel tracker + card, come i tre archetipi sorelle. Nessuna nuova meccanica di combattimento.

## Contesto

L'infrastruttura del 4° archetipo esiste già ma è **dormiente**:

- `game/engine/darkMagic.ts` — `teamDarkMagic()` dà +0.3 bonus a ogni mago `magieOscure` quando `synergy.id === 'oscurita'` è presente, e scala il bonus via `keywordDamageMult(..., 'magieOscure')`. Già cablato in `simulate.ts` (`darkMap`).
- Reliquie Marchio Nero (`bonus 0.5`, `recoil 0.2`) e Patto di Sangue (`bonus 0.6`, `recoil 0.25`) funzionano (bonus + contraccolpo al portatore).
- Maghi `magieOscure` e spell oscure (sectumsempra, avada, ardemonio) esistono.
- `lib/archetypes.ts` mostra `magieOscure` come nastro-only (nessun `synergyId`).

**Buco unico:** manca la voce `oscurita` in `data/synergies.ts`, quindi la sinergia non si attiva mai. Aggiungerla accende tutto il sistema già testato.

## Modifiche (4 file, solo dati/wiring, zero logica di combat nuova)

### 1. `data/synergies.ts` — l'interruttore
```ts
{ id: 'oscurita', name: 'Oscurità', kind: 'origin', requires: { tag: 'magieOscure', count: 3 }, bonus: { keywordMult: { magieOscure: 0.5 } } },
```
Soglia `count: 3`, come le sorelle. Il `keywordMult` 0.5 fa lavoro reale via il path esistente `keywordDamageMult` (stessa forma di Diadema Corrotto, già provato sicuro).

### 2. `lib/metaProgress.ts`
Aggiungere `'oscurita'` a `NAMED_SYNERGY_IDS` così sopravvive al filtro meta-progress come le tre sorelle.

### 3. `lib/archetypes.ts`
- `magieOscure` riceve `synergyId: 'oscurita'`.
- Voce in `ARCHETYPE_EFFECT`:
```ts
oscurita: 'Patto oscuro: le tue magie oscure colpiscono più forte, al prezzo del contraccolpo.'
```
Questo trasforma l'archetipo nastro-only in una Costellazione tracciata completa (2/3, attivo, testo effetto). L'`ArchetypeTracker` renderizza qualsiasi archetipo con `synergyId`.

### 4. Sicurezza nemici
Verificare che Oscurità rispetti le regole enemy-relic/bot esistenti. Maghi `magieOscure` esistono già sui deatheater nemici; le reliquie Marchio/Patto sono assignable. Le sorelle si attivano già sui nemici (memoria: "archetipi valgono anche per i nemici") — comportamento inteso, non regressione.

## Test (TDD, mirror delle sorelle)

- `synergies.test` — Oscurità rileva a 3 `magieOscure`, assente a 2.
- `archetypes.test` — `ARCHETYPE_BY_TAG.magieOscure.synergyId === 'oscurita'`, stringa effetto presente.
- `archetypeTracker.test` — `magieOscure` renderizza have/need/active come le altre.
- Engine smoke — `teamDarkMagic` ritorna bonus>0 per una squadra a 3 dark via il path sinergia.
- **Balance gate** — `tests/engine/campaignBalanceB` prima/dopo. Il mult 0.5 tocca solo squadre che già schierano 3 dark caster; movimento atteso minimo, ma il gate deve restare in-band (winRate > 0).

## Rischio

Basso. Nessun cambio al codice di combat; solo una voce dati che accende un sistema già cablato e testato. Watch-item principale: il balance gate, perché rende le squadre a 3-dark-caster (player *e* nemico) leggermente più forti.
