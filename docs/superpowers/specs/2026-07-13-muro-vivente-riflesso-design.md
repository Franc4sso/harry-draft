# Muro Vivente — Riflesso Scudo (redesign)

Data: 2026-07-13
Tipo: rework di un Duo esistente (tuning fast-follow, deciso 2026-07-10)

## Problema

Il Duo **Muro Vivente** (`scudirigen` + `taunt`) oggi fa: *"Finché il Tank che provoca ha
uno scudo, le tue retrovie non possono essere colpite."* — un **retarget duro** che forza
ogni attacco nemico sul Tank col muro (`game/engine/combat/targeting.ts:117-123`).

Questo effetto è **morto nel roster attuale**:
- L'iron taunt (`BALANCE.roles.tauntBonus = 1000`, `data/constants.ts:574`) già inchioda ogni
  nemico su un Tank vivo e non hard-controllato — il retarget non aggiunge nulla.
- Nessun nemico/boss ha `ignoresTaunt` (rimosso 2026-07-08, **pin utente**: nessun mago nemico
  può mai ignorare la provocazione del player). Quindi non esiste il caso in cui il retarget
  del muro serva a "riacchiappare" un nemico che scavalca il Tank.

## Vincolo di design

- **NON reintrodurre `ignoresTaunt`** (viola la decisione utente 2026-07-08). Il redesign deve
  dare al Duo un bonus **indipendente dal targeting**.
- Il Duo deve restare fedele alla sua identità: **Scudo (`scudirigen`) + Tank (`taunt`)**.

## Redesign: Riflesso Scudo

Il muro **riflette il 40% del danno che il suo scudo assorbe** sull'attaccante.

- **Solo lo scudo assorbito**, non il colpo intero → il riflesso si **auto-spegne** quando lo
  scudo del Tank finisce. Ricompensa lo scudo che c'è già; punisce i nemici che l'iron taunt
  costringe a picchiare il muro (sinergia gratuita con la provocazione, senza dipenderne).
- **Non letale**: il riflesso non può dare il colpo di grazia — lascia l'attaccante a **min 1 HP**.
  Nessuna morte fuori-turno → replay più semplice, nessuna cascata `onDeath`/Miasma dal riflesso.
- **Condizione = solo lo scudo** (non richiede taunt attivo): riflette finché il Tank col muro ha
  uno scudo con `absorbLeft > 0`, **anche se stordito/congelato**. Semplice, nessuna dipendenza
  dallo stato di provocazione.
- **Player-only per costruzione**: il flag `livingWall` è stampato solo sui Tank `left` (player)
  in `game/engine/duoEffects/stamp.ts:10`. Il target di un colpo con `livingWall` è quindi sempre
  il player (`side === 'left'`) e l'attaccante sempre un nemico (`side === 'right'`) → il riflesso
  colpisce sempre un nemico, **mai fuoco amico** (riuso della stessa invariante strutturale che
  regge già il vecchio effetto).

### Parametri (in `BALANCE`, non hardcoded)

```ts
// data/constants.ts, BALANCE.duos (nuovo blocco o esteso)
livingWall: { reflect: 0.4 }   // frazione del danno assorbito riflessa sull'attaccante
```

Leva di tuning: se al playtest è troppo forte/debole, si muove `reflect` senza toccare il motore.

## Implementazione

**Vincolo architetturale (verificato).** `resolveAction` (`resolve.ts`) ritorna **una sola**
`LogEntry` — non può emettere da solo la riga extra del riflesso. Come Untore/Miasma, la riga
dedicata la spinge il **chiamante in `simulate.ts`** (attorno a `simulate.ts:278`, subito dopo
`pushLog(entry)`). Ma l'importo assorbito (`dmg - residual`) si calcola **dentro** il damage
handler (`effects.ts`) e oggi non risale. Serve quindi far **risalire** il dato dal handler al sim.

Precedente da riusare: `ctx.duoIds` è un array locale creato in `resolveAction`, riempito dai
handler (`ctx.duoIds?.push(...)`) e travasato nella entry. Applica lo **stesso pattern** al
riflesso.

### 1. Damage handler stampa il riflesso su `ctx` — `game/engine/combat/effects.ts`

Estendi `EffectCtx` (`effects.ts:9`) con un canale d'uscita opzionale:

