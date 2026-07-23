# Spec — Nodo "Patto della Magia" (spell-swap libero, gated da un costo)

_Data: 2026-07-23 · Dinamismo build + patto faustiano · Tipo: nuovo node-type + resolver + gate bilanciamento_

Obiettivo di design: dare **libertà totale di build** (qualsiasi spell su qualsiasi mago) SENZA riaprire
l'exploit dello spell-swap — trasformandolo in un **patto faustiano**: ogni cambio costa vita massima
permanente. La libertà c'è piena; il prezzo, accumulandosi, impedisce di ottimizzare tutti i maghi.

---

## 1. Problema e vincolo storico

Il giocatore vuole libertà: cambiare l'attacco di QUALSIASI mago con QUALSIASI spell (roguelite puro).
Ma "UN MAGO UNA MAGIA" (2026-07-11) rimosse lo spell-swap perché era un **exploit MISURATO**: swap
gratis e ripetibile → ogni mago converge sul suo spell a danno massimo → il danno grezzo batte la rete
di counter (veleno/muro/controllo) → winRate 0.15 → 0.475 (sfondò il tetto 0.45). I conteggi nemici
furono alzati a `[3,5,8]` apposta per combatterlo.

**La causa dell'exploit NON era la casualità — era che lo swap era GRATIS e RIPETIBILE** (ottimizzi tutti).

## 2. Soluzione — swap LIBERO governato da un COSTO (patto faustiano)

Il nodo lascia cambiare la magia di un mago con **qualsiasi spell** (nessun vincolo di ruolo — libertà
piena). MA ogni swap costa **-maxHP permanente** al mago cambiato (riusa `sacrificeCost:{kind:'maxHp'}`).

**Perché chiude l'exploit:** puoi swappare quanti maghi vuoi, ma ogni swap indebolisce permanentemente
quel mago. Ottimizzare TUTTI i maghi sul danno massimo = indebolire tutta la squadra → autolesionista.
Il costo che si accumula è il freno anti-convergenza. La libertà del singolo swap è totale; abusarne fa male.

**Coerenza col gioco:** è il patto faustiano (spina dorsale del Core Fun) applicato agli spell. "Vuoi dare
avada al tuo tank? Paga con la sua vita." Un momento ad alta posta, non un nodo da ignorare. Il vincolo
che rende la feature sicura è ANCHE ciò che la rende emozionante.

## 3. Decisioni di design (approvate)

- **Libertà:** QUALSIASI spell su QUALSIASI mago. Nessun gate di ruolo. (Il costo è il freno, non la whitelist.)
- **Costo:** `-maxHP permanente` al mago swappato (es. **-20 maxHP**, valore STIMA tarabile, come Calice/Corona all'Altare). Riusa `applySacrificeCost({kind:'maxHp', amount})` (`game/engine/sacrifice.ts`).
- **Offerta:** 2 spell casuali (dal catalogo pieno, non per ruolo) — la casualità è sapore roguelite, ma NON è il meccanismo di sicurezza (lo è il costo). L'utente sceglie 1 dei 2 e il mago a cui darlo.
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
    // 2 spell casuali dal catalogo attacchi (esclusa eventualmente la firma del mago scelto).
    // enter USA rng → preservare parità (come pickSpell brucia gen() ordinatamente, statRoll.ts:34).
    return { offers: { swapSpells: pickTwoSpells(rng) }, isCombat: false }
  },
  resolve: (state, node, choice) => {
    if (choice.kind !== 'spell-swap') return state
    const target = state.team.find(d => d.wizard.id === choice.wizardId)
    if (!target) return state
    // ANTI-CHEAT: choice.spellId deve essere una delle 2 offerte (non fidarsi del client).
    // COSTO: applySacrificeCost({kind:'maxHp', amount:SWAP_MAXHP_COST}) sul mago target.
    //   canPay verifica maxHp-amount>=1 → se non paga, no-op (non swappare).
    const cost = { kind: 'maxHp', amount: SWAP_MAXHP_COST } as const
    if (!canPaySacrifice(state, cost, choice.wizardId)) return state
    const base = SPELL_BY_ID[choice.spellId]
    if (!base) return state
    const spell = scaledSpell(base, target.spellLevel)      // preserva spellLevel
    let team = state.team.map(d => (d.wizard.id === choice.wizardId ? { ...d, spell } : d))
    const paid = applySacrificeCost({ ...state, team }, cost, choice.wizardId)  // -maxHP permanente al target
    const ev: RunEvent = { area: state.area ?? 0, nodeId: node.id, kind: 'spellSwap',
      summary: `${target.wizard.name}: patto — nuova magia «${spell.name}» (-${SWAP_MAXHP_COST} vita max)` }
    return { ...paid, log: [...(paid.log ?? []), ev] }
  },
}
```
NB (impl): verificare la firma reale di `applySacrificeCost`/`canPay` in `game/engine/sacrifice.ts` — il
costo `maxHp` all'Altare colpisce "un mago a tua scelta"; qui il mago è il target dello swap (deterministico).
`scaledSpell` — recuperare dalla logica esistente (vecchio primitivo `790478b^` o `upgradeWizardSpell`).

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
- **GATE DI SICUREZZA (OBBLIGATORIO prima del merge — la feature fu tolta PER questo):** misurare
  `campaignBalanceRestricted`/`campaignBalanceB` con un bot handler che ABUSA lo swap nel worst-case
  (swap-ottimizza il più possibile, ignorando il costo maxHP se il bot è miope, O tenendone conto se realistico).
  - Se il winRate resta in banda → il costo-patto frena l'exploit anche nel worst-case. Ship.
  - Se SFONDA il tetto (come il vecchio 0.475) → il costo non basta. Opzioni: (a) alzare il costo maxHP;
    (b) costo scalabile crescente per swap; (c) ridurre la frequenza; (d) NON spedire e ripensare.
    NON abbassare l'assert per far passare — l'exploit è reale se emerge.
  - Con handler `skip` il gate non si muove ma NON misura l'exploit umano → la misura worst-case è OBBLIGATORIA a parte.

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
