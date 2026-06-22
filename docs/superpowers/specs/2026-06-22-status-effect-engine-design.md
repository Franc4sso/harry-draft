# Status & Effect Engine — Design Spec

**Data:** 2026-06-22
**Tipo:** Estensione architetturale del combat engine di `harry-draft`.
**Riferimento:** estende `2026-06-22-harry-draft-design.md` e il documento "Estensione del progetto – Miglioramenti architetturali e di game design".

---

## 1. Obiettivo

Trasformare la risoluzione del combattimento da **logica hardcoded `if/else`** a un **motore che interpreta i dati**, introducendo:

1. Un **registry di Status data-driven** (`data/statuses.ts`): aggiungere un nuovo status (es. "Congelamento") = una riga di dati, **zero modifiche all'engine**.
2. Un **modello di Effetti canonico** (`EffectSpec[]`) interpretato da un registry di handler puri, che rimpiazza lo `switch (spell.type)` in `resolve.ts`.
3. Status con il ciclo di vita ricco richiesto dal documento: **durata, stackabilità, priorità, modalità di rimozione, sorgente**.

**Vincolo non negoziabile:** i **154 test esistenti restano verdi**. Il comportamento osservabile (danni, cure, log, vincitore, determinismo dal seed) non cambia per i contenuti esistenti.

**Fuori scope (volutamente, YAGNI):**
- Pipeline esplicita (RoundManager/TurnManager/…) → spec separato successivo.
- `cost`/economia di risorse (niente mana nel gioco) → non costruito.
- Reorg cartelle `data/` granulare, loot, eventi, log per LLM → spec separati.

---

## 2. Stato attuale (punto di partenza)

- Engine puro in `game/engine/*`, RNG iniettato (`rng.ts`, mulberry32), `BALANCE` centralizzato.
- `resolve.ts` risolve via `switch (spell.type)` su `'Attacco'|'Difesa'|'Cura'|'Controllo'` con `if/else` sugli effetti.
- `ActiveEffect` minimale: `{ kind:'buff'|'debuff'|'dot'|'stun'; stat?; amount?; remaining }`.
- `tickStatuses` gestisce dot + cooldown; `effectiveStats` somma buff/debuff.
- 60 maghi, 32 incantesimi, 14 sinergie. Typecheck pulito, **154 test passano**.
- **La UI non legge mai `statusEffects`** → blast radius confinato all'engine.

---

## 3. Approccio scelto

**Registry data-driven + superset di compatibilità.**

Achievabile il goal "il motore interpreta i dati" mantenendo la rete di sicurezza dei test:
- Nuovi status/spell autorabili come dati dichiarativi.
- Spell legacy convertiti a runtime da un adapter puro → nessuna riscrittura dei dati esistenti.
- `ActiveEffect` esteso come **superset**: campi vecchi invariati, nuovi opzionali.

Alternative scartate: rewrite pulito (rompe i test, alto rischio), inline minimale (aggiunge `if/else`, contro la filosofia).

---

## 4. Componenti

### 4.1 `data/statuses.ts` — registry `StatusDef` (NUOVO, solo dati)

```ts
export type StatusKind =
  | 'buff' | 'debuff' | 'dot' | 'stun'        // legacy (retro-compat)
  | 'freeze' | 'silence' | 'disarm' | 'regen' | 'shield'  // nuovi

export interface StatusDef {
  id: string                       // 'burn','stun','silence','shield','atkUp','slow'...
  name: string                     // 'Bruciatura' — per log/UI
  family: 'control' | 'dot' | 'regen' | 'shield' | 'buff' | 'debuff'
  prevents?: ('action' | 'spell' | 'attack')[]  // stun→action, silence→spell, disarm→attack
  statMod?: { stat: Stat; amount: number; pct?: boolean }  // buff/debuff
  tickDamage?: number              // dot per turno
  tickHeal?: number                // regen per turno
  absorb?: number                  // pool scudo iniziale
  defaultDuration: number
  stack: 'ignore' | 'refresh' | 'extend' | 'stack'
  maxStacks?: number
  priority: number                 // ordine di risoluzione statMod (asc)
  removable: boolean               // per future cleanse
}

export const STATUS_DEFS: Record<string, StatusDef>
export const STATUS_BY_ID: Record<string, StatusDef>  // alias/lookup
```

