# Battaglie a tema + telegrafo nell'albero — design (bug #3)

> Data: 2026-06-30. Risolve la richiesta utente #3: le battaglie si ripetono (sempre gli stessi nemici);
> volute battaglie generate casualmente CON CRITERIO (meno sinergie nelle facili, più nelle epiche) +
> un TELEGRAFO nell'albero che mostra contro quali sinergie/boss si andrà.

## Diagnosi (verificata)

`pickTowardBudget` (`game/engine/combat/teamGen.ts:27`) pesca da una **finestra fissa di `count*3`
maghi** centrata sul budget, poi shuffle + prende i **top-`count` per power**. Per un dato budget
(= funzione deterministica di area/floor/nodeType), la finestra è sempre gli stessi ~15 maghi e si
prendono sempre i più forti → l'IDENTITÀ dei nemici non cambia. Il seed varia gli stat-roll, non i
personaggi. Inoltre le sinergie nemiche sono emergenti (zero controllo per difficoltà), e la squadra è
generata a resolve-time (troppo tardi per un preview).

## Decisione architetturale chiave: genera UNA volta, salva nel nodo

⚠️ Il rischio di questo design è "la squadra serve in due posti (telegrafo + battaglia) e devono essere
identiche" — la stessa classe di bug che ha morso 2 volte in questa sessione (le due regen path; l'Infermeria
sul generatore morto). Mitigazione ARCHITETTURALE, non solo un test:

**Tutto ciò che determina la battaglia è generato UNA SOLA VOLTA, a map-build time, e salvato nel
`RunNode`. Il resolver di combattimento lo LEGGE dal nodo invece di rigenerarlo.** Una sola fonte di
verità → zero possibilità di divergenza preview-vs-realtà.

⚠️ ROAST-FIX #1 (cruciale): la battaglia NON è determinata solo dalla squadra base — il resolver applica
anche **menace** (scaling per livello), le **reliquie nemiche** su elite/boss, e il **livello** nemico.
Se salvassi solo i wizard, il preview (sinergie della squadra base) potrebbe NON riflettere la battaglia
reale (es. una reliquia nemica aggiunge un effetto che il telegrafo non mostra). Quindi il nodo salva
TUTTO il pacchetto-battaglia:
```ts
RunNode.battle?: {
  enemyTeam: DraftedWizard[]      // i wizard generati (con stat-roll già fissati)
  enemyRelics: ActiveRelic[]      // le reliquie nemiche (elite/boss), già scelte
  enemyLevel: number              // il livello → menace già determinato
  bossSynergy?: ActiveSynergy     // la synergia esclusiva del boss, se boss finale
}
```
Il resolver legge l'INTERO `node.battle` (squadra + relics + level + bossSynergy) e NON rigenera nulla.
Il `preview.synergyIds` è derivato da `detectSynergies(enemyTeam)` + le synergie portate dalle reliquie
+ la bossSynergy → il telegrafo riflette la battaglia REALE al 100%. `DraftedWizard`/`ActiveRelic` sono
dati puri (serializzabili JSON; il save è già `saveRun(next)` in localStorage). Il nodo diventa più
pesante — accettato per eliminare la classe di bug (la stessa che ci ha morsi 2 volte: due regen path,
Infermeria su generatore morto).

## Sezione 1 — Generatore a tema

Nuovo `themedEnemyTeam(rng, area, nodeType, budget)` in `teamGen.ts`:
1. **`themeStrength` = `clamp(areaBase + area * areaStep) × nodeMult[nodeType]`** — CONTINUO, scala a N
   aree senza soglie hardcoded (vincolo utente: "in futuro potrei avere più aree"). `nodeMult`:
   normale < elite < boss. (Costanti in `BALANCE`, tarate in validazione.)
