# Spec — Reliquie flat: taglia 3, converti 4

_Data: 2026-07-22 · Fase 3 della roadmap Core Fun (ritmo emotivo) · Tipo: PURA data (data/relics.ts) — zero motore_

Frase-cuore servita: indirettamente — **ogni reliquia una decisione, non un numero.** Snellisce il pool
e alza la qualità, compensando il calo di *quantità* reliquie causato dall'Altare garantito (Fase 3, passo 1).

---

## 1. Problema

7 reliquie sono **flat +stat senza decisione né storia** — il beat più noioso e (per le comuni) più
frequente del gioco. E il pool è ridondante: 3 reliquie "+% tutto" (Felix +5%, Occhio +8%, Sambuco +12%),
2 "Occhio" quasi omonimi. La roadmap punta a ~20-25 reliquie *che fanno qualcosa*, non ~47 di cui molte piatte.

## 2. Obiettivo

**Taglia 3 reliquie ridondanti, converti 4 in decisioni** (stile della palette esistente, zero motore).
Pool 47→44. Ogni reliquia flat noiosa sparisce: cancellata o trasformata.

## 3. Decisioni di design (approvate)

- **Varietà, non uniformità:** ogni conversione un carattere diverso (carrier / drawback / condizionale).
- **Taglia il ridondante** invece di convertire tutto: meno reliquie migliori > tante mediocri.
- **Fondere i due "Occhio"** (dedup di nome e ruolo).
- **Fixture dei test tagliati** → riagganciati a reliquie esistenti equivalenti (no nuove reliquie).

## 4. Il piano reliquia-per-reliquia

### 4a. TAGLIA (3) — rimuovi da `RELICS`, da `STARTER_RELICS`, aggiorna i test-fixture

| id | oggi | perché taglia |
|---|---|---|
| `occhio-moody` (Occhio di Malocchio, rara, `+8% allPct`) | +8% tutto | Doppione di nome/tema con `occhio-magico` (Occhio Magico di Malocchio, always-hit). Confusione. Tieni solo `occhio-magico`. |
| `pozione-fortuna` (Felix Felicis, comune, `+5% allPct`) | +5% tutto | +5% invisibile; 3 "+% tutto" nel pool sono ridondanti. Resta Bacchetta (convertita) come "+%" degno. |
| `bezoar` (comune, `+8 regen`) | +8 regen team | Regen puro noioso, già coperto da `coppa-tassorosso` (regen condizionale) + role Supporto. |

**Riferimenti orfani da sistemare (VERIFICATO sul codice — senza questi il build rompe):**
- `data/unlocks.ts:42` `STARTER_RELICS`: rimuovere `'pozione-fortuna'` e `'bezoar'`. CONFERMATO: entrambi
  presenti a riga 42; `occhio-moody` e `pensatoio` NON sono in STARTER_RELICS oggi. `giratempo` e
  `mantello-invisibilita` restano (sono CONVERTITE, non tagliate) → NON rimuoverli.
- `tests/engine/corruzioneBattle.test.ts:43,50` — usa `RELIC_BY_ID['bezoar']` come reliquia regen. Riagganciare a un'altra reliquia con `bonus.regen` esistente (es. `coppa-tassorosso` — MA ha `condition` casa; per un test regen non condizionato serve una regen flat. Se nessuna regen flat resta, il test va costruito con una regen inline O si tiene una regen flat. **Scelta:** riagganciare a un'`ActiveRelic` con `coppa-tassorosso` e un team di 3 Tassorosso, OPPURE — più semplice — costruire l'`ActiveRelic` con un oggetto Relic inline `{ id:'test-regen', ..., bonus:{regen:8} }`. L'implementer sceglie il minimo che tiene il test verde e onesto).
- `tests/engine/combat/simulate.test.ts:131` — stesso `RELIC_BY_ID['bezoar']` per regen. Stessa soluzione.
- `tests/engine/replayRelics.test.ts:45-49` — usa `pozione-fortuna` per testare `allPct:0.05` su maxHp. Riagganciare a un'altra reliquia con `allPct` — dopo i tagli resta `bacchetta-sambuco` MA viene convertita (perde allPct puro). **Scelta:** riagganciare a un oggetto Relic inline `{ bonus:{allPct:0.05} }` o alla Bacchetta pre-conversione se ancora allPct. L'implementer verifica quale allPct-relic sopravvive e usa quella, o inline.

**NB per l'implementer:** eseguire `grep -rn` sugli id tagliati PRIMA di cancellare, per catturare ogni altro riferimento non elencato qui (test di conteggio pool, nodeCatalog, ecc.).

### 4b. CONVERTI (4) — pura data in `data/relics.ts`

| id | oggi | → diventa | campi | fantasia |
|---|---|---|---|---|
| `giratempo` | `bonus:{spd:12}` | +30 SPD a UN mago | `assignable:true`, `carrierBonus:{spd:30}`, rimuovi `bonus` | "Il tempo è personale: a chi lo dai?" |
| `mantello-invisibilita` | `bonus:{def:14}` | +26 DEF a UN mago | `assignable:true`, `carrierBonus:{def:26}`, rimuovi `bonus` | "Chi nascondi sotto il mantello? Uno solo." |
| `pensatoio` (rara) | `bonus:{atk:15,def:15}` | +35 ATK ma −18 DEF (rischio) | `bonus:{atk:35}`, `drawback:{def:-18}`, **+ id in `JOKER_RELIC_IDS`** | "Rivivi la battaglia: più aggressivo, più esposto." |
| `bacchetta-sambuco` (epica) | `bonus:{allPct:0.12}` | +20% ATK se ≥3 stessa casa | `bonus:{allPct:0}`→usa `atk`? No: usa `allPct` NON permette per-stat. **Scelta:** `bonus:{allPct:0.20}`, `condition:{house:'Grifondoro', count:3}` | "La Bacchetta serve un maestro degno: una casa unita." |

