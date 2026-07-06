# Supporto: identità distinta per archetipi — design

Data: 2026-07-06. Stato: approvato (brainstorming). Copy in italiano.

## Problema

I 20 maghi Supporto oggi sono quasi intercambiabili: quasi tutti pescano
`episkey` + `protego` + un revive dallo stesso pool ristretto. Non c'è identità:
un Supporto vale l'altro. Inoltre `serpensortia` (attacco-veleno) è finito nel
pool di 4 Supporto (narcissa, slughorn, sprout, astoria) — un attacco offensivo
diretto rompe l'identità del ruolo "supporta, non fa danno".

Censimento reale dei pool per ruolo (da `data/wizards.ts`, 2026-07-06):
- **Controllo** (13): confringo, confundo, crucio, fiendfyre, flipendo, imperio, langlock, levicorpus, oppugno, petrificus, reducto, **serpensortia**, tarantallegra
- **Attaccante** (16): avada, bombarda, confringo, confundo, crucio, diffindo, expelliarmus, fiendfyre, flipendo, incendio, levicorpus, oppugno, reducto, sectumsempra, **serpensortia**, stupeficium
- **Tank** (12): bombarda, diffindo, expelliarmus, fianto, flipendo, oppugno, protego, protego_maxima, reducto, salvio, **serpensortia**, stupeficium
- **Supporto** (13): anapneo, colletivo_scudo, episkey, expecto, ferula, fianto, incitamento, protego, rennervate, riddikulus, salvio, **serpensortia**, vulnera

`serpensortia` è leaked in TUTTI i ruoli — sintomo di pool non vincolati.

## Obiettivo

Dare a ogni Supporto un'**identità distinta** usando **solo effetti già nel
motore** (zero nuovo engine), pulire i pool per ruolo con una **whitelist
strutturale** su tutti i ruoli, e rifinire i **VFX per singola magia**.

## Vincoli globali

- Copy in italiano. Push su master senza chiedere quando finito.
- MAX 5 nemici (invariato). Recruit rari (invariato).
- Solo dati/pool + whitelist + VFX. NESSUN nuovo effetto di motore (heal/shield/
  buff/cleanse/debuff/revive/regen/ward già esistono).
- Il bot di bilanciamento non capisce i counter → i winRate sono smoke check;
  rimisurare `campaignBalanceB` e `campaignBalanceRestricted` dopo il cambio
  (memoria: veleno/enemy-power li muovono).
- I joker restano player-only; i pool nemici pescano dagli stessi ruoli → i
  nemici Supporto devono restare coerenti col nuovo kit.

## Architettura

### A. Quattro archetipi Supporto

Ogni Supporto è assegnato a UN archetipo. Il suo `spellPool` pesca solo dalle
magie di quell'archetipo (più una base minima condivisa). Tutte le magie
elencate ESISTONO già in `data/spells.ts`.

| Archetipo | Identità | Magie (esistenti) |
|---|---|---|
| **Guaritore** | cura pesante, rianima, cura-nel-tempo | episkey, vulnera, rennervate, anapneo, ferula |
| **Scudiero** | scudi e ward, difesa di squadra | protego, protego_maxima, fianto, colletivo_scudo, aegis, expecto |
| **Stratega** | buffa l'offensiva/agilità alleata | incitamento, riddikulus, salvio |
| **Purificatore** | anti-controllo + sostegno leggero | ferula, anapneo, salvio, episkey (+ passive di ruolo Purificazione già esistente) |

Note di assegnazione:
- `salvio` (spdUp) e `riddikulus` (atkUp) sono buff self → Stratega/Purificatore.
- `expecto`/`aegis` sono difesa forte → Scudiero.
- Il Purificatore non ha una magia "cleanse" dedicata (il cleanse è la passive di
  ruolo `Purificazione`, applicata automaticamente ogni turno da un Supporto che
  può agire); il suo kit lo tiene vivo e utile mentre la passive lavora.

Assegnazione dei 20 Supporto ai 4 archetipi: definita in fase di piano leggendo
ogni mago (casa/tier/lore) — es. Lupin/Molly/Lavender → Guaritore; Pettigrew/
Susan/Hannah → Scudiero; Luna/Arthur → Stratega; Marietta/Penelope → Purificatore.
Distribuzione target ~bilanciata (nessun archetipo con 1 solo mago).

### B. Whitelist per ruolo (tutti i ruoli)

Nuovo file `lib/roleSpellPools.ts`: per ogni ruolo (Tank/Attaccante/Supporto/
Controllo) una whitelist esplicita degli `spellId` ammessi. Regola:
- **Supporto = zero attacchi diretti**: nessun spell `type: 'Attacco'` o
  `type: 'Controllo'` offensivo. Rimosso `serpensortia` da tutti i Supporto.
- Gli altri ruoli: la whitelist codifica i pool attuali PULITI (togliendo gli
  outlier evidenti come `serpensortia` dove non ha senso — decisione per-ruolo
  in fase di piano, conservativa: non stravolgere Attaccante/Controllo, solo
  rimuovere ciò che è palesemente fuori posto).

Test nuovo `tests/data/roleSpellPools.test.ts`: per OGNI mago, ogni spell del suo
`spellPool` deve essere nella whitelist del suo ruolo. Fallisce se un mago ha una
magia fuori ruolo → previene ricadute future. È il guard strutturale.

Sicurezza tecnica (verificata): un Supporto senza attacchi non resta mai bloccato.
Ogni mago porta UNA spell in battaglia (`unit.spell`); il turn-loop
(`simulate.ts`) per un intento di cura sceglie il più ferito o cura sé stesso
(`?? actor`) — quindi un Supporto ha sempre un'azione valida.