2. **Sceglie un TEMA** dalle sinergie esistenti (case/ruoli/tag-archetipo), pesato dal seed → varietà
   run-to-run. Il tema è realizzabile dalla finestra-budget (non scegliere un tema i cui maghi sono
   fuori budget).
   ⚠️ ROAST-FIX #2 (anti-ripetizione): il pool di temi è piccolo (4 case + pochi ruoli/tag), quindi
   senza precauzioni due nodi vicini potrebbero scegliere lo stesso tema → il giocatore vedrebbe ancora
   ripetizione DENTRO la run. Il generatore, scegliendo il tema di un nodo, **esclude (o depriorizza
   fortemente) il tema dei nodi adiacenti già generati** nella stessa area. `generateArea` genera i nodi
   in ordine e passa i temi-già-usati-recenti al picker. Garantisce varietà PERCEPITA, non solo statistica.
3. **Pesca i maghi che realizzano il tema**, garantendo abbastanza membri per attivare la/le sinergie
   secondo `themeStrength` (più forte → più membri del tema → tier sinergia più alto / più sinergie).
   Battaglie normali a bassa `themeStrength` → squadra mista, 0-1 sinergia.
4. La selezione DENTRO il tema usa **scelta pesata** (i più forti più probabili, non garantiti) → anche
   stesso tema, maghi diversi ogni volta. (Sostituisce il "sempre top-power" che causa la ripetizione.)

Mantiene il rispetto del budget (il tema è realizzato entro la finestra-budget, così la difficoltà resta
ancorata). Il boss finale scriptato (Voldemort, `BOSSES[0]`) NON passa da qui — resta il suo team fisso.

## Sezione 2 — Pre-generazione a build-time + il preview

In `generateArea` (map-build), per ogni nodo `battle`/`elite`/`boss`:
- Genera l'intero pacchetto-battaglia con `themedEnemyTeam` + selezione reliquie + livello, usando il
  fork RNG CANONICO (lo stesso `(seed, area, floor)` che `resolveCombat` usa oggi, anticipato a build-time).
- Salva nel nodo: `RunNode.battle?: { enemyTeam, enemyRelics, enemyLevel, bossSynergy? }` (Sez. decisione
  architetturale) + `RunNode.preview?: { synergyIds: string[]; bossName?: string }` (derivato da
  `detectSynergies(enemyTeam)` + le synergie delle reliquie + bossSynergy, per il telegrafo).
- Il resolver (`resolveCombat`) LEGGE `node.battle` interamente (squadra + relics + level + bossSynergy) e
  NON rigenera nulla. Fallback alla generazione SOLO se il nodo è legacy senza `battle` (save pre-feature).
- Nuovi campi su `RunNode` (types/run.ts): `battle?`, `preview?`. Serializzati nel save.
- ⚠️ Save size: il pacchetto include `Spell`/`Relic` objects. Se il save cresce troppo, forma compatta
  (`{ wizardId, stats, currentHp?, spellId }` + `relicId[]`) e ri-idratazione a load — DECISIONE in plan;
  per ora la forma piena va bene (è solo dati, una manciata di nodi per area).

## Sezione 3 — Telegrafo UI (icone sinergie sul nodo)

`MapScreen` riceve già i `RunNode[]`. Per ogni nodo di combattimento con `preview.synergyIds`:
- Sotto l'icona del nodo, piccole **badge delle sinergie nemiche** (riuso le icone/colori sinergia già
  esistenti in `SynergyRibbon`/`synergyTracker` — c'è già la resa visiva per sinergia).
- Boss: badge del tema + nome (`preview.bossName`).
- Nodo normale senza sinergie (0 badge) → l'assenza comunica "fight leggera".
- Niente nuovo sistema icone: mappare `synergyId → icona/colore` riusando ciò che esiste.

## Sezione 4 — Validazione