**Set iniziale (copre ogni `family`):**

| id | name | family | effetto chiave |
|----|------|--------|----------------|
| `stun` | Stordito | control | `prevents:['action']`, stack `refresh` |
| `freeze` | Congelamento | control | `prevents:['action']`, removable |
| `silence` | Silenziato | control | `prevents:['spell']` → fallback colpo base |
| `disarm` | Disarmato | control | `prevents:['attack']` |
| `burn` | Bruciatura | dot | `tickDamage`, stack `stack` (maxStacks) |
| `regen` | Rigenerazione | regen | `tickHeal` |
| `shield` | Scudo | shield | `absorb` assorbe danno prima degli HP |
| `atkUp` | Forza | buff | `statMod{atk,+,pct?}` |
| `defUp` | Difesa | buff | `statMod{def,+}` |
| `slow` | Lentezza | debuff | `statMod{spd,-}` |

### 4.2 Modello effetti + adapter

`types/spell.ts` aggiunge campi opzionali (retro-compat):

```ts
export type EffectSpec =
  | { kind:'damage'; power:number; canCrit?:boolean; canDodge?:boolean }
  | { kind:'heal'; amount:number }
  | { kind:'shield'; statusId?:string; amount:number; duration?:number }
  | { kind:'applyStatus'; statusId:string; target:'enemy'|'self'|'ally'; duration?:number; chance?:number }

export interface Spell {
  // ...campi esistenti invariati...
  effects?: SpellEffect[]   // legacy, invariato
  spec?: EffectSpec[]       // NUOVO opzionale: autoring dichiarativo ricco
  target?: 'enemy'|'self'|'ally'   // NUOVO opzionale (usato da targeting in futuro)
  priority?: number                // NUOVO opzionale
}
```

`game/engine/combat/normalizeSpell.ts` (NUOVO, puro):
`normalizeSpell(spell): EffectSpec[]` →
- se `spell.spec` presente, ritorna quello;
- altrimenti deriva da legacy: `Cura`→`heal`; `Attacco`/`Controllo` con `power>0`→`damage`; ogni `SpellEffect`→`applyStatus` con `statusId` mappato (`dot`→`burn`, `stun`→`stun`, `buff`/`debuff`→status sintetico inline che porta `statMod`); `Difesa`→`applyStatus` su self.

Garanzia: per i 32 spell esistenti, l'output produce **comportamento e log identici** a oggi.

### 4.3 `game/engine/combat/effects.ts` — interpreter (NUOVO)

```ts
type EffectCtx = { rng:Rng; turn:number; actor:BattleUnit; target:BattleUnit; flags:LogFlag[] }
type EffectHandler = (ctx:EffectCtx, eff:EffectSpec) => number | undefined  // ritorna value per il log

export const EFFECT_HANDLERS: Record<EffectSpec['kind'], EffectHandler>
```

`resolveAction` diventa: normalizza lo spell → cicla `EffectSpec[]` → dispatch su `EFFECT_HANDLERS[eff.kind]`. Nessun `switch (spell.type)`. Nuovo `kind` = nuova entry nel registry, loop invariato.

### 4.4 `game/engine/status.ts` — logica status pura (NUOVO)

- `applyStatus(unit, statusId, opts)`: crea/aggiorna `ActiveEffect` rispettando `stack` (`ignore`/`refresh`/`extend`/`stack`) e `maxStacks`; popola `statusId`, `sourceId`, `absorbLeft` (per shield), `remaining`.
- `effectiveStats(unit)`: applica gli `statMod` degli status attivi **in ordine di `priority`** (flat poi pct), via `STATUS_BY_ID`. Mantiene compatibilità con i legacy `{kind:'buff'/'debuff',stat,amount}`.
- `tickStatuses(unit)`: applica `tickDamage`/`tickHeal`, decrementa `remaining`, rimuove scaduti; genera `LogEntry` (es. 'Bruciatura'). Generalizza l'attuale dot/regen.
- `absorbDamage(unit, dmg)`: scala `absorbLeft` degli status `shield` prima degli HP; ritorna danno residuo.
- `canAct(unit)` / `canCastSpell(unit)` / `canAttack(unit)`: leggono `prevents` dei def attivi.