**Vincolo anti-turno-morto (da una riserva sciolta in review).** Verificato: una
magia di pura cura (`mostWounded` filtra i full-HP) senza alleati feriti degenera
in una cura di sé stesso al cap — un turno sprecato. Quindi ogni pool-archetipo
Supporto DEVE contenere ≥1 magia **proattiva** (con effetto anche a squadra piena):
- Scudiero → protego/fianto/aegis pre-scudano (utili sempre).
- Stratega → incitamento/riddikulus/salvio pre-buffano (utili sempre).
- Purificatore → salvio/ferula (spdUp / regen preventivo).
- Guaritore → il suo pool include `ferula` (regen preventivo) come opzione non-morta;
  è l'archetipo più reattivo per natura, ma non deve avere SOLO cure istantanee.
Un test asserisce che ogni archetipo Supporto ha almeno una magia con effetto a
squadra piena (buff/shield/ward/regen), così nessun Supporto ha turni morti garantiti.

**RPS confermato intatto (riserva sciolta).** Il counter Supporto→Controllo NON
dipende dal danno: si regge su **Tenacia** (aura anti-controllo, passiva) +
**Purificazione** (cleanse hard-control, passiva). Il `roleMult` ×1.25 vs la preda
è un bonus secondario che un Supporto senza attacchi semplicemente non usa —
nessuna rottura. Anzi, il design RIMUOVE un workaround esistente in `selectTarget`
(il ramo "se un Supporto ha una spell offensiva, miralo al nemico"), rendendo il
ruolo più pulito.

### C. VFX per singola magia

Le VFX per-magia esistono già in `lib/vfx/spellVfx.ts` (mappa
`nome-magia → SpellVfxConfig` con `impact` bespoke: heal, revive, bubbles,
bandage, buff, rally, hex, wall, wind, patronus, absorb). Per ogni magia di
supporto del nuovo kit:
- Verificare che abbia una entry dedicata e tunata per il suo archetipo:
  - Guaritore → verde organico (`C.heal`, impact `heal`/`revive`/`bandage`/`bubbles`)
  - Scudiero → cupola/parete azzurra (`C.shield`, impact `hex`/`wall`/`absorb`)
  - Stratega → runa dorata sull'alleato buffato (`C.gold`, impact `rally`)
  - Purificatore → flash bianco-argento che "pulisce" (nuovo impact `cleanse` se
    serve distinzione; altrimenti `wind`/`hex`)
- Aggiungere `impact` NUOVI solo dove un archetipo non ha un look distinto
  (candidato unico: `cleanse` per il Purificatore). Ogni nuovo impact va
  implementato in `lib/vfx/choreograph.ts` seguendo il pattern degli esistenti.

`serpensortia` resta nel VFX map (lo usano ancora Attaccante/Controllo) — si
rimuove solo dai POOL Supporto, non dalla libreria VFX.

## Data flow

Draft → `spellPool` (vincolato dalla whitelist) → il mago porta 1 spell →
`simulate.ts` la lancia → log entry → `spellVfxFor(action)` → Pixi VFX per-magia.
Nessun cambio al flusso; cambiano solo i DATI (pool) + la whitelist + le entry VFX.

## Testing

1. `tests/data/roleSpellPools.test.ts` — ogni spell di ogni mago ∈ whitelist del
   suo ruolo (guard strutturale, tutti i ruoli).
2. Test dedicato: nessun Supporto ha una spell `type: 'Attacco'`/offensiva
   (asserzione esplicita "Supporto = zero attacchi diretti", incl. no serpensortia).
3. Test archetipo: ogni Supporto è mappato a un archetipo e il suo pool ⊆ magie
   dell'archetipo + base.
3b. Test anti-turno-morto: ogni archetipo Supporto ha ≥1 magia proattiva (con
   effetto a squadra piena: buff/shield/ward/regen) — nessun turno morto garantito.
3c. Cleanup: rimuovere il ramo `spell.type === 'Attacco' || 'Controllo'` in
   `selectTarget` per il Supporto (diventa codice morto una volta che nessun
   Supporto porta spell offensive) — con test che nessun Supporto le porta.
4. VFX: ogni spell di supporto del nuovo kit ha una entry in `spellVfxFor` (nessun
   fallback generico per le magie di supporto).
5. Regressione completa (1188 test) + `tsc`.
6. Bilanciamento: rimisurare `campaignBalanceB` + `campaignBalanceRestricted`
   (devono restare sopra il floor `winRate>0`); se scendono, la leva è la forza
   dei buff/heal, non la struttura degli archetipi.

## Fuori scope (YAGNI)

- Nessun nuovo effetto di motore (cura-a-catena, aura persistente, redirect danni).
- Nessun ridisegno delle passive di ruolo (Tenacia/Purificazione restano).
- Nessun ribilanciamento profondo di Attaccante/Controllo (solo rimozione outlier).

## Rischi

- La rimozione di `serpensortia` dai Supporto toglie una fonte di veleno →
  `campaignBalance*` potrebbe muoversi (veleno era una leva). Mitigazione: i
  Supporto non erano poison-build principali; rimisurare e, se serve, aggiustare
  la forza dei buff/heal (non reintrodurre serpensortia).
- Whitelist troppo stretta su Attaccante/Controllo potrebbe rompere pool esistenti
  → approccio conservativo: la whitelist parte dai pool ATTUALI puliti, non da zero.