- **`themedEnemyTeam`** (`tests/engine/themedEnemyTeam.test.ts`): bassa `themeStrength` → squadra mista
  (0-1 sinergia); alta → tema coeso (≥2 sinergie attese); determinismo (stesso seed → squadra identica);
  varietà (seed diversi → squadre diverse — assert che l'identità dei maghi cambia, non solo gli stat).
- **`themeStrength` scala con l'area** (test: area maggiore → intensità ≥; nessuna soglia hardcoded;
  regge un'area inventata oltre le attuali 3).
- **COERENZA preview↔realtà** (il test che inchioda la decisione architetturale): per N nodi generati,
  `detectSynergies(node.enemyTeam)` == `node.preview.synergyIds`, E il resolver combatte ESATTAMENTE
  `node.enemyTeam` (non una squadra rigenerata). Questo test diventa banale PROPRIO perché c'è una sola
  fonte (il nodo) — ed è il punto.
- **Balance** (`campaignBalanceB`) — ⚠️ ROAST-FIX #3, RISCHIO PRIMARIO (non nota a piè di pagina):
  squadre a tema *coese* sono SOSTANZIALMENTE più forti di squadre miste a parità di budget — le sinergie
  aggiungono potenza gratis. Contro un giocatore che parte con 2 maghi, questo può spostare il winRate
  DRASTICAMENTE (non di un epsilon). La ri-taratura è la parte più rischiosa/lunga dello slice (in questa
  sessione le tarature multi-variabile hanno richiesto 30-45 min ciascuna). Strategia esplicita:
  1. Misurare il winRate DOPO aver attivato i temi (probabilmente molto sotto 0.15 — troppo duro).
  2. Abbassare `themeStrength` (specie il `nodeMult` delle normali → le normali quasi senza tema).
  3. Se ANCHE così non si riporta Grifondoro in [0.15, 0.45], FALLBACK ESPLICITO: le battaglie NORMALI
     non ricevono tema (squadra mista come oggi) — solo elite/boss sono a tema. Questo garantisce che la
     feature non renda il gioco ingiocabile, e i temi restano dove la leggibilità conta di più (le fight
     "importanti"). Documentare quale regime ha vinto.
- **UI**: il nodo mostra le badge corrette da `preview`; nodo senza sinergie → nessuna badge.
- Determinismo: il fork RNG per `themedEnemyTeam` è derivato come oggi (`seed, area, floor`) — nessun
  draw nuovo nel path di combattimento (la squadra è pre-fatta). Full suite verde + tsc.

## Rischi noti & leve

- **Save size** (la squadra nel nodo): se cresce troppo, forma compatta + ri-idratazione. Plan-time.
- **Difficoltà alzata** dalle sinergie: ri-tarare `themeStrength`/budget per restare in banda (atteso).
- **Tema irrealizzabile** (budget basso, nessun mago del tema in finestra): fallback a squadra mista
  (themeStrength effettivo 0) — mai crashare, mai un preview vuoto-ma-promesso.
- **Retro-compat save vecchi** (ROAST-FIX #4): un nodo senza `node.battle` → il resolver rigenera (path
  legacy). Nuovi run usano il nodo. Nessuna ROTTURA. ⚠️ MA: un save a metà-run salvato PRIMA della feature
  ha i nodi futuri senza `battle`/`preview` → in quella run il giocatore non vedrà il telegrafo e quelle
  fight saranno non-a-tema (incoerenza dentro la run, non un crash). Accettato: è una transizione una-tantum
  sui save esistenti; i nuovi run sono pienamente coerenti. Non vale la complessità di migrare i save vecchi.

## Non in scope (YAGNI)

- Boss scriptati per-area (oltre il Voldemort finale) — il tema-generato basta.
- Un sistema icone nuovo — riuso quello delle sinergie.
- Nemici con reliquie a tema (oltre quelle già date a elite/boss).

## Ordine di implementazione (per il plan)

1. Tipi: `RunNode.battle?: { enemyTeam; enemyRelics; enemyLevel; bossSynergy? }`, `RunNode.preview?: {
   synergyIds; bossName? }`.
2. `themedEnemyTeam` in teamGen.ts (themeStrength + scelta tema pesata + anti-ripetizione + realizzazione)
   + test (varietà, scala-area, anti-ripetizione).
3. `generateArea`: pre-genera l'INTERO pacchetto-battaglia (squadra + relics + level + bossSynergy) +
   preview su ogni nodo combat, col fork CANONICO + test coerenza preview↔realtà.
4. `resolveCombat`: legge `node.battle` interamente (fallback legacy se assente) — una sola fonte, niente
   rigenerazione di squadra/relics/menace.
5. UI: badge sinergie su `MapScreen` dai `preview`.
6. Balance (RISCHIO PRIMARIO): ri-tara `themeStrength`; se non in banda, fallback "normali senza tema".
   campaignBalanceB in [0.15,0.45]. Full suite + tsc.
7. Backlog doc.
