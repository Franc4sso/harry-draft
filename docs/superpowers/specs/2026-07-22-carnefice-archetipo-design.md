# Spec — Archetipo Carnefice (esecuzione, gemello del veleno)

_Data: 2026-07-22 · Fase 3 / dinamismo build · Tipo: motore MINIMO (data + ~poche righe) + bilanciamento_

Frase-cuore servita: **dinamismo delle build** — dare all'esecuzione una fantasia forte
("parto piano, divento inarrestabile") così il giocatore SCEGLIE un archetipo invece del template dei ruoli.

---

## 1. Problema

Le run convergono sul template sicuro (Tank+Attaccante+Controllo+Supporto) perché gli archetipi
alternativi sono deboli o rotti. Solo il **veleno** funziona come *sistema di build*. L'**esecuzione**
ha pezzi vivi ma slegati (Mietitore +18 ATK/battaglia, execute da reliquia) e la sua sinergia di squadra
(`spietatezza`) fu cancellata il 21/07 → è **dead code** (`execute.ts:17-20` non si attiva mai).

## 2. Obiettivo

Creare l'**archetipo Carnefice** come **gemello strutturale del veleno**: una sinergia-tag che accende
una **valanga di uccisioni per-battaglia** (ogni kill → +ATK e +soglia esecuzione di squadra →
autoalimentante). I Duo (Mietitore, Esecuzione a Freddo) restano *sopra* come amplificatori distinti.

## 3. Modello di riferimento — il veleno (da replicare, non approssimare)

```
VELENO (archetipo)                    →  CARNEFICE (nuovo, stessa struttura)
  tag 'veleno' sui maghi                   tag 'esecuzione' sui maghi
  Tossicità (3 taggati) → keywordMult      Spietatezza (3 taggati) → keywordMult + valanga
  + on-hit poison 35% (synergyTriggers)    + on-kill snowball (kill-site)
  Duo Cancrena/Miasma/Untore SOPRA         Duo Mietitore/Esec-a-Freddo SOPRA (distinti)
```

