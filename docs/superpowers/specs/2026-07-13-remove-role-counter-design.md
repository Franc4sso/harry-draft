# Rimozione del counter di ruolo (RPS ×1.25)

Data: 2026-07-13
Tipo: rimozione di meccanica (motore + UI + docs)

## Problema

Il gioco ha un ciclo counter di ruolo (rock-paper-scissors): ogni ruolo infligge **+25%**
danno (`matchupBonus = 0.25`) alla sua "preda":

- Tank → Attaccante
- Attaccante → Supporto
- Supporto → Controllo
- Controllo → Tank

**Il ciclo è metà morto in pratica**, per una decisione di design consolidata: il **Supporto
del player non attacca** (archetipi Guaritore/Scudiero/Stratega/Purificatore = zero attacchi
diretti, pool di ruolo puliti — vedi HANDOFF "Archetipi Supporto 2026-07-07"). Conseguenze:

- **Supporto → Controllo ×1.25**: non scatta MAI (il Supporto non fa danno diretto).
- **Attaccante → Supporto ×1.25**: scatta raramente (il Supporto sta nel backline, protetto dal
  taunt; l'Affondo lo raggiunge solo a volte).

Restano attive solo **Tank → Attaccante** e **Controllo → Tank**. Un moltiplicatore di danno che
funziona per metà del cast e mai per l'altra metà è uno **squilibrio nascosto e asimmetrico**, non
un sistema leggibile. Inoltre è applicato **in silenzio** (nessuna UI lo mostra), quindi il
giocatore non lo può nemmeno sfruttare consapevolmente.

**Decisione utente:** rimuoverlo del tutto — da motore E da UI. I ruoli si distinguono già per
**Provocazione (Tank) / Controllo (Ctrl) / Cura+Scudo (Sup) / Affondo+Penetrazione (Att)**; non
serve un moltiplicatore di danno mezzo-rotto.

## Ambito

**RIMUOVERE** (esclusivo del moltiplicatore):
- `data/constants.ts:575` — `matchupBonus: 0.25`
- `game/engine/combat/roleCounter.ts` — `ROLE_PREY` (`:6`) e `roleMult` (`:10-13`)
- `game/engine/combat/effects.ts` — import di `roleMult` (`:7`), applicazione `dmg *= roleMult(...)`
  (`:21`), commento relativo (`:19-20`)
- `lib/roleInfo.ts` — `rolePreyOf` (`:34`) e il re-export di `ROLE_PREY` (`:2`)
- `components/screens/MapScreen.tsx` — la label **"forte vs {ruolo}"** nell'hover elite (`:10,77`)
  → diventa falsa senza il bonus (decisione utente: rimuovere la label, non riscriverla)

**TENERE** (non c'entra col moltiplicatore — verificato):
- Tutto il resto di `roleCounter.ts`: `HARD_CONTROL_KINDS`, `isUnderHardControl`, `countHardControl`,
  `cleanseOneControl`, `applyTenaciaAura` (righe `:15-49`) e i loro test.
- Il **targeting di ruolo** intero (`game/engine/combat/targeting.ts`): affondo (`diveTarget`),
  backline, taunt filtrano per `role === …` direttamente, **non** via `roleMult`/`ROLE_PREY`.
- `BALANCE.roles`: `attackerArmorPen`, `tauntBonus`, `tenaciaControlDurationMult`.
- `lib/roleInfo.ts`: `ROLE_INFO`, `ROLE_VERB`, `ROLE_ACCENT` (i blurb NON menzionano il ciclo RPS).

## Impatto sui test

**Test DIRETTI del moltiplicatore → rimuovere:**
- `tests/engine/combat/roleCounter.test.ts:6-12` — solo il primo `it('roleMult is 1.25 vs prey…')`.
  Il resto del file (hard control, `:13-20`) **RESTA**.
- `tests/engine/combat/roleDamageMatrix.test.ts` — INTERO file (testa `dPrey/dNeutral ≈ 1.25`) →
  rimuovere il file.
- `tests/lib/roleInfo.test.ts:31-34` — `it('rolePreyOf returns the countered role')` → rimuovere
  (con l'import di `rolePreyOf` a `:3`).

**Test che ASSUMONO il ×1.25 → verificare che restino verdi (aspettative NON cambiano):**
- `tests/engine/combat/effects.test.ts` — le fixture di armor-pen (`:62-109`) usano
  DELIBERATAMENTE target `Controllo` per **neutralizzare** il matchup (già ×1.0), quindi le
  asserzioni numeriche non cambiano; vanno aggiornati solo i **commenti** (`:67-68,92-93,112-120`)
  che ora descrivono un sistema inesistente.

**Gate di bilanciamento → verificare, non ritarare:**
- `tests/engine/campaignBalanceB.test.ts` è il gate winRate primario (headroom stretto, nota "1
  seed"). Il bot NON capisce i counter, quindi la winRate si muove al margine. Va **rimisurata**
  dopo la rimozione; se resta nella banda, nessun re-tuning. Se sfora, è un segnale reale (ma
  improbabile visto che il bonus era mezzo-inattivo).

## Docs da aggiornare

- `docs/superpowers/specs/2026-07-05-role-counters-design.md` — marcare come **superata** da questa
  spec (header di deprecazione in cima).
- `docs/superpowers/HANDOFF.md` — le righe che descrivono "Matrice danni ×1.25 vs preda" e "Controllo
  +25% vs Tank" (`:271,280`) vanno aggiornate: il counter di danno è stato rimosso.

## Fuori scope

- La **leggibilità della battaglia** (perché quel bersaglio / ritmo / ordine turni) è un filone
  separato, in design a parte — questa slice la precede (rende il motore coerente prima di
  costruirci sopra la leggibilità).
- Nessun cambio ai lever di bilanciamento (`campaignB`): si verifica soltanto che la winRate resti
  in banda.
