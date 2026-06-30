# Abilità "Mira Infallibile" — design (il counter al dodge)

> Data: 2026-06-30. Backlog `docs/superpowers/remaining-work.md` §1 item #2 (richiesta utente):
> abilità su alcuni maghi tier-2/3 che fanno **sempre andare a segno** i loro colpi (ignorano il
> dodge) — il counter diretto al dodge di casa **Grifondoro**. NON è un archetipo: è una *counter-
> ability* mirata. Slice leggero (no scaling-relic, no synergy: "sempre a segno" è binario, non scala).

## Concept

Oggi il dodge è un gate hardcoded nel damage handler (`game/engine/combat/effects.ts:37`):
```ts
if (eff.canDodge && dodged(ctx.rng, ctx.actor, ctx.target)) {
  ctx.flags.push('dodge'); return { value: 0, dodged: true }
}
```
`dodged()` (`effects.ts:25-30`) somma `dodgeBase + speedGap*dodgeScale + target.dodgeBonus`. Il
`dodgeBonus` è alimentato **solo** dall'effetto-casa Grifondoro (`houseEffects.ts:20`,
`GRYFF_DODGE = [0.04,0.08,0.14]` per tier 2/3/4 membri). Una squadra Grifondoro impilata diventa
evasiva e gli attacchi base mancano.

