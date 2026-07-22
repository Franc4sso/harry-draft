# Spec — Leggibilità del combattimento (meter centrale a due modalità)

_Data: 2026-07-22 · Fase 2 della roadmap Core Fun · Tipo: PURA UI sul replay esistente — motore intatto_

Frase-cuore servita: **"guardo il mio veleno vincere la corsa contro la mia stessa mortalità"** — resa
visibile quando il veleno corre, senza lasciare muti i fight non-veleno.

---

## 1. Problema

Il combattimento è un replay che il giocatore **guarda passivamente**. Oggi la UI mostra HP, status-icon,
nomi — ma non racconta **chi sta vincendo** né **la corsa del veleno**. Il momento più importante del
Core Fun ("il mio DoT vince la corsa") non è leggibile.

## 2. Realtà del gioco (da analisi, vincola il design)

- **Fight corti:** normale 2-5 turni (~15s), elite ~5-12, boss ~10-18 (~90-120s). `fatigueStart:18` forza la fine.
- **Nemici:** 3 in normale/early, fino a 5 in elite/boss. `maxEnemies:5`. Player 3→5 maghi.
- **Veleno = build di minoranza:** in una run non-veleno NON c'è veleno sul campo. Anche puntandolo, solo ~1/3
  accende Tossicità. → un meter solo-veleno starebbe **spento nella maggioranza dei fight**.
- **Dramma universale = le MORTI / economia dei corpi.** I fight sono decisi da chi resta senza corpi. Una
  morte in un 3v3 è spesso l'intero fight. Il veleno è *pressione*, non un cronometro affidabile.
- **Pace:** frame lenti (kill/crit/duo ~2s) reggono una frase; frame veloci (tick/sistema ~600ms) reggono
  solo un dato a colpo d'occhio. **Niente paragrafi.**

## 3. Decisioni di design (approvate)

- **Dove:** lo slot `center` di `BattleArena`, già threaded da `BattleScreen`. NB: lo slot NON è vuoto —
  oggi `BattleScreen` vi monta `<ActionPanel entry={stickyEntry} units={...} />` (l'azione del turno:
  attaccante→incantesimo→bersaglio + risultato). **Il meter va SOPRA ActionPanel** nello stesso slot: uno
  stack verticale `[CenterMeter, ActionPanel]`. ActionPanel resta **invariato** (nessuna regressione); il
  meter è il layer di sintesi ("chi vince la corsa") sopra il layer d'azione ("cosa succede ora").
- **Forma:** un meter a **due modalità**.
  - **Economia (default, OGNI fight):** bilancia dei corpi vivi per lato, chi è in vantaggio, chi sta per cadere.
  - **Veleno (quando c'è veleno in corsa su un nemico vivo):** aggancia il più avvelenato → HP-che-scende
    vs veleno-che-sale + "tra ~N turni".
- **Focus veleno (ibrido):** se ≥1 nemico vivo ha veleno → il più avvelenato (a parità, HP più basso), resta
  agganciato finché vive o finché un altro lo supera; nessun veleno → modalità Economia.
- **Glanceable:** stato ricco solo sui beat lenti; sui frame veloci solo barre/numeri che si muovono.

## 4. Architettura — PURA UI, motore intatto

Rischio motore **ZERO**. Tutto deriva da `Replay` (`buildReplay`) e dal `ReplayFrame` corrente
(`useBattleReplay`). Il sim, il RunLog, la parità anti-cheat, i test di bilanciamento: **non toccati**.

### 4a. Dato disponibile per frame (reale, già esistente)
- `frame.hp[key]` (HP corrente), `unit.maxHp` (statico), `alive` derivato = `hp <= 0`.
- `frame.statusEffects[key]` → `ActiveEffect[]` con **`stacks`** per il veleno (`statusId:'veleno'`).
- `unit.corrotto`, `frame.entry` (actor/target/value/flags/`duoId`), `frame.cooldowns`, `frame.spd`.

### 4b. Derivazioni in UI (nessuna modifica motore)
- **Corpi vivi per lato** = conteggio unità con `hp > 0` per side, dal frame.
- **Vantaggio-azioni** = differenza corpi vivi (più corpi = più azioni/turno — la leva dominante del gioco).
- **"Sta per cadere"** = unità viva il cui HP scenderà a ≤0 nel prossimo colpo che la bersaglia; MVP-semplice:
  unità viva con HP sotto una soglia bassa (es. < 15% maxHp) → glow ☠. (Definizione esatta della soglia
  tarata sul componente reale.)
- **Danno-veleno-per-turno** sul nemico agganciato: la formula `4*stacks + min(stacks,8)*0.005*maxHp`
  come **stima** (marcata come tale, non verità del motore).
  - _Nota di implementazione (scelta consapevole, 2026-07-22):_ la spec iniziale preferiva leggere il
    **tick reale loggato** (`entry.value`) col fallback alla formula. In implementazione si è usata SOLO la
    formula. Motivo: velenoMult (reliquie, ≥1) e Cancrena (×2 sotto 40% HP) sono engine-side e **solo
    aumentano** il danno reale → la formula **sottostima sempre**, quindi "muore ~N turni" è un TETTO (la
    morte arriva a N o prima, mai dopo). Con la label "stima" e il `~`, è onesto per un aiuto a colpo
    d'occhio. Leggere il tick reale aggiungerebbe complessità (trovare il frame del prossimo tick di quel
    nemico) per zero guadagno visibile → non fatto (YAGNI). Confermato dalla review finale come Minor accettabile.
