# Leggibilità degli stati in battaglia (congelo/silenzio/veleno/salta-turno)

Data: 2026-07-13
Tipo: miglioramento UI di combattimento (solo presentazione; nessun cambio al motore)

## Problema

Gli stati di un'unità in battaglia esistono nel motore e sono anche resi, ma **non si capisce
chiaramente cosa può fare un'unità nel suo turno**:

1. **CONTROL_OVERLAY** (`UnitBust.tsx:265-280`) copre l'INTERA carta con un pannello tinto +
   pill nera — nasconde il volto del mago ed è "troppo carico" (feedback utente).
2. **Turno saltato**: quando un'unità stordita/congelata non agisce, il motore emette un'entry
   `Stordito` (`simulate.ts:239-244`, `type:'system'`, `flags:['stun']`) su un frame dedicato,
   MA quel frame **accende l'aura verde "sta agendo"** sul bust (`BattleArena.tsx:50-51`:
   `actingKey` non è soppresso per i frame-system non-Duo). Risultato fuorviante: l'unità
   *sembra agire* nell'istante in cui invece **salta**.
3. **Veleno tick**: ha già un frame dedicato + numero flottante `-N`, ma usa il **flash d'impatto
   rosa da attacco** (`impact` in `UnitBust.tsx:282-292`) — non è distinguibile da un colpo, e
   non comunica "veleno che ticca".

## Obiettivo

Rendere ogni stato **leggibile senza coprire il volto** (design "sottrarre, non caricare",
validato coi mockup). Distinguere per **colore-categoria**:
- **Salta tutto** (Stordito giallo, Congelato ciano) → non fa nulla.
- **Limitato** (Silenziato viola = no magie, Disarmato fucsia = no colpi) → agisce ridotto.
- **Ticca** (Veleno verde) → agisce, poi perde vita a fine turno.

Il colore dice la categoria; la parola dice il dettaglio.

## Vincoli

- **Solo presentazione.** Nessun cambio a `game/engine/*` — i dati (entry `Stordito`, tick veleno,
  `statusEffects` per-frame, `controlKind`) esistono già. Il replay/anti-cheat NON è toccato.
- **PERF (regola dura):** l'unica animazione continua su UnitBust è il reticolo target
  (`animate-pulse`), già noto come collo di bottiglia FPS (memoria obs 12534). **NIENTE nuovi
  loop CSS infiniti** — solo transizioni event-driven (mount/opacity one-shot come impact/float).
- **Copy in italiano.**
- I colori-stato sono già definiti (`STATUS_CLASS`/`CONTROL_OVERLAY` in UnitBust.tsx): riusarli
  (stun=yellow-300, freeze=cyan-300, silence=violet-400, disarm=fuchsia-400, dot=green).

## Design

### Parte 1 — Stato persistente quieto (sostituisce CONTROL_OVERLAY pieno)

Il volto resta **sempre visibile**. Lo stato di controllo si legge da:

- **Trattamento del ritratto** (non un pannello sopra):
  - **Congelato**: il ritratto ghiaccia — tinta ciano (`filter: brightness(.82) saturate(.7)
    hue-rotate(-6deg)`) + un overlay statico di cristalli/brina (gradienti diagonali ciano
    negli angoli). È l'effetto più forte perché "congelato" È un trattamento visivo naturale.
  - **Stordito**: leggera desaturazione + il glyph/fascia gialli (sotto). Meno invasivo del freeze.
  - **Silenziato / Disarmato**: nessun pesante trattamento del volto (non "gelano"), solo
    glyph + fascia colorati (viola / fucsia).
- **Glyph tondo piccolo** in alto-centro della carta (sopra la cornice, `top:-8px`): un cerchietto
  ~22px col simbolo dello stato (⚡ stun / ❄ freeze / 🚫 silence / ⚔ disarm), bordo del colore-stato.
  Sostituisce/affianca la pill esistente di quello stato.
- **Fascia sottile** in fondo al ritratto (`bottom`, non copre il volto): `{label} · {n}t` in
  MAIUSCOLETTO piccolo, gradiente dal trasparente al colore-stato scuro. Es. "CONGELATO · 2T".

Il vecchio `CONTROL_OVERLAY` a tutta carta (il pannello `grid place-items-center aspect-[3/4]`)
viene **rimosso** e sostituito da questo trattamento. La pill di controllo in alto (che oggi
duplicherebbe il glyph) va riconciliata: il glyph tondo È il segnale di controllo; le pill in alto
restano per gli stati NON-controllo (scudo/regen/ward) + veleno.

