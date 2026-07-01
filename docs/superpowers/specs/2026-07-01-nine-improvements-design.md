# Design — Nove migliorie (mappa, combat, boss, UI)

**Data:** 2026-07-01
**Stato:** approvato (brainstorming)

## Contesto

Pass di nove modifiche richieste dall'utente, mappate contro lo stato attuale del
codice tramite esplorazione. Alcune sono già parzialmente presenti, altre sono bug,
altre feature nuove. Tre toccano il bilanciamento calibrato (floor di vittoria
`campaignBalanceB` ≈ 0.15) e vanno rimisurate.

Ordine di rischio: UI/bugfix (basso) → balance-heavy (alto, con gate di misura) →
boss (dipende dalla difficoltà nemici).

---

## A — Mappa: sempre 3 nodi per floor + no duplicati (#1, #7)

**Stato attuale:** mappa a grafo ramificato (Slay-the-Spire). Floor 0/boss/infermeria = 1,
floor 1 = 3 (forzato), floor centrali = `rng.int(2,3)`. La regola scelta (primo step
tra 3, poi cap "2 più vicini") **esiste già** (`map.ts:44-73`, `runEngine.ts:83-96`).
Nessun dedup per-floor: un floor a 3 può uscire tutto `battle` (`nodeGen.ts:73-84`).

**Modifica:**
- `game/engine/map.ts:41-51`: floor centrali forzati a width **3** (non più `rng.int(2,3)`).
  Entry/boss/infermeria restano 1.
- `game/engine/nodeGen.ts`: dedup nei filler — nessun floor esce con 3 tipi identici.
  Le garanzie area-wide (1 elite, ≥1 recruit, ≥1 relic) restano prioritarie; il dedup
  si applica solo agli slot filler. Se il dedup rompesse una garanzia, la garanzia vince
  (con 3 slot e 3 tipi disponibili non accade).

**Rischio balance:** più nodi/area → più clear → più level player. Rimisuro
`campaignBalanceB` dopo. Se sfora, il lever è il mix `categoryWeights` o il menace.

---

## B — Boss nominato per area, garantito come unità, con effetto firma (#9)

**Stato attuale:** solo 2 boss (`voldemort_boss` finale, `muro_boss` area 0).
Area 1 senza boss nominato. `generateBossTeam` (`teamGen.ts:58-68`) fa overlay
statistico sul draft più forte — **non inietta un `wizard.id` specifico**. Nessun
hook effetto-per-boss oltre `exclusiveSynergy` (Voldemort) e `unitDamageReduction` (Muro).

**Modifica:**
1. Nuovo campo `BossDef.bossWizardId?: string`. In `generateBossTeam`, se presente,
   il wizard indicato è **garantito** nel team (draftato e inserito come leader,
   sostituendo lo slot più debole se necessario per non superare `unitCount`).
   Voldemort → `voldemort`, Muro → un leader a tema, Bellatrix → `bellatrix`.
2. Nuovo boss **Bellatrix** (`bellatrix_boss`), `pinnedArea: 1`, `bossWizardId: 'bellatrix'`.
3. Nuovo campo `BossDef.ignoresTaunt?: boolean`. Threaded come `unitDamageReduction`:
   `NodeBattle` → `resolvers/combat.ts` → `simulateBattle` → flag per-unità sul leader
   boss → consumato in `targeting.ts` (`threatScore`/`selectTarget`): un attaccante
   con `ignoresTaunt` ignora il `tauntBonus` del Tank e colpisce la backline.
   Bellatrix usa `ignoresTaunt: true`.
4. Voldemort e Muro guadagnano `bossWizardId` per coerenza (garantiti come unità).

**Dipendenza:** la difficoltà di Bellatrix dipende dal risultato di C (stat nemici).
Faccio B dopo C. Rimisuro `campaignBalanceB` (slice boss area 1) dopo.

---

## C — Stat nemici che crescono per livello (#4)

**Stato attuale:** i nemici **non** crescono di stat per livello. Solo un moltiplicatore
piatto di squadra (`menace`, a livelli bassi moltiplica *giù*, offset `-1.00`) + budget
di draft più alto per aree profonde. Il player invece cresce davvero
(`leveledStats`, `growthBudgetPerLevel 0.28`). Da qui la percezione "livello 4 = livello 1".

**Modifica (task isolato, gate di misura):**
1. Applica `leveledStats` reale anche al team nemico: assegna `level = enemyLevelFor(...)`
   ai nemici e falli passare per `battleReadyTeam`/`leveledStats` in `resolvers/combat.ts`.
2. Con crescita reale attiva, il `menace` piatto diventa ridondante/doppio conteggio.
   Ri-taro: riduco o azzero la parte di menace assorbita dalla nuova crescita, poi
   ri-misuro `campaignBalanceB` e riporto il winRate nella banda (floor 0.15).
3. Iterazione di tuning come nei lavori snowball/final-boss: lever primario = quota di
   crescita nemici vs menace residuo; misuro dopo ogni step, annoto i valori.

**Direzione (decisione utente):** i nemici DEVONO crescere di stat (livello 4 deve
mostrare stat da livello 4, non base) E il gioco deve restare/diventare difficile. Quindi
C non è solo percezione: la crescita reale va assorbita solo in parte dal menace, lasciando
la difficoltà netta **uguale o superiore** a oggi. Target: winRate near-optimal resta ≥
floor 0.15 ma NON più in alto del necessario — puntiamo al bordo basso della banda, non a
un margine comodo. Se durante la misura c'è headroom, lo spendo alzando la minaccia nemica,
non abbassandola.