- **"Tra ~N turni"** = `ceil(HP_corrente / danno-veleno-per-turno)`; nasconderlo se il danno/turno è 0.

### 4c. Componente
- Nuovo componente presentazionale `components/battle/CenterMeter.tsx`. Riceve: il `ReplayFrame` corrente
  (per `hp` + `statusEffects`), `replay.units` (`ReplayUnit[]`, per `maxHp`/`side`/`id`), il player side
  (`'left'`). Pure, solo memo derivati.
- `BattleScreen` (riga ~171) cambia il prop `center` da `<ActionPanel .../>` a uno stack:
  `center={<div className="flex flex-col items-center gap-2 w-full"><CenterMeter frame={...} units={replay.units} playerSide="left" /><ActionPanel entry={stickyEntry} units={replay.units} /></div>}`.
- `BattleArena` **non cambia** (accetta già `center?: React.ReactNode`, riga 38). Il fallback `VS` interno
  resta per quando `center` è assente.
- **NON tocchiamo `UnitBust`** (denso, ~400 righe) né `ActionPanel` in questo progetto.

## 5. Cosa NON facciamo (YAGNI + fuori-scope tecnico)

- Nessuna modifica al motore, al `RunLog`, alla parità. Nessun ri-bilanciamento.
- **Marchio/dark-mark:** non è nel frame → fuori scope.
- **Mietitore come evento discreto:** solo il KO è loggato, il +ATK no → fuori scope.
- Nessuna decisione del giocatore in combat (quella è Fase 2.5 = agency, da valutare DOPO aver giocato questa).
- Nessuna modifica a `UnitBust`, `HpBar`, alla pacing di `useBattleReplay`.

## 6. Testing

- **Derivazioni (pure, unit-testabili):** funzioni pure che dato un `ReplayFrame` + `units` ritornano:
  corpi vivi per lato; il nemico agganciato (ibrido: più avvelenato vivo, senò target del frame); danno-veleno/turno
  (dal tick reale se presente, senò stima); turni-alla-morte. Test con frame sintetici.
- **Componente:** render del meter in modalità Economia (nessun veleno → mostra bilancia corpi) e in
  modalità Veleno (nemico con stacks → mostra barra veleno-vs-HP + turni). Asserire testid/dato, non pixel.
- **Regressione:** `BattleArena` con lo slot center popolato non rompe i test esistenti di BattleScreen/Arena;
  frame 0 mostra il fallback.
- **Nessuna** ri-esecuzione di parità/bilanciamento necessaria (il motore non cambia) — ma girare la suite
  completa per confermare zero rotture.

## 7. File toccati (previsti)

- Create: `components/battle/CenterMeter.tsx` (presentazionale).
- Create: `lib/combatReadout.ts` (o simile) — le derivazioni pure (corpi vivi, focus ibrido, veleno/turno, turni-alla-morte).
- Modify: `components/battle/BattleArena.tsx` — passare il meter allo slot `center`.
- Test: `tests/lib/combatReadout.*` (derivazioni), `tests/ui/centerMeter.*` (componente).

## 8. Rischi

- **Rumore / meter che salta:** mitigato dalla regola d'aggancio (resta sul più avvelenato finché vive).
  In modalità Economia il dato è stabile (conteggio corpi cambia solo su una morte — un beat lento).
- **Divergenza numerica dal motore:** mitigata leggendo il tick reale loggato invece di ricalcolare.
- **Bilanciamento:** ZERO. Pura UI.
- **Feel da validare in gioco:** questa fase è anche il test per decidere se serve la Fase 2.5 (agency).
  Dopo averla giocata, valutare se il combat leggibile è già abbastanza divertente o se manca la decisione.
