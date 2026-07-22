# Spec — Altare Oscuro garantito ≥1 per area

_Data: 2026-07-22 · Fase 3 della roadmap Core Fun (ritmo emotivo) · Tipo: nodeGen — cambio chirurgico_

Frase-cuore servita: **"pago un prezzo che fa male"** — il patto faustiano da raro a spina dorsale.

---

## 1. Problema

Il momento più alto del gioco — l'**Altare Oscuro** (posta alta, irreversibile: sacrifica un mago /
-maxHP per sempre / corruzione per potere) — compare solo al **~30% delle aree** (`ALTARE_CHANCE = 0.3`,
`nodeGen.ts:12`). Le frequenze sono invertite: il beat noioso (reliquia +stat) è comune, il beat
emozionante è raro. Il patto è potente proprio perché speciale, ma oggi è così raro da non definire il ritmo.

## 2. Obiettivo

**Ogni area garantisce esattamente 1 Altare Oscuro** (era 30%). 3 aree/run → il patto diventa una spina
dorsale ricorrente: ~3 momenti faustiani garantiti per run. Resta **sempre evitabile** (ogni floor medio è
largo 3 → il giocatore può aggirarlo) e **costa caro ogni volta** (non lo prendi sempre) → il rischio
"routine" è mitigato dal design esistente, non serve dosare oltre.

## 3. Decisioni di design (approvate)

- **Cosa:** l'Altare, non un evento faustiano né un nuovo tipo di nodo. È il patto più puro e già completo
  (offre le reliquie-sacrificio epiche). Edit minimo.
- **Ritmo:** garantito in **tutte e 3 le aree** (non solo 2-3). Massimo ritmo emotivo.
- **Endless:** resta **escluso** (il controller endless non ha handler altare — invariato).

## 4. Architettura — cambio chirurgico in `nodeGen.ts`

Il blocco `3b` (righe 83-95) oggi è probabilistico. Diventa **garantito**, identico al pattern del blocco
`3` (relic, righe 75-81) subito sopra — che già pesca uno slot libero e ci mette il nodo.

### 4a. Rimuovere la costante
- Riga 12: `const ALTARE_CHANCE = 0.3` → **rimossa** (non più usata).

### 4b. Rendere il piazzamento incondizionato
Il blocco attuale (righe 88-95):
```ts
if (!endless && rng.next() < ALTARE_CHANCE) {
  const pool = free()
  if (pool.length > 0) {
    const s = rng.pick(pool)
    setCat(cats, s.floor, s.idx, 'altare')
    used.add(key(s.floor, s.idx))
  }
}
```
diventa (garantito in campaign, escluso in endless):
```ts
if (!endless) {
  const pool = free()
  if (pool.length > 0) {
    const s = rng.pick(pool)
    setCat(cats, s.floor, s.idx, 'altare')
    used.add(key(s.floor, s.idx))
  }
}
```

### 4c. INVARIANTE ENDLESS — determinismo da preservare
Oggi il corto-circuito `!endless` è scritto in modo che in endless il roll `rng.next()` **NON venga
consumato** (lo stream rng endless resta identico). Nel nuovo codice, in endless il ramo `if (!endless)`
è falso → **nessuna `rng.next()` chiamata** (il vecchio `rng.next()` era nel guard `&&`, quindi già non
valutato quando `!endless` era falso per corto-circuito). Quindi: **gli stream rng endless restano
byte-identici**. Verificato dalla logica di corto-circuito `&&`, ma va confermato da `endlessReplayParity`.

Nota su campaign: rimuovere la `rng.next()` **cambia** gli stream rng campaign (un draw in meno per area)
→ le mappe sui seed fissi si rimescolano. Questo è **atteso e innocuo** (l'analisi conferma: la frequenza
altare non è una leva di difficoltà, il bot è cieco al contenuto; muove solo rumore di reshuffle).

### 4d. Docstring
- Aggiornare il commento del blocco `3b` (righe 83-87): da "~30% delle aree ne piazza ESATTAMENTE UNO"
  a "OGNI area (campaign) piazza ESATTAMENTE UNO — garantito; sempre evitabile (floor width 3); escluso in endless".
- Aggiornare la docstring della funzione (righe 17-32) se elenca l'altare come probabilistico.

## 5. Cosa NON facciamo (YAGNI)

- Nessun nuovo tipo di nodo, nessun nuovo resolver, nessun cambio al contenuto dell'Altare o alle
  reliquie-sacrificio (i loro costi sono già il governatore del bilanciamento).
- Nessun cambio agli eventi faustiani (restano filler).
- Nessun altare in endless (fuori scope).
- Nessun ritocco di bilanciamento (winRate/enemy power).

## 6. Testing

- **nodeGen (deterministico):** test che ogni area campaign contenga esattamente 1 nodo `altare`
  (prima era ~30%). Generare N aree con seed fissi e asserire il conteggio altare == 1 per ognuna.
  Verificare che endless NON piazzi altare (0).
- **Guardia slot:** con la mappa piena di garanzie (infermeria+elite+relic+altare), verificare che non si
  esaurisca il pool (12 slot medi − 4 garanzie = 8 liberi → ampio margine; nessun throw).
- **Parità endless:** girare `tests/engine/endlessReplayParity.test.ts` — DEVE restare verde (stream rng
  endless invariati). Questa è la guardia critica.
- **Gate di bilanciamento:** girare `tests/engine/campaignBalanceRestricted.test.ts` (il gate reale) e
  `campaignBalanceB.test.ts` (reference). Asseriscono solo `winRate ∈ [0,1]` → devono restare verdi;
  il winRate si muoverà solo per reshuffle (atteso). NON ritarare.
- Girare la suite completa per confermare zero rotture (i test di conteggio nodi sono sparsi — memoria:
  cambi a nodeGen possono toccare test di count).

## 7. File toccati (previsti)

- Modify: `game/engine/nodeGen.ts` — rimuovere `ALTARE_CHANCE`, rendere il blocco altare incondizionato, docstring.
- Test: nuovo test in `tests/engine/` (es. `altareGuaranteed.test.ts`) o estensione di un test nodeGen esistente.

## 8. Rischi

- **Determinismo endless:** l'unico rischio reale. Mitigato: in endless il ramo è saltato, nessuna
  `rng.next()` in più. `endlessReplayParity` è la prova. Se rosso → STOP e ripensare (ma la logica dice verde).
- **Test di conteggio nodi sparsi:** cambiare la frequenza altare può rompere un test che assumeva "0 o 1
  altare". Vanno aggiornati per riflettere "esattamente 1 per area campaign".
- **Bilanciamento:** ZERO impatto di difficoltà (bot cieco). Il winRate si muove per reshuffle → i gate
  `winRate>0` restano verdi. Nessuna ri-taratura.
- **Feel (routine):** da validare al playtest. Mitigato da evitabilità + costo. Se 3/run sembrano troppi,
  un cambio banale (saltare l'area 1) è disponibile — ma non ora.
