# Spec — Archetipo Muro Riflettente (scudo, gemello del veleno/Carnefice)

_Data: 2026-07-23 · Dinamismo build (2° dei 3 archetipi) · Tipo: motore MINIMO (data + poche righe) + bilanciamento_

Obiettivo di design: **rompere il template dei ruoli** trasformando il TANK da difesa pura a win-condition —
"più mi colpisci il muro, più il danno ti torna indietro". Un archetipo-sistema (gemello di veleno/Carnefice):
sinergia `bastione` (3 maghi scudirigen) → riflessione diffusa; il Duo Muro Vivente la rende LETALE sul Tank.

---

## 1. Problema

Le run convergono sul template sicuro. Il Tank è il pezzo più "risolto" (taunt 1000, difesa pura). Renderlo
un'arma è il ribaltamento più forte contro la convergenza. Lo scudo ha pezzi vivi (riflessione del Duo Muro
Vivente, generazione da egida-tassorosso) ma la sinergia di squadra `bastione` fu cancellata il 21/07 → è
**dead code** (`shieldConvert.ts:16` non si attiva mai), come lo era `spietatezza` prima del Carnefice.

## 2. Modello — gemello del veleno/Carnefice (replica il pattern)

```
CARNEFICE (già fatto)              →  MURO RIFLETTENTE (nuovo, stessa struttura)
  sinergia spietatezza (3 esec)        sinergia bastione (3 scudirigen)
  valanga: kill → +ATK+soglia          riflessione: chi ha scudo → rimanda % del danno assorbito
  Duo Mietitore AMPLIFICA (2 stack)    Duo Muro Vivente AMPLIFICA (letale sul Tank)
```

**Distinzione archetipo vs Duo (come richiesto):** l'ARCHETIPO è il sistema-base (riflessione diffusa,
non-letale, su chiunque abbia scudo); il DUO Muro Vivente è l'amplificatore (sul Tank: riflette di più E
letale). NON fanno la stessa cosa.

## 3. Decisioni di design (approvate)

- **Verbo archetipo:** la RIFLESSIONE diventa il sistema — 3 maghi scudirigen → chiunque abbia uno scudo
  attivo riflette una % **base** del danno assorbito all'attaccante, **non-letale** (nemico resta ≥1 HP).
- **Differenziazione Duo:** Muro Vivente sul Tank riflette di **più** E **letale** (toglie il cap `hp-1`).
  Archetipo = "muro che punge" (diffuso, sicuro); Duo = "muro che uccide" (Tank, letale).
- **Accensione:** sinergia `bastione` (3 maghi scudirigen), classe di Tossicità/Spietatezza.
- **Vale anche per i nemici** (tema scudirigen auto-derivato da themes.ts) — coerente col Carnefice.
- **RNG-free:** attaccante + danno assorbito già in scope a `effects.ts:82-98` → determinismo salvo.
- **Legittimità:** sinergia-*archetipo* (come tossicita/spietatezza), NON sinergia-*squadra* (il rumore tolto 21/07).
- **Numeri STIMA tarabili:** riflessione base archetipo **25%**; Duo Muro Vivente **50% + letale** (oggi è 40% non-letale).

## 4. Architettura — cosa tocco (blueprint ancorato al codice)

### 4a. Sinergia `bastione` (DATI — `data/synergies.ts`)
Aggiungere accanto a spietatezza (riga ~10), forma identica:
```ts
{ id: 'bastione', name: 'Bastione', kind: 'origin', requires: { tag: 'scudirigen', count: 3 }, bonus: { keywordMult: { scudo: 0.5 } } },
```
Effetti automatici: `shieldConvert.ts:16` (branch morto `+0.35` generazione) si riaccende; `themes.ts` crea
il tema nemico scudirigen; `keywordMult.scudo` amplifica la generazione scudo (già vivo).
Aggiungere `'bastione'` a `NAMED_SYNERGY_IDS` (`lib/metaProgress.ts:11`).

### 4b. Il flag della riflessione diffusa (`BattleUnit` + stamp)
Oggi la riflessione vive in `livingWall?: { reflect: number }` (types/combat.ts:88), stampato SOLO sul Tank
dal Duo (`stamp.ts:10`). Per l'archetipo serve una riflessione diffusa (chiunque abbia scudo, non solo Tank).
Opzione pulita: un campo/flag di squadra `wallReflect?: number` su `BattleUnit`, stampato quando `bastione`
è attivo su TUTTI i membri del lato (come `carnefice` per il Carnefice), stampato in `registerSynergyTriggers`
o `stampSynergyFields` (mirror del pattern Carnefice `u.carnefice = true`).

