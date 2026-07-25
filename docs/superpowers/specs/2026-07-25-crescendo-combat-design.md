# Crescendo di combattimento — calore a streak (design)

**Data:** 2026-07-25
**Stato:** design approvato, pronto per il piano d'implementazione
**Pilastro:** WOW P8 — dramma. "Il combattimento deve essere la parte più bella."

## Obiettivo

Far **crescere** l'intensità visiva del combattimento quando i momenti drammatici si
concatenano (crit, esecuzioni, Duo, colpi grossi), e farla **raffreddare** nei momenti
fiacchi. Non si introducono effetti nuovi: si **amplificano i layer cinematici già
esistenti** in `choreograph`, *sopra* il `tier` per-incantesimo.

Feeling di riferimento: Balatro (il tavolo si accende man mano che la giocata sale).

### Vincolo ferreo (utente)
**NIENTE camera shake, mai.** Il crescendo si esprime SOLO attraverso: forza del bloom,
scala degli anelli d'urto (shockwave), peso di tint/vignetta, durata dell'hit-stop,
ampiezza dello squash&stretch, densità particellare, e un lieve dip di slow-mo. Mai
traslando/scuotendo la camera.

### Decisioni di scope (confermate con l'utente)
- **(a)** Intensità **continua `0→1`** (non tier discreti) → scaling liscio.
- **(b)** Il **"calore visibile della stanza"** è **dentro lo scope base** (è ciò che
  vende il crescendo: si vede la battaglia scaldarsi anche *tra* i colpi).
- **(c)** Il calore **si azzera a ogni battaglia** (nessun residuo tra scontri della run).

## Modello del calore

Derivazione **pura e deterministica** sul log di combattimento — nessuna sorgente di
non-determinismo (niente `Date.now`/`Math.random`). Poiché è funzione pura del log (già
deterministico e serializzato per l'anti-cheat), la **parità replay è garantita per
costruzione**: stesso log → stessa sequenza di intensità, sempre.

```
state[0]        = { heat: 0, valueMax: 0 }
state[i].valueMax = max(state[i-1].valueMax, entry[i].value ?? 0)
state[i].heat   = clamp01( state[i-1].heat * DECAY + beatScore(entry[i], state[i].valueMax) )
intensity[i]    = state[i].heat            // già 0..1
```

Lo **stato** porta due scalari — il calore e il massimo mobile di `value` visto finora —
così la normalizzazione di `value` resta pura senza dipendere da `maxHp` (assente in
`LogEntry`). `valueMax` è ricalcolabile dal prefisso del log → nessuna non-purità.

`beatScore(entry, valueMax)` pesa i `LogFlag` reali (`types/combat.ts:95`):

| Segnale | Peso indicativo (tunable) | Note |
|---|---|---|
| `kill` | alto (+0.45) | l'esecuzione è il beat più drammatico |
| `duo` | alto (+0.40) | momento-firma player |
| `crit` | medio (+0.22) | |
| `shatter` / `pen` | piccolo (+0.12) | scudo rotto / penetrazione |
| `value` grande | extra (+0..0.15) | normalizzato su una soglia rolling (vedi sotto) |
| `dodge` / `block` / `wait` | 0 | "fizzle": lascia decadere |
| righe di sistema (`type:'system'`) | 0 | Reliquia/Rigenera/Fatica/KO-passivo |

- **`DECAY`** ≈ `0.62` per frame (tunable): due-tre beat consecutivi portano a
  "incandescente", un paio di frame calmi riportano giù.
- **Normalizzazione di `value`**: teniamo un massimo mobile del `value` visto finora nel
  log e mappiamo `value/rollingMax` → `[0..0.15]`. Evita di dipendere da `maxHp` (non
  presente in `LogEntry`) e resta puro (il rolling max è ricalcolato dal prefisso del log).
- Tutti i pesi/soglie sono **costanti in cima al modulo**, regolabili nel lab con l'utente.

### Firma pura
```ts
// lib/vfx/crescendo.ts
export interface HeatConstants { decay: number; kill: number; duo: number; crit: number; /* … */ }
export const HEAT: HeatConstants = { /* default tunable */ }

export interface HeatState { heat: number; valueMax: number }
export const HEAT_ZERO: HeatState = { heat: 0, valueMax: 0 }

/** Un passo O(1): stato precedente + entry → nuovo stato. Puro (nessun RNG/tempo). */
export function heatNext(prev: HeatState, entry: LogEntry, k?: HeatConstants): HeatState

/** Intensità 0..1 al frame `index`, = fold di heatNext sul prefisso [0..index].
 *  Fonte di verità robusta a seek/rewind del replay. Stesso (entries, index) → stesso valore. */
export function heatAt(entries: LogEntry[], index: number, k?: HeatConstants): number
```

`heatNext` è il passo incrementale O(1) (avanzamento lineare del replay); `heatAt` è il
fold di `heatNext` da `HEAT_ZERO` sul prefisso `[0..index]` — usato quando il replay salta.
`intensity = heatAt(...)` (ovvero `state.heat`).

## Componenti (unità isolate)

### 1. `lib/vfx/crescendo.ts` — nuovo, puro
La sola logica del calore (sopra). Zero dipendenze da Pixi/DOM. Interamente unit-testabile.

### 2. `hooks/useBattleReplay.ts` — modifica
Ha già l'intero log e l'`index` corrente. Espone `intensity: number` accanto a `entry`.
Calcolata con `heatAt(log, index)` (robusta al seek). Così `PixiArena` resta "stupido" e
un eventuale HUD può leggere lo stesso valore senza ricalcolarlo.

### 3. `choreograph.ts` — modifica
Firma estesa con `intensity: number` (default `0` → comportamento identico ad oggi se non
passato). Usa `intensity` per **scalare i parametri che già applica**, con un mapping
`clamp`ato (mai NaN, mai oltre i massimi):
- forza `AdvancedBloomFilter` ↑
- scala/opacità shockwave ↑
- conteggio particelle dei burst ↑ (entro un cap per performance)
- peso del wash `onTint` (DOM) ↑
- durata hit-stop e profondità del dip di slow-mo ↑ (vedi §Hit-stop)

Moltiplicativo/additivo sopra il `tier`: un `colpo base` (tier 1) durante una streak
incandescente si accende comunque; un ultimate (tier 3) in fase calma spara comunque il
suo set-piece. Nessun effetto è *gated* dall'intensità — l'intensità solo *amplifica*.

### 4. `PixiArena.tsx` — modifica
Legge `r.intensity` (da `useBattleReplay`) e lo passa a `choreograph(...)`. Nient'altro.
La misurazione DOM dei busti, il guard reduced-motion e il frameKey restano invariati.

### 5. Calore visibile della stanza — nuovo layer sottile
Un overlay persistente (vignetta calda + intensità ember dell'`ArenaBackdrop`, oppure un
alone reattivo) la cui opacità/energia segue `intensity` con un ease morbido, così la
stanza "respira" tra un colpo e l'altro. **Tenuto basso** (picco opacità ~0.12) e
**reduced-motion-safe**. Priorità assoluta alla leggibilità: HP, log, callout, barra
iniziativa e numeri di danno non devono mai essere coperti o sbiaditi.

## Hit-stop / slow-mo
Al calore alto: micro-freeze della timeline GSAP sull'impatto (~40–90ms, scalato da
`intensity`) + lieve dip di timescale. **Deve stare dentro il `budgetMs` del frame**
(`PixiArena.tsx:124`) così non desincronizza il replay. A `intensity=0` è assente.

