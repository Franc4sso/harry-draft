# Design — Effetti di controllo distinti + stat fisse

Data: 2026-06-26
Stato: approvato in brainstorming, in attesa di review utente

## Obiettivo

Due interventi indipendenti ma raggruppati:

1. **Differenziare la famiglia "controllo"** (stordito / congelato / silenziato /
   disarmato) che oggi al giocatore sembra fare la stessa cosa.
2. **Rendere fisse le statistiche** di ogni mago invece di tirarle a caso nel draft.

---

## Parte A — Effetti di controllo

### Stato attuale (codice)

`data/statuses.ts` definisce già quattro controlli con regole diverse, ma la
differenza è poco leggibile e in due casi (stun/freeze) quasi nulla:

| id | blocca | durata | dispellabile |
|----|--------|--------|--------------|
| `stun` | tutte le azioni | 1 | no |
| `freeze` | tutte le azioni | 2 | sì |
| `silence` | solo magie | 2 | sì |
| `disarm` | solo attacchi (danno→0) | 2 | sì |

Meccanica già funzionante ma invisibile:
- `selectSpell` (combat) ripiega su `base_attack` se l'unità non può lanciare
  magie → **silenziato** combatte solo con l'attacco base debole.
- `EFFECT_HANDLERS.damage` ritorna `value: 0` se `!canAttack(actor)` →
  **disarmato** non infligge danno ma può ancora curare/scudare/debuffare.
- `simulate.ts` logga **sempre** l'azione saltata come `'Stordito'` con flag
  `stun`, anche per un congelato → fonte principale della confusione percettiva.

### Identità target

| Effetto | Identità | Regola |
|---------|----------|--------|
| **Stordito** | colpo secco | blocca tutto, 1 turno, **non** dispellabile. Invariato. |
| **Congelato** | prigione fragile | blocca tutto, 2 turni, dispellabile, **si infrange al primo danno diretto**: il congelo termina e quel colpo infligge **+50%** danno. |
| **Silenziato** | bacchetta spezzata | niente magie 2 turni → attacco base debole. Invariato (solo leggibilità). |
| **Disarmato** | niente colpi | danno → 0 per 2 turni, utility ancora attiva. Invariato (solo leggibilità). |

### Cambi richiesti

1. **Shatter del congelo** (meccanica nuova) — in `EFFECT_HANDLERS.damage`
   (`game/engine/combat/effects.ts`): quando il bersaglio ha un effetto `freeze`
   attivo e il colpo è un danno diretto con `dmg > 0`:
   - moltiplica il danno per `freezeShatterMult` (= **1.5**) **prima**
     dell'assorbimento scudo;
   - rimuovi l'effetto `freeze` dal bersaglio (lo "rompe");
   - aggiungi un flag `'shatter'` per log/UI.
   - I **DoT** (`burn`, `fatica`) passano da `tickStatuses`, non dal damage
     handler: di proposito **non** infrangono il congelo (solo un colpo diretto
     rompe il ghiaccio).

2. **Costante** — `BALANCE.combat.freezeShatterMult = 1.5` in `data/constants.ts`.

3. **Log leggibile dell'azione saltata** — in `simulate.ts` (~riga 158): invece
   di loggare sempre `'Stordito'`, derivare nome/flag dall'effetto bloccante
   attivo a priorità più alta con `prevents` includente `action` (stun vs
   freeze). Helper in `game/engine/status.ts` (es. `blockingControl(unit)`).

4. **Glossario** (`lib/glossary.ts` → `EFFECT_META`) — blurb che spiegano
   l'identità, non il generico "salta il turno":
   - stun: "Salta il turno. Breve ma impossibile da rimuovere."
   - freeze: "Blocca le azioni più a lungo, ma si infrange (con danno extra) al primo colpo."
   - silence: "Niente magie: il bersaglio ripiega su un attacco base debole."
   - disarm: "Azzera i danni del bersaglio, che può ancora curare e difendere."

### Non in scope

- Rimappare quali magie applicano quali controlli.
- Nuovi controlli oltre ai quattro esistenti.

---

## Parte B — Stat fisse

### Stato attuale

`game/engine/statRoll.ts`:
- `rollStats(rng, wizard)` tira ogni stat nel range del mago con bias per tier
  (`BALANCE.draft.tierRollBias`).
- `pickSpell(rng, wizard)` pesca una magia dal pool.
- `draftWizard` combina i due.

### Target

- Stat **deterministiche** = punto medio del range: `round((lo + hi) / 2)` per
  hp/atk/def/spd. Nessun uso di rng per le stat.
- **La magia resta casuale** dal pool (`pickSpell` invariato): unica varietà
  residua tra due copie dello stesso mago.

### Cambi richiesti

1. `statRoll.ts`: sostituire `rollStats(rng, wizard)` con `fixedStats(wizard)`
   (niente rng) che ritorna i midpoint. `draftWizard` usa `fixedStats` +
   `pickSpell(rng, …)`.
2. `BALANCE.draft.tierRollBias` non serve più per le stat: rimuoverlo o lasciarlo
   inerte (il tier continua a guidare la *rarità* via `tierWeights`). Preferenza:
   rimuoverlo e ripulire i riferimenti.
3. `ranges` resta la fonte dei valori (da cui si calcola il midpoint): i dati dei
   60 maghi non cambiano.

### Conseguenze attese

- Lo stream rng del draft cambia (una `next()` in meno per stat) → a parità di
  seed il draft sarà diverso da prima. È un cambio di gameplay atteso, non un bug.
- Vale anche per i nemici/campagna (anch'essi via `draftWizard`): restano
  deterministici per seed, solo con stat fisse.

---

## Test

- **Da aggiornare**: i test che dipendono da esiti di battaglia specifici per
  seed o da snapshot "golden" cambieranno (rng shift + stat fisse). Rigenerare le
  aspettative dove serve.
- **Nuovi**:
  - `fixedStats` ritorna i midpoint attesi per un campione di maghi.
  - Congelo: un colpo diretto rimuove il `freeze` e infligge ×1.5; un DoT no.
  - Log azione saltata: stordito → "Stordito", congelato → "Congelato".
  - (Se non già coperti) silenziato ripiega su `base_attack`; disarmato → danno 0
    ma cura/scudo passano.

## Rischi

- Ampiezza dell'impatto sui test di combattimento (il punto più incerto): da
  misurare eseguendo la suite subito dopo i due cambi e correggendo le fixture.
- Bilanciamento: il midpoint è ~uguale alla media dei roll attuali, quindi
  l'impatto sul potere medio è minimo; lo shatter +50% va osservato in partita.