**Rischio:** alto. Può servire più di un giro di tuning. Trattato con approvazione
measure-driven prima di committare i valori finali.

---

## D — Audit attacchi deboli/inerti (#2)

**Stato attuale:**
- `tarantallegra`: solo `-20` spd flat, 0 danno. Debole.
- `fianto` (Fianto Duri): `+30` def self-buff. Funziona ma invisibile (self-cast, nessun
  scudo assorbente).
- `silencio` / kind `silence`: **inerte** — `canCastSpell` esiste ma non è mai chiamato
  nel loop (`simulate.ts` chiama solo `canAct`/`canAttack`). Bug reale.
- `hitChance` inutilizzato per spell solo-effetto (nessun tiro accuratezza nel path
  `applyStatus`).
- StatusDef graduati (`weaken*`/`expose*`/`slow*`) wired ma non referenziati da alcuno
  spell base.

**Modifica:**
1. Tabella di audit di tutti gli spell in `data/spells.ts`: per ognuno effetto reale in
   combat, se inerte/debole.
2. Fix `silence`: collego `canCastSpell` nel loop così i silenziati non lanciano.
3. Potenzio `tarantallegra`: aggiungo chance di stun (salto turno) oltre al rallentamento.
4. Potenzio `fianto`: da +30 def piatto a scudo assorbente vero (barriera HP) o def %
   più alta, così è visibile e impattante.
5. Ribilancio gli altri deboli emersi dall'audit.

**Rischio balance:** medio. Se cambio output danni/controllo dei nemici, rimisuro dopo C.

---

## E — Bug modale vittoria con nemici vivi (#3)

**Stato attuale:** la modale mostra "Vittoria" quando `result.winner === 'left'` +
replay finito, **senza controllare che i nemici siano a 0 HP**
(`BattleScreen.tsx:119-121`). Su timeout `turnCap` (turn 100) `simulate.ts:346` dichiara
vincitore chi ha più HP% **con entrambe le squadre ancora vive** → "Vittoria" con nemici
vivi.

**Modifica:**
- La modale mostra "Vittoria" solo se il team nemico è davvero azzerato. Su esito da
  timeout (entrambe vive), mostra un esito coerente (es. "Tempo scaduto" / esito per HP%
  esplicitato) invece di "Vittoria" ingannevole.
- Il fix di F (fatigue più chiara/efficace) riduce comunque la frequenza del timeout.

---

## F — Fatigue chiara (#8)

**Stato attuale:** "Fatica" = danno vero self-cast a fine turno oltre turn 18
(`simulate.ts:318-335`). Il log dice **"X lancia Fatica su X: N danni"** (self-cast brutto),
icona identica a veleno, nessun banner. Non è uno status in `data/statuses.ts`.

**Modifica:**
- Banner/indicatore chiaro "Sfinimento!" quando la fatigue inizia (turn > `fatigueStart`).
- Log dedicato: non "X lancia Fatica su X" ma una riga di sistema tipo
  "Sfinimento: X subisce N danni" (`BattleLog.tsx` case dedicato per `action === 'Fatica'`).
- Icona/tono distinti dal veleno sulla bust.

---

## G — Albero più grande + sinergie su hover (#5)

**Stato attuale:** chip sinergie (`n.preview`) **sempre visibili** sopra ogni nodo
(`MapScreen.tsx:148-174`) → affollamento. Spaziatura `COL=132, ROW=116`.

**Modifica:**
- Ingrandisco spaziatura nodi (COL/ROW) per un layout più arioso.
- Le chip sinergie appaiono solo su hover/focus del nodo (come già fa il label tipo).
- Layout coerente e moderno.

---

## H — Sidebar: togli LOADOUT, info nel primo box (#6)

**Stato attuale:** sidebar (`RunBRunner.tsx:33-45`) = `TeamSynergyBar` (maghi + sinergie)
+ box Reliquie + `LoadoutPanel` ("LOADOUT", selettore spell collassato). Il primo box
mostra solo ritratto/nome/Lv per mago, niente ruolo/attacco.

**Modifica:**
- Rimuovo `LoadoutPanel` dalla sidebar.
- Nel primo box (righe maghi di `TeamSynergyBar`), per ogni mago aggiungo: icona ruolo,
  incantesimo equipaggiato, **selettore spell** (assorbe la funzione di LOADOUT).
  Riuso `RoleIcon`/`roleTooltip` e gli helper glossary (`spellTypeChip`,
  `formatSpellStats`) già usati dai card component.

---

## Ordine di implementazione

1. **A** (mappa struct) — poi rimisuro floor
2. **E** (bug modale) — indipendente
3. **F** (fatigue chiara) — indipendente
4. **G** (albero UI) — indipendente
5. **H** (sidebar UI) — indipendente
6. **D** (audit attacchi) — poi rimisuro floor
7. **C** (stat nemici per livello) — gate di misura, balance-heavy
8. **B** (boss per area) — dipende da C; poi rimisuro slice boss

Ogni step che tocca il bilanciamento (A, D, C, B) chiude con una misura di
`campaignBalanceB` e riporto nella banda del floor 0.15 prima di procedere.

## Testing

- Vitest esistente (`campaignBalanceB.test.ts`, combat/map tests). Nota: `npm run test`
  non fa typecheck → eseguo `npm run typecheck` sui file TS nuovi/modificati.
- Nuovi test: dedup floor (A), boss unit garantita + ignoresTaunt (B), enemy leveling (C),
  silence gate + spell potenziati (D), modale su timeout (E), fatigue log (F).
