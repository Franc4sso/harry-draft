# Spec — Nodo "Patto della Magia" (spell-swap libero, gated da un costo)

_Data: 2026-07-23 · Dinamismo build + patto faustiano · Tipo: nuovo node-type + resolver + gate bilanciamento_

Obiettivo di design: dare **libertà totale di build** (qualsiasi spell su qualsiasi mago) — lo swap è
**GRATIS**, nessun costo per il giocatore. La libertà del giocatore è la priorità; il bilanciamento si
gestisce dietro le quinte (misurare l'exploit e, se serve, ri-alzare i nemici — MAI limitando lo swap).

> DECISIONE UTENTE (2026-07-23): lo swap NON costa vita né altro. Scartata l'ipotesi "patto -maxHP".
> Il freno al bilanciamento sta sui NEMICI, non sulle scelte del giocatore.

---

## 1. Problema e vincolo storico

Il giocatore vuole libertà: cambiare l'attacco di QUALSIASI mago con QUALSIASI spell (roguelite puro).
Ma "UN MAGO UNA MAGIA" (2026-07-11) rimosse lo spell-swap perché era un **exploit MISURATO**: swap
gratis e ripetibile → ogni mago converge sul suo spell a danno massimo → il danno grezzo batte la rete
di counter (veleno/muro/controllo) → winRate 0.15 → 0.475 (sfondò il tetto 0.45). I conteggi nemici
furono alzati a `[3,5,8]` apposta per combatterlo.

**La causa dell'exploit NON era la casualità — era che lo swap era GRATIS e RIPETIBILE** (ottimizzi tutti).

## 2. Soluzione — swap LIBERO e GRATIS, bilanciamento sui nemici

Il nodo lascia cambiare la magia di un mago con **qualsiasi spell** (nessun vincolo, nessun costo).
Massima libertà del giocatore. Il bilanciamento NON grava sul giocatore: si gestisce misurando l'impatto
e, SE l'exploit emerge, ri-alzando i NEMICI (i conteggi erano `[3,5,8]` proprio per questo, pre-rimozione).

**Perché la libertà è la priorità (decisione utente):** un roguelite può tarare la difficoltà sui nemici
invece che pedaggiare le scelte del giocatore. Lo swap gratis dà la fantasia piena "gioca come vuoi".

**Trade-off ONESTO (rischio consapevole):** ri-alzare i nemici per assorbire l'exploit rende il gioco più
duro per TUTTI — anche chi non usa lo swap subisce nemici tarati su chi lo abusa. L'utente accetta questo
trade-off (libertà del giocatore > difficoltà uniforme). Documentato, non nascosto.

## 3. Decisioni di design (approvate)

- **Libertà:** QUALSIASI spell su QUALSIASI mago. Nessun gate di ruolo, **nessun costo**. Swap GRATIS.
- **Costo:** NESSUNO. Lo swap non toglie vita, reliquie, né altro al giocatore.
- **Offerta:** 2 spell casuali dal catalogo pieno. L'utente sceglie 1 dei 2 e il mago a cui darlo.
- **Bilanciamento:** gestito sui NEMICI (misura worst-case → se sfonda, alza i conteggi/potere nemico), MAI limitando lo swap.
- **Nodo:** nuovo tipo `spellSwap`, filler raro (peso ~12, come SpellForge). Gemello di SpellForge.
- **Combat:** casta fedelmente lo spell assegnato (`selectSpell` ritorna `unit.spell`, zero modifiche motore).
- **Firma-abilità:** resta (decoupled — keyed by wizard.id). Voldemort tiene Terrore, casta il nuovo spell.
- **spellLevel:** preservato attraverso lo swap.
- **Bot handler:** `skip` (come Altare) + misura worst-case separata (§6).
- **Endless:** ESCLUSO (come SpellForge/shop).
- **Cap maxHP:** `canPay` di sacrifice richiede `maxHp - amount >= 1` — un mago non può swappare se lo ucciderebbe. Riusa il guard esistente.

## 4. Architettura — nuovo node-type (riuso massimo)

### 4a. Il resolver (`game/engine/resolvers/spellSwap.ts`, nuovo — modellato su spellForge.ts + altare.ts)
```ts
export const spellSwapResolver: NodeResolver = {
  id: 'spellSwap',
  enter: (state, node, rng) => {
    // 2 spell casuali dal catalogo attacchi, deterministici dal nodo (pattern altareOffer).
    return { offers: { swapSpells: swapOffer(state, node, rng).map(s => s.id) }, isCombat: false }
  },
  resolve: (state, node, choice, rng) => {
    if (choice.kind !== 'spell-swap') return state
    const target = state.team.find(d => d.wizard.id === choice.wizardId)
    if (!target) return state
    const offered = swapOffer(state, node, rng).map(s => s.id)
    if (!offered.includes(choice.spellId)) return state     // ANTI-CHEAT: solo tra i 2 offerti
    const base = SPELL_BY_ID[choice.spellId]
    if (!base) return state
    const spell = scaledSpell(base, target.spellLevel ?? 1)  // preserva spellLevel. NESSUN COSTO.
    const team = state.team.map(d => (d.wizard.id === choice.wizardId ? { ...d, spell } : d))
    const ev: RunEvent = { area: state.area ?? 0, nodeId: node.id, kind: 'spellSwap',
      summary: `${target.wizard.name}: nuova magia «${spell.name}»` }
    return { ...state, team, log: [...(state.log ?? []), ev] }
  },
}
```
NB (impl): NESSUN costo — via `sacrifice.ts` da questo resolver. `swapOffer` = pattern deterministico di
`altareOffer` (fork con BASE 6000). `scaledSpell` — recuperare dalla logica esistente (`upgradeWizardSpell`
di spellForge) o dal vecchio primitivo `790478b^`; con spellLevel 1 ≈ base.

### 4b. Il ResolverChoice kind (`game/engine/resolvers/types.ts`)
Aggiungere `{ kind: 'spell-swap'; wizardId: string; spellId: string }` a `ResolverChoice`.

### 4c. `pickTwoSpells(rng)` helper
Pura, deterministica dal rng: 2 spell distinti casuali dal catalogo attacchi (`SPELLS` type Attacco).
(NON gated per ruolo — libertà totale.)

### 4d. Registrazione node-type (i 7 punti, come spellForge — VERIFICATI sul codice)
1. `game/engine/runEngine.ts:43` — `registerResolver(spellSwapResolver)`.
2. `data/constants.ts:611` `categoryWeights` — `spellSwap: 12` (+ aggiornare il Record type inline).
3. `game/engine/nodeGen.ts:10` `Filler` type — aggiungere `'spellSwap'`.
4. `game/engine/nodeGen.ts:150,154` `entries` — `['spellSwap', cw.spellSwap]`, zerato in endless.
5. `types/run.ts:8,12` — `'spellSwap-node'` (phase) e `'spellSwap'` (RunNodeType).
6. `game/engine/runEngine.ts:123` — phase-string map: `t === 'spellSwap' ? 'spellSwap-node'`.
7. `game/engine/endlessReplay.ts` — `spell-swap` (come `spell-upgrade`) mai in endless (nodo escluso).

### 4e. UI
Nuovo screen (modellato su SpellForge/Altare screen): scegli mago → vedi le 2 opzioni → conferma, mostrando
CHIARO il costo (-N maxHP permanente). Riusare i pattern UI esistenti (premium-ui-system). Il costo va
comunicato prima della conferma (è un patto — il giocatore deve sapere cosa paga).

### 4f. Bot handler (harness — OBBLIGATORIO)
`campaignBalanceRestricted.test.ts` + `campaignBalanceB.test.ts`: handler per la phase `spellSwap-node`.
Default `skip` (come altare) — senò instant-defeat artefatto. E una misura worst-case separata (§6).

## 5. Cosa NON facciamo (YAGNI)

- Nessun gate di ruolo sull'offerta (libertà piena — il costo è il freno).
- Nessuna modifica a `selectSpell`/combat (casta già `unit.spell`).
- Nessuna modifica al sistema signature (decoupled).
- Nessun cambio ai tag-archetipo (lo swap NON fa contare un mago per l'archetipo veleno — quello legge i tag; limite noto e accettato).
- Nessun nodo in endless.
- Nessun nuovo sistema di costo (riusa sacrifice.ts).

## 6. Testing + GATE DI BILANCIAMENTO (il cuore del rischio)

- **Resolver (deterministico):** `enter` offre 2 spell casuali; `resolve` valida (spell tra le 2 offerte),
  applica -maxHP al target, assegna il nuovo spell preservando spellLevel; combat casta il nuovo spell.
- **Anti-cheat resolve:** `choice.spellId` non tra le 2 offerte → no-op. `canPay` fallito (ucciderebbe il mago) → no-op.
- **Costo permanente:** dopo lo swap, il maxHP del mago è sceso e RESTA sceso (persiste nella run). Verificare.
- **Parità replay (CRITICO):** `enter` usa rng → `endlessReplayParity` DEVE restare verde (nodo escluso da
  endless, ma verificare ogni parity test campagna). Se rosso → STOP.
- **GATE DI MISURA (OBBLIGATORIO prima del merge — la feature fu tolta PER questo):** misurare
  `campaignBalanceRestricted`/`campaignBalanceB` con un bot handler che ABUSA lo swap nel worst-case
  (ottimizza ogni mago sul suo spell a danno massimo). Lo swap è GRATIS → l'exploit può riemergere pieno.
  - Se il winRate resta in banda → sicuro anche senza costo. Ship senza toccare i nemici.
  - Se SFONDA il tetto (come il vecchio 0.475) → **ri-alzare i NEMICI** (conteggi verso `[3,5,8]`, o potere)
    finché il worst-case rientra, ri-misurando. Questo è il freno scelto (sui nemici, non sullo swap).
    Documentare la taratura. NON abbassare l'assert per far passare; NON aggiungere un costo allo swap (decisione utente).
  - Con handler `skip` il gate normale non si muove ma NON misura l'exploit → la misura worst-case è OBBLIGATORIA a parte.
  - **Trade-off documentato:** alzare i nemici rende il gioco più duro per tutti (rischio §8). Accettato dall'utente.

## 7. File toccati (previsti)

- Create: `game/engine/resolvers/spellSwap.ts`, la UI screen, `pickTwoSpells` helper.
- Modify: `resolvers/types.ts` (ResolverChoice), `runEngine.ts` (register + phase map), `data/constants.ts` (categoryWeights + SWAP_MAXHP_COST), `nodeGen.ts` (Filler + entries), `types/run.ts` (phase + RunNodeType), `endlessReplay.ts` (esclusione), riuso `sacrifice.ts`.
- Modify: `campaignBalanceRestricted.test.ts` + `campaignBalanceB.test.ts` (handler skip + misura worst-case).
- Test: `tests/engine/spellSwap.test.ts` (resolver + costo + anti-cheat), estensione parità.

## 8. Rischi

- **Bilanciamento (#1):** l'intero motivo per cui lo swap fu tolto. Mitigato dal costo-patto che si accumula,
  ma VA MISURATO nel worst-case (§6). Questo gate decide se la feature spedisce. Se il costo non basta, si alza.
- **Cablatura node-type:** 7 punti (§4d); un punto mancato = nodo che non appare o rompe la mappa.
- **Parità replay:** `enter` usa rng; verificare ogni parity test.
- **Feel:** il costo-patto è il giusto peso (usi lo swap con parsimonia, come voluto) o è così caro che il
  giocatore non lo usa mai? Da validare al playtest. Il valore -maxHP è tarabile.
- **maxHP che scende sotto soglia:** `canPay` guard (`maxHp-amount>=1`) impedisce di uccidere un mago; verificare il riuso corretto.