**Note per l'implementer:**
- `carrierBonus` richiede `assignable:true` (verificato — `mano-della-gloria` è il template, `relics.ts:137`). Il carrier va assegnato a un mago al draft; il motore legge `carrierBonus` solo quando `ar.assignedTo === wizardId` (`relics.ts:131-134`). Aggiornare la `desc` per dire "Assegna a un mago: …".
- `pensatoio` → drawback (joker-style) DEVE entrare in `JOKER_RELIC_IDS` (`data/relics.ts:164`) senò leakerebbe sui nemici e nel draft bot (memoria: joker player-only). E in `STARTER_RELICS` (i joker sono in STARTER_RELICS — verificare pattern `jokerRoster.test.ts`).
- `bacchetta-sambuco`: `condition` supporta solo casa FISSA (`{house:'X', count}`), non "stessa casa qualunque" (`relicMatchesCondition` conta match su una casa specifica). Scelgo `Grifondoro` come casa tematica (la Bacchetta è di Silente→Harry, entrambi Grifondoro). Aggiornare `desc`. Il valore 0.20 su `allPct` è forte per un'epica condizionata — tarabile.
- Aggiornare la `desc` di OGNI reliquia convertita per descrivere il nuovo effetto (le desc sono user-facing).

## 5. Cosa NON facciamo (YAGNI)

- Nessun cambio motore (ogni meccanismo — carrier, drawback, condition — è già letto dall'engine).
- Nessuna nuova reliquia (i fixture riusano reliquie esistenti o oggetti inline).
- Nessun tocco alle reliquie già interessanti (condizionali, archetipo, joker esistenti).
- Nessun ri-bilanciamento dei nemici; i numeri delle convertite sono tarabili ma il bot è cieco alle reliquie player.

## 6. Testing

- **Tagli:** dopo aver rimosso le 3 reliquie e i riferimenti, la suite completa deve restare verde. I 3 test
  fixture (corruzioneBattle, simulate, replayRelics) vanno riagganciati e devono ancora verificare il loro
  meccanismo (regen tick / allPct su maxHp) — NON indebolire l'assert, solo cambiare la reliquia-fonte.
- **Conversioni:** test che verifichi ogni conversione:
  - `giratempo`/`mantello` → assegnati a un mago danno il `carrierBonus` a QUELLO e non al team (spec del carrier).
  - `pensatoio` → applica +35 ATK e −18 DEF (drawback sempre attivo); ed è in `JOKER_RELIC_IDS` (escluso da `selectEnemyRelics` e `offerRelics`).
  - `bacchetta-sambuco` → +20% solo con ≥3 Grifondoro, 0 altrimenti (`relicMatchesCondition`).
- **Invarianti joker (memoria — critica):** `pensatoio` NON deve comparire in `selectEnemyRelics` né nel
  draft bot. Test: `selectEnemyRelics` non lo ritorna; è in `JOKER_RELIC_IDS`.
- **Pool count:** se esistono test che asseriscono la dimensione del pool reliquie o STARTER_RELICS, aggiornarli
  a −3 (i test `jokerRoster`/`scalingJokers` asseriscono che i joker sono in STARTER_RELICS → `pensatoio` va aggiunto lì).
- **Bilanciamento:** girare `campaignBalanceRestricted` + `campaignBalanceB` (asseriscono winRate∈[0,1]) — restano
  verdi (bot cieco alle reliquie player). NON ritarare.

## 7. File toccati (previsti)

- Modify: `data/relics.ts` — rimuovi 3 reliquie, converti 4, aggiungi `pensatoio` a `JOKER_RELIC_IDS`.
- Modify: `data/unlocks.ts` — rimuovi `pozione-fortuna`/`bezoar` da `STARTER_RELICS`, aggiungi `pensatoio`.
- Modify: `tests/engine/{corruzioneBattle,combat/simulate,replayRelics}.test.ts` — riaggancia fixture.
- Modify: eventuali test di pool-count / jokerRoster / scalingJokers.
- Test: nuovo `tests/data/relicConversions.test.ts` (o simile) per le 4 conversioni + invarianti joker.

## 8. Rischi

- **Riferimenti orfani ai tagli:** il rischio #1. Mitigato: `grep -rn` sugli id PRIMA di cancellare; i punti
  noti sono elencati (§4a). Se ne emerge uno non elencato, sistemarlo (non forzare).
- **Invariante joker:** `pensatoio` diventa joker → DEVE stare in `JOKER_RELIC_IDS` + `STARTER_RELICS` o
  rompe l'esclusione player-only (leak sui nemici) o l'accesso in gioco. Test dedicato.
- **Bilanciamento:** ZERO impatto di difficoltà misurata (bot cieco alle reliquie player). Numeri convertiti
  tarabili al playtest (es. Sambuco 20% forte, Pensatoio −18 DEF punitivo). Nessuna ri-taratura harness.
- **Feel:** da validare al playtest — le 4 convertite creano davvero decisioni? I 3 tagli si sentono come
  "meno scelta" o "meno rumore"? Reversibile (ripristinare una reliquia è pura data).