**Distinzione chiave (richiesta dell'utente):** l'ARCHETIPO è il sistema-base (la valanga, funziona da
sé con 3 maghi); i DUO sono amplificatori puntuali separati. NON devono fare la stessa cosa. Vedi §4d.

## 4. Decisioni di design (approvate)

- **Spina dorsale:** valanga **per-battaglia** (si azzera tra i fight, come il veleno). Non per-run.
- **Il loop:** ogni kill → +ATK **e** +soglia esecuzione → esegui nemici più sani → uccidi più facile →
  valanga. Gemello di Cancrena (che raddoppia il veleno sotto soglia).
- **Soglia condivisa di SQUADRA:** una kill di qualsiasi carnefice alza la soglia per tutta la squadra
  (l'oggetto `execute` è già condiviso per riferimento — zero clone). Fantasia: "il team monta insieme".
- **Accensione:** sinergia `spietatezza` (3 maghi taggati esecuzione), classe di Tossicità.
- **Vale anche per i nemici** (coerente col veleno: Tossicità nemica esiste già). Tema nemico esecuzione
  auto-derivato da `themes.ts`. Da tarare al playtest (nemico-valanga minaccioso, non ingiusto).
- **Legittimità:** è una sinergia-*archetipo* (come Tossicità, sopravvissuta), NON una sinergia-*squadra*
  (il "+stat se 3 di ruolo" tolto il 21/07). Completa la direzione, non la contraddice.

## 5. Architettura — cosa tocco (blueprint ancorato al codice)

### 5a. Sinergia `spietatezza` (DATI — `data/synergies.ts`)
Aggiungere accanto a `tossicita` (riga 9), forma identica:
```ts
{ id: 'spietatezza', name: 'Spietatezza', kind: 'origin', requires: { tag: 'esecuzione', count: 3 }, bonus: { keywordMult: { esecuzione: 0.5 } } },
```
Effetti automatici, ZERO altro codice:
- `detectSynergies` (`synergy.ts:19`) la emette quando 3 maghi esecuzione sono in squadra (branch tag+count generico).
- `execute.ts:17-20` (branch morto) **si riaccende**: aggiunge threshold 0.35 + bonus 0.25 (× keywordMult esecuzione).
- `themes.ts:44-51` crea il tema nemico esecuzione (voluto).

### 5b. Il flag della valanga (`synergyTriggers.ts` — clone del pattern Tossicità)
Oggi `registerSynergyTriggers` gestisce solo Tossicità. Aggiungere il flag carnefice, gated a side:
```ts
// dopo il blocco tossicita
const spietatezza = synergies.some(s => s.synergy.id === 'spietatezza')
if (spietatezza) for (const u of units) u.carnefice = true
```
`u.carnefice` è un nuovo campo booleano su `BattleUnit` (come `reaper`). Aggiungerlo al tipo `BattleUnit`.
NB: `registerSynergyTriggers` è già chiamato per ENTRAMBI i lati (`simulate.ts:149-150`), quindi il flag
si stampa correttamente sui nemici carnefice pure — coerente con "vale anche per i nemici".

### 5c. La valanga al kill-site (`simulate.ts` ~377)
Oggi (solo Mietitore, solo player):
```ts
if (actor.side === 'left' && actor.reaper) maybeReap(actor)
```
Aggiungere la valanga carnefice — vale per ENTRAMBI i lati, +ATK (riusa raccolto) e +soglia squadra:
```ts
if (actor.carnefice) {
  maybeReap(actor)                                    // +ATK: riusa raccolto (già scoped al killer)
  const team = actor.side === 'left' ? L : R          // la soglia sale per la squadra del killer
  bumpExecuteThreshold(team)                           // nuova helper, vedi §5d
}
```
**Determinismo replay (CRITICO):** la riga KO è marchiata a `simulate.ts:348` (`reaped`). Il marchio
Mietitore (`duoId:'mietitore'`) resta com'è. La valanga carnefice NON deve aggiungere rng né cambiare
l'ordine dei draw (non ne usa — kill è deterministico, come Mietitore). `bumpExecuteThreshold` è pura
mutazione di stato, no rng. Va comunque verificato da `endlessReplayParity` (§7).

### 5d. `bumpExecuteThreshold` (nuova helper, `execute.ts` o `duoEffects/`)
```ts
const CARNEFICE_THRESHOLD_STEP = 0.05   // +5% soglia per kill (STIMA, tarabile)
const CARNEFICE_THRESHOLD_CAP = 0.6     // tetto soglia (STIMA)
export function bumpExecuteThreshold(team: BattleUnit[]): void {
  for (const u of team) {
    if (u.execute) u.execute.threshold = Math.min(CARNEFICE_THRESHOLD_CAP, u.execute.threshold + CARNEFICE_THRESHOLD_STEP)
  }
}
```
NB: se un mago non ha `execute` (nessuna reliquia execute né sinergia), la valanga-ATK funziona comunque
(raccolto), ma la +soglia no. Con `spietatezza` attiva, `execute.ts:17` garantisce che `execute` esista
(threshold 0.35 base) → la soglia parte da 0.35 e sale. Coerente.

### 5e. Differenziare il Mietitore (Duo) dalla valanga (archetipo)
Oggi Mietitore fa "kill→+ATK" (raccolto). La valanga archetipo fa "kill→+ATK+soglia". Se restano identici
sul +ATK, il Duo è ridondante. **Scelta:** il Mietitore diventa un **amplificatore della valanga**, non
un doppione:
- Mietitore attivo → il **cap di `raccolto` sale** (es. MAX_STAT_STACKS 3 → un valore più alto per i
  carnefici quando il Duo è acceso), OPPURE ogni kill dà **2 stack invece di 1**.
- **Scelta consigliata (più pulita):** con Mietitore attivo, `maybeReap` applica **2 stack** invece di 1
  (raddoppia la crescita +ATK). Il Duo "raddoppia la mietitura" — distinto e tematico. L'archetipo dà la
  valanga base (1 stack + soglia); il Duo la accelera (2 stack).
- Implementazione: `maybeReap(killer, actor.reaper ? 2 : 1)` — un parametro. Zero rng.

### 5f. Pulizia
- Rimuovere/aggiornare il commento stale `execute.ts:4` ("relics + Spietatezza synergy" — ora vero di nuovo).
- Aggiornare la desc/testo utente della sinergia dove le sinergie sono mostrate (DuoPanel/Codex se elencano Tossicità).

## 6. Cosa NON facciamo (YAGNI)

- Nessuna valanga di-run (per-battaglia soltanto; il di-run è un possibile secondo strato futuro).
- Nessun nuovo hook `onKill` nel motore (riuso il kill-site esistente).
- Nessun clone dell'oggetto execute (soglia di squadra = muto il condiviso).
- Nessun tocco agli altri 2 archetipi rotti (scudo/magieOscure) — quelli sono progetti successivi, calibrati su come va il Carnefice.
- Nessuna esclusione nemici (li vogliamo, coerente col veleno).

## 7. Testing

- **Sinergia (deterministico):** test che `detectSynergies` emette `spietatezza` con 3 maghi esecuzione, 0 con 2.
- **Execute riacceso:** con `spietatezza` attiva, `teamExecute` ritorna threshold≥0.35 + bonus (branch execute.ts:17 vivo).
- **Valanga +ATK:** in battaglia, un carnefice che uccide guadagna raccolto (+ATK); con Mietitore attivo, 2 stack invece di 1.
- **Valanga +soglia:** dopo N kill, `execute.threshold` della squadra è salito di N×step (fino al cap). Verificare che sale per la SQUADRA, non solo il killer.
- **Nemici:** un tema nemico esecuzione (3 nemici taggati) accende la valanga sul lato `right` — verificare che i nemici mietono (flag carnefice su `right`).
- **Determinismo (CRITICO):** `endlessReplayParity` DEVE restare verde — la valanga non aggiunge rng. Se rosso → STOP.
- **Bilanciamento:** `campaignBalanceRestricted` + `campaignBalanceB` — il gate bot è archetype-blind (non costruisce 3-esecuzione), quindi non si muove per la valanga PLAYER. MA i nemici carnefice SÌ appaiono → il winRate potrebbe scendere (nemici più forti). Misurare; se scende sotto floor, è un effetto REALE (nemico-valanga forte), da tarare (step/cap) non da nascondere.
- **esecuzioneSweep:** aggiornare/estendere per misurare la valanga (uptake, snowball raggiunto). Il floor execUptake potrebbe muoversi.

## 8. File toccati (previsti)

- `data/synergies.ts` — voce `spietatezza`.
- `types/combat.ts` (o dove vive `BattleUnit`) — campo `carnefice?: boolean`.
- `game/engine/synergyTriggers.ts` — stampa flag `carnefice`.
- `game/engine/combat/simulate.ts` — branch valanga al kill-site (~377), entrambi i lati.
- `game/engine/duoEffects/reap.ts` — `maybeReap` accetta stack count (Mietitore = 2).
- `game/engine/execute.ts` (o helper vicino) — `bumpExecuteThreshold`; commento stale.
- Test: nuovo `tests/engine/carnefice.test.ts` + estensione `esecuzioneSweep.test.ts`.

## 9. Rischi

- **Determinismo replay (#1):** la valanga tocca il kill-site marchiato. Mitigato: no rng, pura mutazione.
  `endlessReplayParity` è la prova. Se rosso → STOP e ripensare.
- **Bilanciamento nemici:** i nemici carnefice sono la vera incognita (a differenza del player, il bot li
  incontra). La valanga nemica va tarata (step 0.05/cap 0.6 sono STIME). Se rende il gioco ingiusto → abbassare
  step/cap, non escludere i nemici (li vogliamo).
- **Ridondanza Mietitore:** mitigata da §5e (il Duo raddoppia la mietitura, non la duplica).
- **Feel (playtest):** la valanga è divertente o degenere? Il nemico-carnefice è minaccia giusta? Da validare
  in mano. Numeri (step, cap, stack Mietitore) tutti tarabili post-playtest.