### Parte 2 — L'istante del turno saltato (il lampo "SALTA")

Sul frame in cui un'unità **salta** (entry `action:'Stordito'`, `type:'system'`, con un
control-kind che gate 'action' → stun/freeze), il bust mostra un **lampo secco "SALTA"**:

- Una parola "SALTA" (Cinzel, ~13px, ruotata di -4°) che appare per ~0.4s e svanisce, col colore
  dello stato (ciano per freeze, giallo per stun). Uno **sweep**, non un pannello.
- **FIX del bug aura-acting**: su questo frame l'aura verde "sta agendo" NON deve accendersi.
  Va soppresso `actingKey` per i frame-system di salto-turno (come già si fa per i Duo-system):
  in `BattleArena.tsx`, estendere la condizione che spegne `actingKey` per includere il frame
  `Stordito` (`type==='system' && flags.includes('stun')` o l'action `'Stordito'`). Questo è
  l'unico ritocco a BattleArena — resta presentazione (non tocca il motore).
- Il float resta null (già così per i system frame) — nessun numero sul salto.

Come fa UnitBust a sapere che "sta saltando ORA": riceve una prop (es. `skipping?: 'stun'|'freeze'`)
derivata in BattleArena dal frame corrente quando l'entry è `Stordito` e il target/actor è quel
bust. Da chiarire nel piano: l'entry `Stordito` ha `actorId=actorSide` = l'unità che salta
(`simulate.ts:241`), quindi BattleArena può passare `skipping` al bust il cui key == quello
dell'attore del frame Stordito, leggendo il `kind` dal suo statusEffect di controllo nel frame.

### Parte 3 — Il veleno che ticca (flash verde, non rosa)

Sul frame di un tick veleno/bruciatura (entry `flags:['dot']`, già frame dedicato col float `-N`):

- Il flash d'impatto sul bust dev'essere **verde tossico** (veleno) / arancione (bruciatura),
  non il rosa d'attacco. Oggi `impact` (`UnitBust.tsx:282-292`) usa `bg-rose-400/30` (o amber per
  crit). Aggiungere un ramo: se il float/entry corrente è un tick `dot`, il flash è verde
  (`bg-green-400/30`) per veleno, ambra per bruciatura.
- Il numero flottante `-N` resta (già presente), ma con **tinta verde** per il veleno (oggi è
  `tone:'damage'` rosso — `damageFloat.ts`). Aggiungere un tone `dot`/`poison` verde.

Come UnitBust sa che il flash corrente è un tick veleno: la prop `float` porta già il testo `-N`;
serve propagare anche il **tone/tipo** (dot vs attacco) fino al ramo del flash. Da definire nel
piano: estendere `floatFor`/il tipo del float con un tono `dot`, e usarlo sia per il colore del
numero sia per il colore del flash.

## Fuori scope (slice separate, già concordate)

- **Motivo del targeting** (perché quel bersaglio) — Slice A, motore. Non qui.
- **Lift & focus** (il focus cinematografico sui momenti chiave) — Slice C, UI grossa. Non qui.
- Questa slice è **solo** la leggibilità degli stati sulla carta, indipendente dalle altre due.

## Test

- **Overlay stato**: dato un `effects` con `stun`/`freeze`/`silence`/`disarm`, il bust rende il
  glyph + fascia giusti e NON il vecchio pannello a tutta carta; il volto (`img`) resta nel DOM
  senza overlay che lo copre. (test su UnitBust con effects mock)
- **Freeze treatment**: un effect `freeze` applica il trattamento ghiaccio al ritratto (classe/stile
  distinguibile da freeze vs non-freeze).
- **Lampo SALTA**: dato un frame `Stordito` per un'unità, il bust di quell'unità mostra "SALTA" e
  l'aura acting NON è attiva (regressione del bug). (test su BattleArena: frame Stordito → il bust
  ha `data-skipping` e non `acting`)
- **Veleno verde**: dato un frame tick `dot`, il flash/numero del bust bersaglio è verde
  (veleno)/ambra (bruciatura), non rosa. (test su UnitBust o damageFloat: il tono del tick dot è
  verde, non damage-rosso)
- **PERF**: nessun nuovo `animate-pulse`/loop infinito introdotto (grep di verifica nel piano).
- **Nessuna regressione**: i test esistenti di UnitBust/BattleArena/BattleLog restano verdi.
