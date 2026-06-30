# Il tag `veleno` applica veleno — design

> Data: 2026-06-30. Richiesta utente: i maghi con tag `veleno` devono avvelenare DAVVERO in combattimento
> (oggi il tag è sola categorizzazione), non solo via lo shiny raro. Tenere la sinergia Tossicità.

## Contesto verificato (stato attuale)

Tre sistemi col nome "veleno" oggi SCOLLEGATI:

1. **Tag `veleno`** (`data/wizards.ts`) — pura categorizzazione. Alimenta la sinergia "Tossicità" (`requires.tag='veleno', count:3`) e la composizione dei temi (slice themed-battles). Nessun effetto meccanico.
2. **Trait `veleno`** (`data/traits.ts:113-121`) — un `Trait` reactive `onHit/actor` che oggi applica lo status **`burn`** (chance 0.5, durata 2). Arriva su un mago SOLO via `shiny` (`game/engine/traits.ts:9` legge solo `u.shiny.traitId`); i nemici non sono mai shiny → mai velenosi.
3. **Status `veleno`** (`data/statuses.ts:9`) — un DOT ACCUMULANTE sofisticato: `tickDamage 4 + tickPctMaxHp 0.005`, `stack: 'accumulate', maxStacks: 8`, `keywords: ['veleno']`. Quasi inutilizzato: l'unica fonte che lo applica è la spell `serpensortia`. Le signature "velenose" (Snape/Draco/Dolohov/Blaise) applicano invece `burn`.

**Motore veleno già costruito ma a vuoto:** la sinergia **Tossicità** già imposta `velenoUncapped` (rimuove il cap di 8 stack — `simulate.ts:25`, `effects.ts:103`); esiste `keywordDamageMult(unit, relics, 'veleno')` che moltiplica il tick del veleno (`simulate.ts:106-107`, `status.ts:76-77`). Manca solo: qualcosa che APPLICHI lo status `veleno` su larga scala.

## Decisioni (chiuse con l'utente)

1. **Tag `veleno` = avvelena davvero** — automatico, vale per player E nemici (coerente).
2. **Effetto = status `veleno` accumulante** (NON `burn`) — si aggancia automaticamente a Tossicità (uncap) e ai moltiplicatori keyword già esistenti. Dà finalmente senso a Tossicità.
3. **Trigger = ogni attacco a chance, via il Trait esistente** — riuso `traits.ts`, non una nuova meccanica.
4. **Approccio A**: il tag CONCEDE il `Trait` veleno; il Trait viene cambiato per applicare `veleno` invece di `burn`; le signature-burn (Snape/Draco/Dolohov/Blaise) **RESTANO** → quei 4 diventano "elite del veleno" (veleno accumulante + burn = doppia minaccia).

## Architettura

Tre modifiche puntuali, una sola fonte di verità per "cosa fa il veleno":

### 1. Il Trait `veleno` applica lo status `veleno` (non `burn`)
`data/traits.ts:119`: cambiare `statusId: 'burn'` → `statusId: 'veleno'`. La definizione del trait resta `reactive / onHit / owner:'actor'`, chance `POISON_CHANCE` (0.5), durata `POISON_DURATION` (2). Nessun'altra modifica al trait.
- Effetto a cascata: ogni mago che ha questo trait ora APPLICA lo status accumulante, che la sinergia Tossicità uncappa e i moltiplicatori keyword potenziano. Tutto già cablato.

### 2. Il tag `veleno` concede il Trait (non solo lo shiny)
`game/engine/traits.ts:5-22` (`registerTraitTriggers`): oggi raccoglie i trait id da `u.shiny ? [u.shiny.traitId] : []`. Cambiarlo per raccogliere ANCHE il trait `veleno` quando il mago ha il tag:
```ts
const traitIds = new Set<string>()
if (u.shiny) traitIds.add(u.shiny.traitId)
if ((u.wizard.tags ?? []).includes('veleno')) traitIds.add('veleno')
for (const id of traitIds) { ... esistente ... }
```
- ⚠️ **Dedup obbligatorio** (`Set`): `SHINY_TRAIT_IDS = TRAITS.map(t=>t.id)` INCLUDE `'veleno'` (`traits.ts:199`). Senza il Set, un mago shiny-che-ha-pescato-veleno E con tag veleno registrerebbe DUE hook → doppia applicazione per colpo. Il `Set` garantisce un solo hook.
- Vale per player e nemici (la funzione gira su tutte le `units`, entrambi i lati).
- `u.wizard.tags` è disponibile: `BattleUnit extends DraftedWizard` (`types/combat.ts:39`) e `DraftedWizard.wizard` è il `Wizard` intero (con `tags`). Nessuno stamp aggiuntivo nel battlePrep serve.