`effectiveStats` e `tickStatuses` vengono **spostate** qui da `resolve.ts` (re-export da `resolve.ts` per non rompere gli import dei test).

### 4.5 Modifiche a moduli esistenti

- `resolve.ts`: usa `normalizeSpell` + `EFFECT_HANDLERS`; danno passa da `absorbDamage`; re-export di `effectiveStats`/`tickStatuses` da `status.ts`.
- `selectSpell.ts`: se `!canCastSpell(unit)` (silence) → colpo base; rispetta cooldown come oggi.
- `simulate.ts`: il check stun diventa `!canAct(unit)` (copre stun+freeze); resto invariato.
- `types/combat.ts`: `ActiveEffect` esteso a superset (vedi §5).

---

## 5. Retro-compatibilità — `ActiveEffect` superset

```ts
export interface ActiveEffect {
  kind: StatusKind          // union allargata; membri vecchi ancora validi
  stat?: Stat               // invariato
  amount?: number           // invariato
  remaining: number         // invariato
  // NUOVI, opzionali:
  statusId?: string         // collega al StatusDef
  stacks?: number
  sourceId?: string         // "side:id" di chi ha applicato
  absorbLeft?: number       // pool scudo residuo
}
```

Gli effetti inline legacy (`{kind:'dot',amount,remaining}`) continuano a funzionare accanto a quelli def-driven. Debito tecnico accettato e circoscritto: i **nuovi** status passano solo da `statusId`; i campi legacy restano finché li usano i test esistenti.

---

## 6. Determinismo

- RNG sempre iniettato; nessun `Math.random`.
- `applyStatus` con `chance` usa `rng.chance`.
- Ordine di risoluzione `statMod` deterministico: `priority` asc, poi `statusId` asc.
- Stack e tick non introducono casualità non seedata.

---

## 7. Strategia di test (TDD)

**Esistenti (devono restare verdi):** `resolve.test.ts`, `simulate.test.ts`, `selection.test.ts`, `balance.test.ts`, tutti gli altri (154 totali).

**Nuovi test:**
1. `statuses.test.ts` (dati): ogni `StatusDef` ha campi coerenti con la sua `family`; id univoci.
2. `status.test.ts`: stack policy (`ignore`/`refresh`/`extend`/`stack` + `maxStacks`); `effectiveStats` ordine priorità; `tickStatuses` dot+regen+prune; `absorbDamage` scudo; `canAct`/`canCastSpell`/`canAttack`.
3. `normalizeSpell.test.ts`: ogni spell legacy → `EffectSpec[]` atteso; equivalenza comportamentale.
4. `effects.test.ts`: ogni handler (`damage` con crit/dodge, `heal`, `shield`, `applyStatus` con `chance`).
5. Integrazione: una battaglia con uno spell che applica `silence` → vittima usa colpo base; `shield` assorbe; `freeze` salta turno.

---

## 8. Sequenza di implementazione

1. `data/statuses.ts` + `statuses.test.ts`.
2. `types` (superset `ActiveEffect`, `EffectSpec`, campi `Spell`).
3. `game/engine/status.ts` + `status.test.ts` (sposta `effectiveStats`/`tickStatuses`, re-export).
4. `normalizeSpell.ts` + test.
5. `effects.ts` (`EFFECT_HANDLERS`) + test.
6. Refactor `resolve.ts` → interpreter; verifica `resolve.test.ts` verde.
7. `selectSpell.ts` (silence) + `simulate.ts` (`canAct`).
8. Nuovi spell dimostrativi (1-2) che usano `spec`/scudo/silence + test integrazione.
9. `npm run typecheck` + `npm test` → tutto verde.

---

## 9. Estensibilità sbloccata

Dopo questo spec, aggiungere contenuti = **solo dati**:
- nuovo status → riga in `STATUS_DEFS`;
- nuovo incantesimo ricco → entry con `spec:[...]`;
- nuovo tipo di effetto → una entry in `EFFECT_HANDLERS` (loop invariato).

Predispone i prossimi spec: pipeline esplicita, log per cronaca LLM, carte draft con info strategiche.