**Mira Infallibile** è la risposta: un mago con l'abilità **salta interamente il roll di dodge** — i
suoi colpi base vanno sempre a segno. Conta solo sugli effetti `canDodge: true` (gli attacchi base via
`normalizeSpell`); gli effetti senza `canDodge` già non mancano mai. ⚠️ Il flag salta **tutto** il
roll di `dodged()`, non solo il termine `target.dodgeBonus`: annulla anche il `dodgeBase` (0.02
universale) e il dodge da speed-gap. È **dominato da** — ma non limitato a — il `dodgeBonus` di
Grifondoro (l'unica fonte alta di dodge nel gioco), quindi nella pratica è il counter al dodge-stack
Grifondoro, ma toglie comunque ai bersagli normali il loro piccolo dodge di base/velocità.

## Matrice counter (regola utente: dichiarata + testata)

| | Beats | Loses to |
|---|---|---|
| **Mira Infallibile** | **Grifondoro / dodge-stacking** (annulla l'evasione, ogni colpo base atterra) | *Nessuno in particolare* — è un counter-tool a senso unico: irrilevante vs scudi/armatura/regen (non aiuta lì), non introduce una debolezza propria. |

È un counter "puntuale" del counter-web, non un archetipo con un proprio loser. Il test verifica il
lato **beats** (atterra ogni colpo vs un muro Grifondoro evasivo) + un **controllo** (un attaccante
identico SENZA l'abilità manca a volte vs lo stesso bersaglio).

## Sezione 1 — Meccanismo engine: `alwaysHit`

### Nuovo campo `BattleUnit.alwaysHit?: boolean`
In `types/combat.ts`, accanto a `execute`/`dodgeBonus` (`:49-62`). Opzionale → off-by-default.

### Punto di modifica (UNICO) — `game/engine/combat/effects.ts:37`
```ts
if (eff.canDodge && !ctx.actor.alwaysHit && dodged(ctx.rng, ctx.actor, ctx.target)) {
```
Il gate **salta il roll** (`rng.chance` non viene chiamato) quando l'attore ha `alwaysHit`. NON
mettere il check dentro `dodged()` ritornando `false`: quello consumerebbe comunque un draw RNG.

⚠️ **Determinismo.** Quando `alwaysHit` è assente, `!undefined → true`, quindi `true && dodged(...)`
è **valutato identico** all'attuale — zero shift RNG, suite bit-identica *prima* di taggare chiunque
(gate di sicurezza: far girare l'intera suite dopo la sola modifica engine, deve restare invariata).
Dopo aver taggato i maghi, lo skip del roll sposta lo stream RNG **solo** nelle battaglie in cui un
mago `alwaysHit` attacca con un effetto `canDodge`. È una feature nuova: nessun replay shipped ci
dipende; eventuali snapshot che includono un mago taggato vanno rigenerati (gestito in TDD).

### Nuova funzione pura — `game/engine/alwaysHit.ts`
Modellata su `game/engine/execute.ts` `teamExecute`, ma **per-unità** (come `houseEffects`/
`teamDarkMagic`, non team-uniforme come execute):
```ts
/** Insieme degli id-mago che colpiscono sempre a segno: innati (tag 'infallibile', solo tier>=2)
 *  + tutti gli id se una reliquia grantsAlwaysHit è equipaggiata. Pura; no RNG. */
export function teamAlwaysHit(
  team: DraftedWizard[], relics: ActiveRelic[],
): Set<string>
```
- Innato: ogni `dw.wizard` con tag `'infallibile'` **e** `wizard.tier >= 2` (l'abilità è tier-2/3 per
  richiesta utente — il guard tier vive qui, non nei dati).
- Reliquia: se esiste una `ActiveRelic` con `grantsAlwaysHit` (e `relicMatchesCondition`), aggiungi
  **tutti** gli id del team (grant team-wide, mirror `spada-grifondoro`).
- Off-by-default: `Set` vuoto se nessuna sorgente.

### Stamp per-unità — `toBattleUnits` (`simulate.ts:~45`)
Calcola `const alwaysHitIds = teamAlwaysHit(team, relics)` una volta per lato (dove si calcolano
`execute`/`houseMap`), poi nello stamp di ogni unità: `alwaysHit: alwaysHitIds.has(dw.wizard.id)`.

## Sezione 2 — Contenuto

| Pezzo | id | Forma | Note |
|---|---|---|---|
| **Tag** wizard (innato) | `'infallibile'` | su 3-4 maghi **tier 2-3** a tema precisione/mira spietata | candidati da confermare in `data/wizards.ts` per id+tier reali: Alastor "Malocchio" Moody (l'occhio magico — perfetto), Bellatrix (duellante implacabile), Antonin Dolohov / Snape (maledizioni precise). Scegliere quelli realmente tier 2-3. |
| Reliquia **grant** | `occhio-magico` | `grantsAlwaysHit: true`, rarità `rara` | "Occhio Magico di Malocchio": vede attraverso tutto → la squadra non manca mai. Mirror strutturale di `spada-grifondoro` (`grantsExecute`). Team-wide è quasi-bilanciato: l'always-hit conta in proporzione al dodge del bersaglio — pieno valore vs uno stack Grifondoro, marginale (~2% base + speed-gap) vs nemici normali. ⚠️ I 3 maghi taggati sono Serpeverde: c'è un piccolo uplift universale di accuratezza che spinge *un filo* il già-alto win-rate Serpeverde (backlog #4) — da ri-misurare quando parte il rebalance, non un bloccante. |

Nuovo campo type `Relic.grantsAlwaysHit?: boolean` (accanto a `grantsExecute`). NESSUNA scaling-relic
(non si scala un colpo garantito) e NESSUNA tag-synergy (binario, non somma). Il tag `'infallibile'`
serve da marker dell'abilità innata + (futura) draftability.

## Sezione 3 — Validazione: `tests/engine/infallibileCounter.test.ts`

Un solo file (è una counter-ability, non un archetipo con sweep):
- **BATTE il dodge**: attaccante con `alwaysHit` (via tag o reliquia) vs bersaglio ad alto
  `dodgeBonus` (Grifondoro tier-2 impilato, es. `dodgeBonus: 0.6` per renderlo decisivo) → la
  squadra `alwaysHit` **non produce mai un flag `'dodge'`** nei log e uccide entro N turni.
- **CONTROLLO (il counter conta)**: attaccante **identico per stat** ma SENZA `alwaysHit` vs lo
  stesso bersaglio evasivo → produce flag `'dodge'` (manca a volte) e/o impiega più turni. Asserzione
  robusta sul **conteggio dei flag `'dodge'`** (0 con l'abilità, >0 senza) — metrica non confusa dal
  kill-speed (lezione `velenoSweep`/`esecuzione`: niente total-damage).
- Seed fisso, stat estreme per rendere il dodge decisivo (pattern `esecuzioneCounters`).

## Non in scope (YAGNI)
- Scaling-relic e tag-synergy (binario → non scalano).
- Reliquia per-unità assegnabile: il grant team-wide basta ed evita lo step carrier UI.
- Drama/feedback a schermo ("INFALLIBILE!" callout) — deferito, user-gated (backlog §2).
- Sistema generale di abilità a scelta: le Signature esistono già (`data/signatures.ts`); ma il dodge
  NON è sul EventBus, quindi questa abilità DEVE essere un flag stampato, non una signature trigger.

## Ordine di implementazione (per il piano)
1. **Engine**: `BattleUnit.alwaysHit` + gate `!ctx.actor.alwaysHit` in `effects.ts:37` +
   `alwaysHit.ts` (`teamAlwaysHit`, inattivo) + `Relic.grantsAlwaysHit` + stamp in `toBattleUnits`.
   **Gate: suite invariata** (nessuna sorgente attiva ancora).
2. **Contenuto**: tag `'infallibile'` su 3-4 maghi tier-2/3 (id confermati) + reliquia `occhio-magico`.
3. **Validazione**: `infallibileCounter.test.ts` (beats-dodge + controllo).
4. Aggiornare `remaining-work.md` (item #2 → done, riga nella counter-web table).
