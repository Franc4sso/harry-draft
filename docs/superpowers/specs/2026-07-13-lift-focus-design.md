# Lift & Focus — il focus cinematografico sui momenti chiave

Data: 2026-07-13
Tipo: UI di combattimento (presentazione) — Slice C della direzione leggibilità

## Problema

Nella vista squadra normale l'occhio non sa dove guardare durante uno scambio. Sui **momenti
chiave** (uccisione, esecuzione/critico, primo scatto di un Duo) vogliamo che la scena **stringa
sulle due carte coinvolte**: l'attaccante va a sinistra e in ombra, il bersaglio a destra grande e
illuminato, tutto il resto si spegne; parte il colpo; appare una **riga-causa** che dice *perché
quel bersaglio* (dal `reason` emesso dalla Slice A); poi tutto torna alla vista squadra.

## Decisioni prese (validate coi mockup)

- **Lift completo (FLIP reale)**: le due carte si staccano davvero e volano al centro ingrandite.
- **Trigger**: uccisioni (`kill`) + critici/esecuzioni (`crit`) + primo scatto di un Duo. NON i
  controlli (troppo frequenti).
- **Riga-causa solo se `reason` esiste** (azione offensiva): se manca (es. Duo passivo), il lift
  mostra il nome dell'evento (es. "CANCRENA") ma nessuna riga-perché. Niente inventato.

## Architettura (il modo per rendere il FLIP robusto)

**Non spostare le UnitBust originali nel flow.** Le carte vivono in righe flex e il replay
ri-renderizza l'albero ogni frame; portarle fuori-flow romperebbe layout, memo e pause/skip.

Invece: un **overlay `LiftFocus`** montato come sibling di `PixiArena`/`Callout` in `BattleArena`
(assoluto, z alto, `pointer-events-none`) che:
1. Al frame-chiave, **misura i rect reali** delle due carte via `data-unit-key` +
   `getBoundingClientRect` (pattern già usato da `PixiArena.tsx:105-114`).
2. **Clona visivamente** le due carte (ritratto + nome + HP) in due elementi dell'overlay,
   posizionati inizialmente sui rect misurati.
3. **Anima (GSAP one-shot)** i due cloni da lì alle posizioni cinematografiche (sinistra-ombra /
   destra-grande-luce), tiene per un beat con la riga-causa, poi li dissolve.
4. Le carte **originali** restano al loro posto ma **oscurate** durante il lift (riuso/estensione
   del dimming `opacity 0.45` già esistente in `BattleArena.tsx:115` — durante un lift, TUTTE le
   originali vanno a un dimming forte, non solo i non-coinvolti).

Così il layout flex sottostante è intatto, `React.memo(UnitBust)` non è disturbato, e l'overlay è
un layer indipendente che si auto-gestisce.

### Trigger e coordinamento (riuso dell'esistente)

- **Predicato momento-chiave**: una funzione pura `liftMomentFor(entry, firstDuo)` che ritorna
  `{ kind: 'kill'|'crit'|'duo', duoName? } | null`. Deriva dai flag esistenti: `kill` →
  `entry.flags.includes('kill')`; `crit` → `entry.flags.includes('crit')`; `duo` → `entry.duoId`
  presente E `firstDuoFireFrames(...).get(duoId) === frameKey` (primo scatto). Priorità
  kill > crit > duo (allineata a `calloutFor`).
- **Coordinamento con Callout**: il Callout (la parola grande) continua a esistere ed è
  complementare — durante un lift, la parola può apparire SOPRA la scena a fuoco. Non si
  sostituiscono; condividono lo stesso trigger concettuale. (Verificare a schermo che non
  collidano; se lo fanno, il lift sopprime il Callout per quel frame — deciso a schermo.)
- **ActionPanel**: resta per i frame normali (non-chiave). Durante il lift, il pannello centrale
  è coperto dall'overlay. Nessun cambio ad ActionPanel in questa slice.

### Pattern one-shot (come Callout/PixiArena)

`LiftFocus` segue lo schema collaudato (`Callout.tsx:56-73`):
- `lastFiredRef` per firare **una sola volta** per `frameKey`.
- `useReducedMotion()`: con reduced-motion, **niente volo** — al più un focus statico breve
  (dimming + riga-causa per ~700ms), come Callout fa 700ms statico.
