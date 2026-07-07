# Provocazione vera — design

Data: 2026-07-07. Stato: approvato (brainstorming). Copy in italiano.

## Problema

La Provocazione del Tank oggi è rispettata **solo dall'Attaccante nemico**. Verificato
in `game/engine/combat/targeting.ts`:
- **Attaccante** (`case 'Attaccante'`): se un Tank nemico provoca → `highestThreat` (che
  aggiunge `tauntBonus=1000` al Tank) → lo colpisce. ✅
- **Tank** (`case 'Tank'`): `lowestHp(enemyPool)` → colpisce il più debole, ignora il taunt. ❌
- **Controllo** (`case 'Controllo'`): `backlineTarget` → ignora SEMPRE il Tank (escape valve
  passiva). ❌
- **Supporto** con spell offensiva: `highestThreat` (rispetta) o `backlineTarget` per un
  controllo; il default protegge alleati (non attacca).

Riproduzione (full sim, Tank ron + carry harry vs draco+goyle): ron prende 17/20 colpi — il
taunt "tecnicamente" tira, ma solo perché draco è Attaccante. Con un mix di ruoli nemici la
provocazione si sfalda. **"Provocazione" che vincola solo una classe non è una provocazione.**

## Obiettivo

Rendere la Provocazione una vera provocazione: **ogni unità nemica che sta per ATTACCARE**
(fare danno o applicare un effetto su un nemico) deve puntare il Tank che provoca, FINCHÉ il
Tank non è hard-controllato. L'unico "scavalco" è **attivo**: il **Controllo** deve LAVORARE
per liberare il team, cioè hard-controllare il Tank (stun/freeze/silence) — cosa che spegne
la provocazione (regola globale già esistente).

## Vincoli globali

- Copy in italiano. Push su master senza chiedere quando finito.
- Solo logica di targeting (`targeting.ts`) — nessun nuovo stato di motore, nessun nuovo status.
- La regola "Tank sotto hard-control perde la Provocazione" ESISTE già (`threatScore` via
  `isUnderHardControl`) — riusarla, non duplicarla.
- Il ciclo RPS (Tank→Att→Sup→Ctrl→Tank) deve restare intatto: il Controllo resta il counter del
  Tank, ma **attivo** (deve stordirlo) invece che passivo (lo ignorava gratis).
- Il bot di bilanciamento non capisce i counter → rimisurare `campaignBalanceB` +
  `campaignBalanceRestricted` dopo il cambio; i winRate sono smoke check.

## Comportamento per ruolo (quando un Tank nemico provoca e NON è hard-controllato)

| Ruolo attaccante nemico | Oggi | Nuovo |
|---|---|---|
| **Attaccante** | rispetta (highestThreat) | invariato — punta il Tank |
| **Tank** | lowestHp (ignora) | **punta il Tank** (highestThreat sul pool nemico) |
| **Supporto** con spell offensiva | highestThreat / backline | **punta il Tank** |
| **Controllo** | backlineTarget (ignora sempre) | **punta il Tank per stordirlo** (vedi sotto) |
| **Supporto/curatore** (spell Cura/Difesa) | protegge alleati | invariato — resta sui suoi alleati |