```ts
export interface EffectCtx { …; duoIds?: string[]; reflect?: { unitId: string; side: 'left'|'right'; amount: number } }
```

Nel branch `damage`, dopo `const residual = absorbDamage(ctx.target, dmg)` (`effects.ts:81`):

```ts
// MURO VIVENTE: il Tank col muro riflette una frazione del danno assorbito dal suo scudo
// sull'attaccante. absorbed = dmg - residual (quanto lo scudo ha mangiato). Non letale:
// lascia l'attaccante ad almeno 1 HP. livingWall è player-only (stamp.ts) → il target è sempre
// il player e l'actor sempre un nemico, mai fuoco amico.
if (lw && ctx.target.livingWall && ctx.target.side === 'left') {
  const absorbed = dmg - residual
  if (absorbed > 0 && ctx.actor.alive && ctx.actor.hp > 1) {
    const reflect = Math.min(ctx.actor.hp - 1, Math.round(absorbed * lw.reflect))
    if (reflect > 0) {
      ctx.actor.hp -= reflect
      ctx.reflect = { unitId: ctx.actor.wizard.id, side: ctx.actor.side, amount: reflect }
    }
  }
}
```

- `lw` = `BALANCE.duos.livingWall`, letto qui come gli altri Duo (`dm`/`ce` seguono lo stesso
  pattern in questo file — costanti in cima al modulo dal `BALANCE`).
- La sottrazione a `ctx.actor.hp` è locale nel handler; **l'emissione della riga di log + score**
  avviene nel sim (§2), non qui — coerente con recoil/cold-execute che lasciano log+score al sim.
- `ctx.reflect` opzionale: sui percorsi senza reflect (rider `onHit`, che non passano `reflect`)
  è un no-op sicuro — identico al caveat già documentato per `ctx.duoIds` (`effects.ts:99-106`).

### 2. `resolveAction` fa risalire il riflesso — `game/engine/combat/resolve.ts`

`ctx` è locale a `resolveAction` (`resolve.ts:30`). Aggancia `ctx.reflect` alla entry ritornata
come campo transiente, così il sim lo legge (stessa filosofia di `duoId`):

```ts
// resolve.ts, nel return finale (resolve.ts:43-47):
return {
  turn, actorId: actor.wizard.id, actorSide: actor.side, action: spell.name,
  targetId: entryTarget.wizard.id, targetSide: entryTarget.side, type: spell.type, value, flags,
  ...(duoIds[0] ? { duoId: duoIds[0] } : {}),
  ...(ctx.reflect ? { _reflect: ctx.reflect } : {}),   // transiente: il sim lo consuma, poi lo scarta
}
```

`_reflect` NON è persistito nel `RunLog` né serializzato: `simulate.ts` lo legge e lo rimuove
prima di `pushLog` (o lo tiene fuori dalla entry loggata). In alternativa, cambia la firma di
`resolveAction` per ritornare `{ entry, reflect }` — scelta implementativa lasciata al plan, purché
il riflesso risalga al sim **senza** finire in un campo persistito della LogEntry.

### 3. Riga di log dedicata (replay/anti-cheat) — `game/engine/combat/simulate.ts`

**Il punto delicato.** Il replay ricostruisce gli HP da `entry.value` keyed su `entry.targetId`
(`replay.ts:166`). Il riflesso colpisce l'**actor** (il nemico), non il target del colpo → serve
una **riga di log dedicata** puntata sull'attaccante, esattamente come Untore la emette a
`simulate.ts:300-304`. Subito dopo `pushLog(entry)` (`simulate.ts:279`):

```ts
const ref = entry._reflect   // o il valore ritornato da resolveAction, secondo la scelta del plan
if (ref) {
  const tankId = realTarget.wizard.id   // il Tank col muro È il target del colpo nemico
  pushLog({
    turn, actorId: tankId, actorSide: 'left', action: 'MuroVivente',
    targetId: ref.unitId, targetSide: ref.side,
    type: 'system', value: ref.amount, flags: ['duo'], duoId: 'muro-vivente',
  })
  // MVP: accredita il Tank col muro (come i tick veleno accreditano il poisoner, simulate.ts:381-383)
  const k = `left:${tankId}`
  score[k] = (score[k] ?? 0) + ref.amount
  sync(actor)   // `actor` è l'attaccante nemico che ha subito il riflesso
}
```