- `setTimeout` con auto-clear **indipendente dal loop di playback** (il loop `setTimeout` di
  `useBattleReplay` può essere clearato da pausa/speed — l'animazione ha il suo timeout).
- Durata scalata con `speed` (leggi `speed` come fa PixiArena: `budgetMs = max(700, base/speed)`)
  così ad alta velocità il lift è più corto e non intasa.
- **Robusto a pause/step/skip per costruzione**: keyed su `frameKey` + `lastFiredRef` → uno skip
  che salta oltre il frame-chiave non lo fa mai partire; una pausa su un frame-chiave lascia
  l'animazione già partita a completarsi col suo timeout.

### La riga-causa

- Se `entry.reason` è valorizzato, mostra sotto il bersaglio una riga: `TARGET_REASON_LABEL[reason]`
  (es. "il più debole", "provocato", "affondo sul backline") — da `types/combat.ts`.
- Se manca, nessuna riga-causa; il lift mostra comunque il nome dell'evento (`duoName` per un Duo,
  o "ESECUZIONE"/"CRITICO" per crit+kill/crit) — riuso della logica di `calloutFor`.

## Timing (dwell)

`frameDelay` (`useBattleReplay.ts:29-40`) **già allunga** i frame-chiave (kill ×1.7, crit ×1.35,
duo ×1.7). Prima scelta: **non toccare il loop** — quel dwell dà già respiro. Se a schermo il lift
risulta tagliato (l'animazione dura più del dwell), estendere `frameDelay` per i soli momenti-lift
(es. kill/crit/duo → un moltiplicatore leggermente più alto). Da valutare a schermo; NON toccare il
loop se non necessario (è delicato e influisce sul ritmo generale).

## Vincoli

- **Solo presentazione**: nessun cambio a `game/engine/*`. Il replay/anti-cheat non è toccato.
- **PERF (regola dura)**: event-driven, GSAP one-shot keyed su `frameKey`. **NIENTE loop CSS
  continui** (`animate-pulse` è già un collo di bottiglia). L'overlay non esiste fuori dai momenti
  chiave (monta/smonta col lift), quindi zero costo nei frame normali.
- **Reduced-motion**: rispettato (niente volo, focus statico breve).
- **Non rompere il replay**: `LiftFocus` legge `frameKey`/`entry`/`replay.units`/i rect DOM; non
  muta stato di replay né le UnitBust. Le originali restano montate (solo oscurate).
- **Memo-safe**: il dimming forte durante il lift si applica via una prop/flag a livello di
  `BattleArena` (es. `lifting: boolean`) che cambia l'opacity del wrapper esistente — senza passare
  prop instabili alle singole UnitBust.
- Copy in italiano.

## Test

- **`liftMomentFor` puro**: kill → `{kind:'kill'}`, crit → `{kind:'crit'}`, primo Duo →
  `{kind:'duo', duoName}`, frame normale → null, scatto Duo NON-primo → null (solo il primo).
  Priorità kill>crit>duo.
- **La riga-causa**: dato un entry-chiave con `reason`, l'overlay mostra `TARGET_REASON_LABEL[reason]`;
  senza reason, nessuna riga-causa (ma il nome-evento c'è).
- **One-shot**: l'overlay fira una volta per frameKey (come Callout — riuso del pattern testato).
- **Reduced-motion**: con reduced, nessun volo (assenza dei transform animati; focus statico).
- **Robustezza skip**: un salto di frameKey oltre un momento-chiave NON fa partire il lift.
- **Non-regressione**: i test esistenti di BattleArena/Callout/replay restano verdi; il replay è
  byte-identico (l'overlay è additivo).
- **PERF**: nessun nuovo loop CSS infinito (grep di verifica).
- **Verifica a schermo** (screenshot/registrazione): il lift scatta su un'uccisione reale, le due
  carte volano, la riga-causa appare, tutto torna. Coordinamento Callout OK. Reduced-motion OK.

## Fuori scope

- Il "focus sul posto" (senza volo) — scartato a favore del FLIP completo.
- Il lift sui controlli — escluso (troppo frequente).
- Fallback descrittivo per i momenti senza reason — scartato (mostriamo solo se c'è).
- Modifiche ad ActionPanel/Callout oltre il coordinamento — fuori scope.