Quando il Tank provocante È hard-controllato (o non c'è Tank): tutti tornano al loro targeting
naturale (Attaccante→Affondo/dive, Controllo→backline, Tank→lowestHp, ecc.).

### Controllo: lo scavalco attivo
Oggi `case 'Controllo'` → `backlineTarget` (ignora il Tank sempre). Nuovo:
- Se esiste un Tank nemico che provoca e non è ancora hard-controllato → il Controllo **punta
  quel Tank** (per applicargli il suo controllo e spegnere la provocazione). Usa
  `highestThreat(enemyPool)` come gli altri (il Tank domina per il tauntBonus).
- Se il Tank provocante è già hard-controllato, o non c'è un Tank che provoca → **backlineTarget**
  come oggi (il Controllo torna a scavalcare verso il backline).

Semantica: il Controllo counterizza il Tank stordendolo, non ignorandolo. Una volta stordito, la
provocazione cade (regola globale) e TUTTI (Controllo incluso) sono liberi sul backline.

Nota: non distinguiamo se la spell del Controllo è hard o soft. Il Controllo punta comunque il
Tank finché provoca; se la sua spell è un hard-control lo spegne (e il turno dopo tutti liberi),
se è soft continuerà a puntarlo finché qualcuno (o lui stesso con un'altra magia) lo stordisce.
Semplice e coerente — YAGNI sul ramo soft-vs-hard.

## Architettura / implementazione

Un solo file: `game/engine/combat/targeting.ts`, funzione `selectTarget`.
- Introdurre un helper `activeTauntTank(enemies)`: ritorna il Tank nemico vivo che provoca e
  NON è hard-controllato (usa `isUnderHardControl` da roleCounter). Ce n'è al più uno che conta
  (se più Tank provocano, `highestThreat` sceglie comunque quello giusto — l'helper serve solo
  come gate booleano "c'è un taunt attivo?").
- `case 'Tank'`: se `activeTauntTank(enemyPool)` → `highestThreat(enemyPool, ign)`; altrimenti
  `lowestHp(enemyPool)` (comportamento attuale).
- `case 'Controllo'`: se `activeTauntTank(enemyPool)` → `highestThreat(enemyPool)`; altrimenti
  `backlineTarget(enemyPool)` (comportamento attuale).
- `case 'Supporto'` (ramo offensivo): se `activeTauntTank(enemyPool)` → `highestThreat(enemyPool)`;
  altrimenti il comportamento attuale (backline per controllo, highestThreat per attacco).
- `case 'Attaccante'`: invariato (già rispetta il taunt; l'`ignoresTaunt` di Bellatrix resta).
- `ignoresTaunt` (Bellatrix): un attore con `ignoresTaunt` NON è vincolato — salta sempre il gate
  (già gestito per l'Attaccante; estendere il gate a tutti i ruoli usando `actor.ignoresTaunt`).

## Data flow
`selectTarget(actor, allies, enemies, spell)` → gate `activeTauntTank(enemies)` per ruolo →
bersaglio. Nessun cambio a resolve/effects/simulate. Deterministico.

## Testing
1. `tests/engine/combat/targeting.test.ts` — estendere:
   - Un **Tank** nemico attaccante, con un Tank avversario che provoca → punta il Tank (non lowestHp).
   - Un **Controllo** con un Tank che provoca (non ancora controllato) → punta il Tank (non backline).
   - Un **Controllo** con Tank provocante GIÀ hard-controllato → torna a backlineTarget.
   - Un **Supporto offensivo** con Tank che provoca → punta il Tank.
   - `ignoresTaunt` (Bellatrix) → salta il gate per OGNI ruolo, non solo Attaccante.
2. `globalRuleTaunt.test.ts` — resta verde (Tank stordito perde tauntBonus; ora significa anche
   che il Controllo/Tank/Supporto tornano liberi).
3. Full sim: con team misto nemico e un Tank player che provoca, la maggioranza schiacciante dei
   colpi va sul Tank finché non è stordito.
4. Regressione completa + `tsc` + rimisura `campaignBalanceB`/`campaignBalanceRestricted`
   (registrare i numeri; il Tank ora tira più fuoco → potrebbe muovere il balance).

## Rischi
- Il Controllo che punta il Tank (invece del backline) cambia il feeling del counter: ora deve
  "spendere" un turno sul Tank. Voluto (provocazione vera), ma se al playtest il Controllo diventa
  troppo debole vs Tank, la leva è ripristinare parte dello scavalco passivo — non toccare il
  tauntBonus.
- Balance: il Tank che assorbe più fuoco rende le squadre col Tank più tanky (player E nemico).
  Rimisurare; se `campaignBalanceB` scende sotto ~0.20, valutare (ma "più difficile" è approvato).

## Fuori scope (YAGNI)
- Distinzione soft-vs-hard control nel ramo Controllo (il Controllo punta il Tank comunque).
- Provocazione multi-Tank pesata (highestThreat già risolve).
- Nessun cambio al tauntBonus, alle passive di ruolo, o al ciclo RPS.