**Decisione (confermata):** l'hit-stop è **implementato ma SPENTO di default** dietro una
costante (`HEAT.hitStopMax = 0` di default). Il crescendo di base regge su bloom + peso +
slow-mo; l'hit-stop è la ciliegina, da accendere e validare a occhio nel lab al primo
playtest — non è nella base "sempre-on". Il dip di slow-mo resta attivo (più sicuro del
freeze in un replay a velocità variabile).

## Leggibilità e sicurezza
- **Reduced-motion**: se non monta lo stage (prefers-reduced-motion) → nessun crescendo,
  nessun room-heat animato. Comportamento invariato per chi riduce il movimento.
- **Parità replay/anti-cheat**: intensità = funzione pura del log → nessun impatto sulla
  simulazione, nessuna divergenza. Il modulo non tocca il motore.
- **Performance**: cap su particelle e filtri all'apice; nessun nuovo filtro costoso, si
  riusano quelli esistenti (bloom/shockwave/tint).

## Criteri di riuscita (cosa sente il giocatore)
1. Uno scambio calmo (colpo base, schiva) è pulito e quieto.
2. Una catena crit → Duo → esecuzione in frame successivi **escala visibilmente**: più
   luce, più peso, più lento, la stanza si scalda, culmine sul colpo finale.
3. Dopo la tempesta, tutto si **raffredda** in pochi frame.
4. Zero camera shake. HP/log/turni/numeri **sempre** leggibili.

## Testing
- **Unit (core puro `crescendo.ts`)** — la parte davvero testabile:
  - kill-streak (più entry con `kill`) → `intensity` monotòna crescente fino al clamp;
  - lull (entry `wait`/system dopo una streak) → decadimento verso 0;
  - clamp in `[0,1]`, nessun overshoot;
  - determinismo: stesso `(entries, index)` → stesso valore (chiamato due volte);
  - `heatAt(entries, i)` == fold di `heatNext` su `[0..i]` (coerenza tra le due API).
- **Mapping choreograph** — funzione pura intensity→parametri: clampata, niente NaN ai
  bordi (`intensity` 0 e 1).
- **Verifica visiva** — nel `combat-lab`: nuovo scenario **"Streak"** che spara una
  sequenza kill/crit/Duo di fila + una **lettura numerica del calore** on-screen, per
  tarare pesi e decay con l'utente.
- Suite esistente verde (il default `intensity=0` non cambia gli output correnti).

## Tuning (costanti in cima a `crescendo.ts`)
`decay`, pesi per-flag (`kill`/`duo`/`crit`/`shatter`/`pen`), contributo di `value`,
ceiling, e i coefficienti del mapping intensity→layer in `choreograph`. Prima passata di
valori di default nella spec sopra; rifinitura nel lab.

## Fuori scope (YAGNI)
- Residuo di calore tra battaglie (deciso: azzera ogni battaglia).
- Pavimento ad arco del combattimento (approccio B scartato).
- Audio reattivo al calore (l'audio in-game è comunque un altro blocco, oggi `null`).
- Nuovi filtri WebGL costosi: si riusano quelli montati.

## Punti d'aggancio noti (dal codice, verificati)
- `LogEntry`/`LogFlag`: `types/combat.ts:95-120`.
- Conductor + tier layering: `lib/vfx/choreograph.ts:37-121` (budget timescale `:118-119`).
- Frame drive + budget: `PixiArena.tsx:84-132`, `budgetMs` `:124`, `audio:null` `:125`.
- Replay: `hooks/useBattleReplay.ts` (ritorna `{entry, index, speed}`), frameKey a
  `BattleScreen.tsx:169`.
- Lab: `app/combat-lab/page.tsx` (scenari + toggle) per il preview.