- **Il Tank col muro è `realTarget`** (il colpo nemico lo bersaglia); l'attaccante è `actor`. Quindi
  `actorId` della riga riflesso = `realTarget.wizard.id`, e il `sync` post-riflesso è su `actor`.
- Il loop generico del replay (`value>0 && targetId`) sottrae `value` dall'attaccante
  **automaticamente** → **zero modifiche a `replay.ts`**.
- **Non letale** garantito nel motore (min 1 HP) → l'attaccante non muore mai per il riflesso →
  nessun KO-log, nessuna cascata `onDeath`/Miasma dal riflesso (semplice + replay-safe).
- **Score MVP**: riuso del pattern `score[key] += value` cross-side dei tick veleno.

### 4. Rimozione del vecchio effetto — `game/engine/combat/targeting.ts`

Cancella il blocco `wall`-retarget morto:

```ts
// RIMUOVI (targeting.ts:117-123):
const wall = enemies.find(e => e.alive && e.livingWall && ...)
if (wall) return wall
```

- Il flag `livingWall` sul tipo (`types/combat.ts:74`) **resta** — ora significa "riflette lo scudo".
- Aggiorna il commento del tipo di conseguenza.

### 5. Copy — `data/duos.ts:16`

```ts
{ id: 'muro-vivente', name: 'Muro Vivente', signals: ['scudirigen', 'taunt'],
  desc: 'Finché il tuo Tank col muro ha uno scudo, riflette parte del danno assorbito sull’attaccante.' },
```

(Non più "il Tank che provoca" / "le retrovie non possono essere colpite": la nuova condizione è
solo-scudo e l'effetto è riflesso, non retarget.)

### 6. Leggibilità battle-log — renderer

Il renderer del battle-log deve dare alla riga `MuroVivente` una narrazione propria (come già fa
per MIASMA/UNTORE, commit `3921d90`), non *"‹Tank› lancia MuroVivente"*:

> *"Il muro di ‹Tank› riflette N su ‹nemico›."*

Il punto è `components/battle/BattleLog.tsx:60-62` (le righe `if (entry.action === 'Miasma')` /
`'Untore'`). Aggiungi accanto il caso:

```ts
if (entry.action === 'MuroVivente') return `Il muro di ${actor} riflette ${entry.value ?? 0} su ${target ?? 'un nemico'}`
```

## Test (TDD — motore prima della UI)

### `tests/engine/duoEffects/muroVivente.test.ts` (nuovo)
- **Riflesso 40%**: scudo assorbe 50 → attaccante subisce 20.
- **Solo l'assorbito**: parte oltre lo scudo (residual) NON riflette; scudo a 0 → riflesso 0.
- **Non letale**: attaccante a 5 HP, riflesso calcolato = 8 → attaccante resta a 1 HP.
- **Solo Tank col muro**: un Tank `left` senza `livingWall`, o un non-Tank, non riflette.
- **Anche stordito**: Tank col muro hard-controllato ma con scudo → riflette comunque.
- **Riga di log**: emessa con `action: 'MuroVivente'`, `duoId: 'muro-vivente'`, `flags: ['duo']`,
  `targetId` = attaccante, `value` = riflesso.
- **Score MVP**: il riflesso incrementa lo score del Tank col muro.

### `tests/engine/endlessReplayParity.test.ts` (esteso)
- Un seed con Muro Vivente attivo → **0 mismatch** tra sim e replay (la riga dedicata mantiene il
  replay sincronizzato senza toccare `replay.ts`).

### `tests/engine/duoStress.test.ts` (verifica)
- Il Duo non rompe il balance smoke (il bot non capisce i Duo → è un floor di sanità, non il gate).

## Balance

Il bot di bilanciamento **non capisce i Duo** → `campaignBalanceB` resta piatto e valido come proxy
(non va ri-ancorato per questo cambio). Il gate vero è `duoStress` + **playtest umano**. Se il
riflesso è troppo forte/debole, la leva è `BALANCE.duos.livingWall.reflect` (nessun cambio di motore).

## Fuori scope (deliberato)

- I 4 Duo fast-follow (Guscio Tossico, Preda Facile, Ara/Sacrificio, Catene) restano da fare, slice
  separata.
- Nessun cambio a iron taunt / `ignoresTaunt` (pin utente).
- Nessun redesign VFX oltre la riga di log.
