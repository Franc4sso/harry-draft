# Spec — "Il tradeoff della perdita" (draft/recruit readability)

_Data: 2026-07-21 · Fase 1 della roadmap Core Fun · Tipo: UX su motore esistente + helper puro_

Frase-cuore servita: **"pago un prezzo che fa male"** — portata dentro la decisione di recruit.

---

## 1. Problema

Al nodo **recruit**, quando la squadra è piena, reclutare un candidato **sostituisce** un teammate.
Oggi il `DuoTracker` mostra live cosa il candidato **accende** (`si attiva`) o **avvicina** (`avanza`) —
ma **mai cosa la sostituzione SPEGNE**. `previewDuos` ritorna solo `{ completes, advances }`: solo guadagni.

Risultato: il giocatore può spegnere un Duo attivo (es. Cancrena) reclutando un mago, **senza alcun avviso**.
La decisione più interessante del draft — il tradeoff, il rimpianto — è oggi invisibile.

## 2. Obiettivo

Rendere **live** (senza dialog, senza click di conferma) la **perdita** che una sostituzione causa,
con la perdita che **domina visivamente** il guadagno. Coerente col Core Fun: la perdita deve
pungere più di quanto il guadagno gratifichi.

Scope disciplinato — **solo il nodo recruit a squadra piena** (`full === true`), l'unico punto dove
si sostituisce un teammate. Lo starter draft NON è toccato (lì si aggiunge, non si rimpiazza:
nessuna perdita possibile). Nessuno spostamento dei mark sulla card (resta in roadmap, non ora).

## 3. Decisioni di design (approvate)

- **Momento:** live mentre consideri (hover/focus sul candidato, con `replaceId` già selezionato).
  NIENTE dialog di conferma — informa e lascia sbagliare; rispetta il giocatore.
- **Peso visivo:** la perdita **domina l'occhio**. Ordine: `si spegne` (rosso, in cima, pesante) >
  `arretra` (ambra, medio) > `si attiva`/`avanza` (verde, sotto, discreto).
- **Trio:** se la sostituzione fa cadere il gate di un Trio di casata attivo, va segnalato — il Trio
  è un effetto forte, la sua perdita punge di più. Priorità visiva ≥ perdita di un Duo.

## 4. Architettura

### 4a. Motore — nuovo helper puro in `game/engine/duos.ts`

Specchio di `previewDuos`, ma per le **perdite**. Firma proposta:

```ts
export type DuoLoss = { breaks: Duo[]; regresses: Duo[] }

/** Diff quando si RIMUOVE un teammate (recruit a squadra piena: current → current − replaced + candidate).
 *  breaks   = Duo attivo ORA che diventa inattivo dopo lo swap.
 *  regresses = Duo a one-away ORA che torna two-away+ dopo lo swap.
 *  `current` = squadra COMPLETA attuale (col mago che uscirà); `next` = squadra risultante.
 *  Pure, no RNG. Usa livingOf come previewDuos. */
export function previewDuoLoss(current: DraftedWizard[], next: DraftedWizard[], relics: ActiveRelic[]): DuoLoss
```

Logica (specchio inverso di `previewDuos` righe 98-109):
- `before = duoProgress(livingOf(current), relics)` → mappa per `duo.id`.
- `after  = duoProgress(livingOf(next), relics)`.
- `breaks`    = `before.active && !after.active`.
- `regresses` = `before.missing.length === 1 && after.missing.length >= 2` (era a un passo, ora no).

**Perché due argomenti espliciti** (`current`, `next`) invece di `(team, removed, candidate)`:
il chiamante (RecruitScreen) ha già `team` (completo) e `baseTeam` (= team − replaceId). Passare i due
insiemi già pronti evita di ricostruire la rimozione nel motore e tiene l'helper una pura diff.

### 4b. Motore — Trio loss

`trioGates` (trios.ts:38) è già la fonte unica del gate. Diff analogo:

```ts
export function trioGateLoss(current: DraftedWizard[], next: DraftedWizard[], relics: ActiveRelic[]): House[]
```

- Calcola `detectDuos` su `current` e `next` (serve perché il gate Trio richiede ≥1 Duo attivo).
- `beforeGates = trioGates(current, detectDuos(current, relics))`,
  `afterGates  = trioGates(next, detectDuos(next, relics))`.
- Ritorna le `House` presenti in before e assenti in after (Trio che cade).
- Pure. Vive in `trios.ts` (accanto a `trioGates`) o in `duos.ts` — a scelta dell'implementatore
  per minimizzare import ciclici; preferenza: `trios.ts`.

### 4c. UX — `DuoTracker.tsx`

Il tracker oggi riceve `picks={baseTeam}` (team − rimpiazzato) e `considered`. Per calcolare la
**perdita** gli serve anche il team **completo attuale**. Aggiungere una prop opzionale:

```ts
prevTeam?: DraftedWizard[]   // squadra COMPLETA attuale, prima dello swap (solo recruit-full)
```

Quando `prevTeam` è presente e c'è un `considered`:
- `current = prevTeam` (col mago in uscita), `next = [...picks, considered]` (= baseTeam + candidato).
- `loss = previewDuoLoss(current, next, relics)`, `trioLost = trioGateLoss(current, next, relics)`.
- Nuovi stati riga: `breaks` (rosso) e `regresses` (ambra), **oltre** agli esistenti
  `completes`/`active`/`advances`.
- Nuova sezione/righe Trio perso (se `trioLost.length`): banner rosso "Trio di <Casata> si spegne".

**Gerarchia visiva (rank aggiornato)** — la perdita domina:
```
0  Trio si spegne      (rosso allarme, più forte)
1  Duo si spegne       (breaks, rosso)
2  si attiva           (completes, verde)   ← guadagno resta sotto la perdita
3  attiva              (active, oro)
4  arretra             (regresses, ambra)
5  avanza              (advances, verde discreto)
6  near (one-away)
7  locked
```
Colori: perdita = rosso (`ROSE`/`#f07272` già usato nella replace-list di RecruitScreen per coerenza).
Le righe `breaks` NON sono un pulse gratificante (quello è `synergy-node-pulse`, per i guadagni):
usare un trattamento d'allarme statico (bordo/fondo rosso, testo "· si spegne").

Quando `prevTeam` è assente (starter draft) → comportamento identico a oggi. **Retrocompatibile.**

### 4d. UX — `RecruitScreen.tsx`

Una riga. Il tracker già riceve `picks={baseTeam}`. Aggiungere la prop col team completo **solo
quando `full`** (fuori dal caso full non c'è sostituzione):

```tsx
<DuoTracker picks={baseTeam} considered={focus} relics={relics}
            prevTeam={full ? team : undefined} />
```

`team` (completo), `baseTeam` (= team − replaceId) e `focus` esistono già nel componente.

## 5. Cosa NON facciamo (YAGNI)

- Nessun dialog di conferma.
- Nessuna modifica allo starter draft / DraftScreen.
- Nessuno spostamento dei mark sulla card.
- Nessun nuovo campo in RunState, nessun cambiamento al resolver recruit, nessun cambiamento al motore di combattimento.

## 6. Testing

- **Engine (puro, deterministico):** unit test per `previewDuoLoss` e `trioGateLoss`.
  - `breaks`: team con Cancrena attivo (2 veleno) → rimuovere un veleno → Cancrena in `breaks`.
  - `regresses`: Duo one-away → rimozione lo riporta two-away → in `regresses`.
  - Nessuna perdita: rimuovere un mago irrilevante → `breaks`/`regresses` vuoti.
  - `trioGateLoss`: 3-stessa-casa + 1 Duo attivo → rimuovere un mago di casa → Trio in output.
  - Simmetria/sanità: rimuovere e ri-aggiungere lo stesso mago → nessuna perdita netta.
  - `livingOf`: un morto nel team non deve gonfiare né before né after.
- **UX:** test su RecruitScreen (a squadra piena) che, considerando un candidato mentre `replaceId`
  punta a un mago che regge un Duo attivo, il tracker renda una riga con `data-state="breaks"`
  (o `data-breaks`), e che sparisca togliendo il `considered`.
- **Retrocompat:** DuoTracker senza `prevTeam` (starter draft) — snapshot/behavior invariato.

## 7. File toccati

- `game/engine/duos.ts` — `DuoLoss` type + `previewDuoLoss` (~20 righe).
- `game/engine/trios.ts` — `trioGateLoss` (~12 righe).
- `types/duo.ts` — export `DuoLoss` se si sceglie di centralizzarlo lì (opzionale; può stare in duos.ts).
- `components/draft/DuoTracker.tsx` — prop `prevTeam`, stati `breaks`/`regresses`, righe Trio-perso, rank.
- `components/screens/RecruitScreen.tsx` — passare `prevTeam={full ? team : undefined}`.
- Test: `tests/engine/duoLoss.*` (nuovo), estensione test RecruitScreen esistente se presente.

## 8. Rischi

- **Rumore visivo:** troppe righe colorate confondono. Mitigazione: la perdita è rara (solo quando lo
  swap rompe davvero qualcosa) → di norma il tracker resta com'è oggi. Il rosso appare solo quando conta.
- **Bilanciamento:** ZERO. È pura leggibilità UI, non tocca numeri, motore di combat, né win-rate.
  Non richiede ri-misurazione di `campaignBalanceB`/`campaignBalanceRestricted`.