### 4c. Il blocco reflect (`effects.ts:88-98`) — estendere per archetipo + Duo
Il blocco attuale gestisce solo `livingWall` (Duo). Estenderlo così:
```ts
const absorbed = dmg - residual
if (absorbed > 0 && ctx.target.side === 'left' && ctx.actor.alive) {
  const lw = ctx.target.livingWall          // Duo Muro Vivente (Tank): letale, % più alta
  const arch = ctx.target.wallReflect        // Archetipo bastione (chiunque abbia scudo): non-letale
  // Il Duo VINCE sul base se presente (sul Tank): riflette di più E letale.
  if (lw) {
    const reflect = Math.round(absorbed * lw.reflect)   // NIENTE cap hp-1 → può uccidere (letale)
    if (reflect > 0) { ctx.actor.hp -= reflect; ctx.reflect = {...} }
  } else if (arch && ctx.actor.hp > 1) {
    const reflect = Math.min(ctx.actor.hp - 1, Math.round(absorbed * arch))  // non-letale (cap hp-1)
    if (reflect > 0) { ctx.actor.hp -= reflect; ctx.reflect = {...} }
  }
}
```
**NB determinismo:** nessun rng aggiunto (come oggi). `ctx.reflect` + il log/score a `simulate.ts:296-308`
restano; verificare che il caso archetipo (senza Duo) emetta un log coerente (magari `action:'MuroRiflettente'`
distinto da `MuroVivente`, o riusare lo stesso). `endlessReplayParity` DEVE restare verde.
**NB "chi ha scudo":** la riflessione diffusa vale solo se l'unità ha effettivamente assorbito danno con uno
scudo (`absorbed > 0` lo garantisce già — se non c'è scudo, absorbDamage non assorbe nulla). Quindi il flag
`wallReflect` può essere stampato su tutti i membri bastione: si attiva solo quando assorbono davvero.

### 4d. Nemici (il tema scudirigen)
Come per il Carnefice: `bastione` (tag scudirigen) crea il tema nemico. I nemici NON ricevono `livingWall`
(Duo player-only) ma ricevono `wallReflect` (archetipo, stampato su entrambi i lati) → i nemici-muro riflettono
il TUO danno (non-letale). Guardia: il blocco reflect oggi è gated `ctx.target.side === 'left'` — per far
riflettere ANCHE i nemici, rimuovere quel gate per il ramo archetipo (`wallReflect`), tenendo `livingWall`
player-only. Verificare che il fuoco-amico non sia possibile (l'attaccante di un nemico scudato è un player → il
player prende danno riflesso, che è il punto).

## 5. Cosa NON facciamo (YAGNI)

- Nessuna riflessione che scala con lo scudo accumulato (opzione scartata — % fissa base).
- Nessun nuovo hook motore (riuso il blocco reflect esistente a effects.ts:82-98).
- Nessuna riflessione del danno che BUCA lo scudo (solo l'assorbito, com'è oggi).
- Nessun tocco al 3° archetipo (Patto-oscuro) — calibrato dopo il playtest del Muro.
- Nessuna nuova signature reflect (open design space, ma non ora).

## 6. Testing

- **Sinergia:** `detectSynergies` emette `bastione` con 3 scudirigen, non con 2. `teamShieldConvert` ha rate più alto con bastione (branch shieldConvert.ts:16 vivo).
- **Riflessione archetipo:** in battaglia, un'unità scudata con bastione (senza Duo) che assorbe danno riflette ~25% all'attaccante, NON-letale (attaccante resta ≥1 HP).
- **Duo letale:** un Tank con Muro Vivente riflette ~50% E può UCCIDERE l'attaccante (nessun cap hp-1).
- **Priorità:** un Tank con SIA bastione SIA Muro Vivente → vince il Duo (letale, % più alta), non doppia riflessione.
- **Nemici:** un nemico scudato con tema scudirigen riflette il danno del player (non-letale, wallReflect su right).
- **Determinismo (CRITICO):** `endlessReplayParity` verde (nessun rng aggiunto). Se rosso → STOP.
- **Bilanciamento:** `campaignBalanceRestricted`/`campaignBalanceB` — il gate bot è archetype-blind per il player. MA i nemici-muro riflettono il danno del bot → il winRate potrebbe scendere (nemici più duri). Misurare; se scende sotto floor, è effetto REALE (nemico-muro forte), tarare la % riflessione nemica, non nascondere.
- **esecuzione/scudiRigen sweep:** aggiornare/estendere per misurare bastione (ora viva, prima 0/dead).

## 7. File toccati (previsti)

- `data/synergies.ts` — voce `bastione`.
- `lib/metaProgress.ts` — `NAMED_SYNERGY_IDS` + `bastione`.
- `types/combat.ts` — campo `wallReflect?: number` su BattleUnit.
- `game/engine/synergyTriggers.ts` (o stampSynergyFields) — stampa `wallReflect` quando bastione attivo (entrambi i lati).
- `game/engine/combat/effects.ts` — estendere il blocco reflect (archetipo non-letale + Duo letale + nemici).
- `game/engine/combat/simulate.ts` — log/score per il reflect archetipo (se distinto).
- Test: nuovo `tests/engine/muroRiflettente.test.ts` + estensione `scudiRigenSweep.test.ts` + `shieldConvert` (bastione viva).

## 8. Rischi

- **Determinismo:** il blocco reflect è nel damage handler. Mitigato: no rng (come oggi). `endlessReplayParity` prova.
- **Nemico-muro frustrante (#1 feel):** un nemico che riflette il TUO danno può punirti per attaccare (ti fai male da solo). Da tarare: la % nemica potrebbe dover essere più bassa del player, o il nemico-muro va tenuto raro. Playtest decide. NON escludere i nemici (li vogliamo, coerente col Carnefice), ma tarare la % se ingiusto.
- **Il Duo letale può essere troppo forte:** togliere il cap hp-1 sul Tank rende la riflessione un instakill potenziale. Tarabile (% Duo, o cap morbido). Playtest.
- **Bilanciamento:** il gate bot non muove per il player (archetype-blind), ma i nemici-muro sì. Misurare (Task bilanciamento).
- **Feel archetipo:** il tank-arma è divertente o degenere (turtle passivo che vince guardando)? Playtest. È il ribaltamento del template — va sentito in mano.