### 3. Niente da fare su signature/spell
Le signature-burn restano (decisione 4). `serpensortia` resta l'unica spell che applica `veleno` via spec — invariata. La sinergia Tossicità è invariata (continua a uncappare).

## Flusso dati

`battlePrep → BattleUnit (con wizard.tags) → registerTraitTriggers raccoglie {shiny?, tag-veleno?} dedup → bus.onReactive('onHit') → effetto applyStatus 'veleno' → status.ts tick (con velenoMult se la sinergia/relic lo dà, uncap se Tossicità) → danno DOT`.

Una sola via di applicazione (il Trait via hook), per entrambi i lati. Nessun secondo path nel combat engine (per questo l'approccio B — hook diretto — è scartato: duplicherebbe la via di applicazione status, la classe di bug single-source evitata nello slice themed-battles).

## Testing

- **Unit trait**: un mago con tag `veleno` (no shiny) registra il trait → `onHit` applica status `veleno` al bersaglio (chance deterministica con rng seedato).
- **Dedup**: un mago con tag veleno E shiny.traitId='veleno' registra UN SOLO hook (non applica veleno due volte per colpo). Asserire 1 applicazione attesa, non 2.
- **Nemici avvelenano**: un BattleUnit nemico con tag veleno applica veleno al player (prima non poteva — non era mai shiny).
- **Tossicità uncap si aggancia**: team con Tossicità attiva → stack veleno oltre 8 (velenoUncapped già testato altrove; qui basta confermare che il veleno applicato dal tag rispetta l'uncap).
- **Signature coesistono**: Snape applica veleno (dal tag) E burn (dalla signature) — due status distinti sul bersaglio.
- **Determinismo + suite piena verde + tsc**.

## Rischio #1 — BALANCE (ri-taratura attesa, non opzionale)

⚠️ "Tutti i veleno avvelenano" su NEMICI, combinato con le **battaglie themed** (lo slice appena chiuso genera team a tema veleno COESI — più membri veleno insieme), rende i nodi a tema-veleno sostanzialmente più duri. Il margine winRate è GIÀ sottile (0.1583 = 19/120; 18 fallirebbero — vedi memoria `harry-draft-themed-battles-margin`). Quasi certo che il winRate scenda sotto 0.15.

**Strategia (come lo slice precedente):**
1. Misurare `campaignBalanceB` DOPO l'aggancio.
2. Se sotto banda, leve in ordine: (a) abbassare `POISON_CHANCE` (meno proc); (b) abbassare `tickDamage`/`tickPctMaxHp` dello status veleno; (c) abbassare `themeStrength.nodeMult` del tema veleno (i nemici veleno coesi sono il driver). NON toccare la sinergia Tossicità (è il payoff player-side).
3. Riportare winRate in `[0.15, 0.45]` e documentare quale leva ha vinto, stile calibration-log di `campaignB`.

## Non in scope (YAGNI)

- Convertire le signature-burn a veleno (decisione: restano burn → doppia minaccia).
- Nuovi moltiplicatori keyword o reliquie veleno (il motore c'è già; non aggiungerne).
- Toccare lo shiny o `SHINY_TRAIT_IDS` (il dedup col Set basta).
- Una nuova sinergia veleno (Tossicità basta).

## Ordine di implementazione (per il plan)

1. `data/traits.ts`: trait `veleno` applica `veleno` invece di `burn` + test (un mago col trait applica lo status giusto).
2. `game/engine/traits.ts`: il tag concede il trait, con dedup `Set` + test (tag→trait, dedup shiny+tag, nemici avvelenano). `u.wizard.tags` già disponibile (BattleUnit extends DraftedWizard).
3. Test integrazione: signature+tag coesistono; Tossicità uncap si aggancia al veleno-da-tag.
4. BALANCE (rischio #1): misurare campaignBalanceB; ritarare (POISON_CHANCE → tickDamage → themeStrength veleno) fino a banda. Suite piena + tsc. Documentare la leva.
5. Backlog doc.
