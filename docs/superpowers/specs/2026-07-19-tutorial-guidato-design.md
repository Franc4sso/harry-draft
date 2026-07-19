# Tutorial guidato (prima run con coach-marks) — Design

**Data:** 2026-07-19
**Stato:** approvato, pronto per il piano d'implementazione

## Problema

Harry Draft è un auto-battler roguelite: il giocatore **prepara** la squadra (draft, ruoli,
Duo) e poi **guarda** il combattimento, senza controllare i colpi. Questo è il concetto più
spiazzante per un nuovo giocatore, insieme al sistema di ruoli che si contrano e ai Duo. Oggi
esiste solo una pagina statica `/rules` (Compendio): si legge, non si impara facendo. Manca un
tutorial guidato che faccia scattare la comprensione sul gioco vero.

## Obiettivi

- Un **tutorial guidato "prima run"** con coach-marks (overlay che evidenzia elementi reali e
  spiega passo-passo) sopra il gioco vero — si impara facendo.
- Copertura **essenziale, ~4 tappe**: Draft → Ruoli → Auto-battle → Duo.
- **Opt-in dal menu** (mai automatico), con un **nudge una-tantum** che aiuta i nuovi a trovarlo.
- Zero dipendenze da server/DB: tutto client-side (`localStorage`), come il resto del profilo.
- Robusto ai cambi di bilanciamento: le tappe si ancorano a **fasi/eventi** del gioco, non a un
  seed fragile.

## Non obiettivi (YAGNI)

- Niente tutorial per mappa / reliquie / nodo Aumento Magia / Endless (si scoprono dal contesto).
- Niente avvio automatico al primo lancio (solo opt-in + nudge).
- Niente scenario tutorial scriptato separato (divergerebbe dal gioco reale).
- Niente animazioni elaborate o branching sui rami del tutorial.

## Decisioni di design (già validate)

1. **Forma:** prima run guidata con coach-marks (non battaglia scriptata, non sola schermata).
2. **Profondità:** essenziale, 4 tappe (Draft, Ruoli, Auto-battle, Duo).
3. **Trigger:** opt-in da un bottone "Tutorial" nel menu; **mai** automatico. In più un nudge
   una-tantum sul bottone per i nuovi giocatori.
4. **Realizzazione:** overlay ancorato alle **fasi** + **ingresso di draft curato** che garantisce
   una coppia-Duo tra le opzioni (approccio "A").

## Architettura

Quattro pezzi ben delimitati. L'overlay è pura UI: **non tocca il motore né il determinismo**.

### 1. Entrata dal menu + nudge — `components/screens/MenuScreen.tsx`

- Nuova voce **"Tutorial"** (accanto a "Modalità infinita"). Al click: `clearRun()` poi
  `router.push('/play?tutorial=1')` e marca il nudge come visto.
- **Nudge una-tantum:** se `profile.tutorialNudgeSeen` è falso, la voce "Tutorial" mostra un
  evidenziatore discreto ("✨ Nuovo? Inizia qui"). Il flag passa a `true` (persistito) alla
  **prima** di: click su Tutorial, oppure click su "Gioca" (avvio di una run normale). Da quel
  momento il nudge non ricompare.

### 2. Persistenza — `lib/metaStore.ts`

- `MetaProfile` guadagna `tutorialNudgeSeen?: boolean` (default `false` via merge in
  `loadProfile`). Salvato in `localStorage` (`harry:profile:v1`), come tutto il profilo.
- Nessun uso del DB Netlify (che resta esclusivo della classifica Endless).
- Casi in cui il nudge ricompare (accettati, normali per un gioco client-side): dati del browser
  cancellati, incognito, altro browser/dispositivo.

### 3. Modalità tutorial + ingresso curato — `PlayFlow.gate` / `RunBRunner`

- La modalità è **transiente**: query param `?tutorial=1`, letto via `useSearchParams` (la pagina
  è già in `<Suspense>`). Non entra nello stato salvato della run.
- **Offerta di draft curata:** in tutorial mode, l'offerta iniziale del draft è prodotta da un
  nuovo `tutorialStarterOffer()` (invece di `starterOffer(seed, house)`), garantendo che tra le
  opzioni ci sia **almeno una coppia che forma un Duo valido** (verificato da test contro
  `DUOS`). Sono maghi veri tra cui scegliere: il coach-mark *suggerisce* la coppia-Duo ma il
  giocatore resta libero.
- Il resto della run usa il motore normale invariato → una run in tutorial mode con la stessa
  offerta è **bit-identica** a una normale (l'overlay non altera l'RNG).
- Le run tutorial sono run di campagna: **non** interagiscono con la classifica (solo Endless
  invia punteggi).

### 4. Overlay coach-mark — nuovo `components/tutorial/`

- **`TutorialProvider`** (context): stato `{ active, stepIndex, advance(), skip() }`. `active` è
  vero quando `?tutorial=1`. Deriva la **tappa visibile** dalla fase corrente del gioco + i
  trigger delle tappe.
- **`TutorialOverlay`**: dato lo step attivo, evidenzia l'elemento bersaglio (via `data-testid`
  esistenti) e mostra un coach-mark posizionato: titolo breve + 1-2 righe + **"Avanti"**, e un
  **"Salta tutorial"** sempre presente.
- **Modello di uno step:**
  ```ts
  interface TutorialStep {
    id: 'draft' | 'ruoli' | 'autobattle' | 'duo'
    anchor: string            // data-testid dell'elemento da evidenziare
    when: (ctx) => boolean     // trigger su fase/evento del gioco
    title: string
    body: string
    placement: 'top' | 'bottom' | 'left' | 'right'
  }
  ```

### Le 4 tappe

| # | Tappa | Trigger (fase/evento) | Evidenzia (`data-testid`) |
|---|-------|-----------------------|---------------------------|
| 1 | **Draft** | ingresso fase draft | carte mago (`draft-pick-*`) |
| 2 | **Ruoli** | ancora nel draft (dopo l'avanzamento della tappa 1) | badge ruolo sulla carta + mini-spiega Tank→Att→Sup→Ctrl |
| 3 | **Auto-battle** | inizio prima battaglia | contenitore arena (aggiungere `data-testid="battle-arena"` se assente) |
| 4 | **Duo** | un Duo diventa **attivo** (`activeDuoIds` non vuoto, dopo il draft della coppia — vedi `hooks/useRunShared.ts`) | pill del Duo (`duo-panel`), rinforzata dal `DuoToast` se scatta in battaglia |

Le tappe 1-2 vivono nella fase draft; la 3 all'ingresso della prima battaglia; la 4 quando il Duo
diventa attivo (deterministico al draft della coppia, non dipende dall'esito della battaglia).

### Comportamento "Salta"

"Salta tutorial" chiude i coach-marks (`skip()` → `active=false`) ma **la run prosegue** normale:
non riporta al menu e non annulla i progressi. Meno punitivo.

## Flusso dati

```
MenuScreen ("Tutorial")
  → set profile.tutorialNudgeSeen=true, router.push('/play?tutorial=1')
    → PlayFlow.gate legge ?tutorial=1 → TutorialProvider.active=true,
      offerta draft = tutorialStarterOffer()
      → RunBRunner rende il gioco normale + <TutorialOverlay/>
        → overlay deriva la tappa dalla fase/evento e la mostra
        → "Avanti" avanza, "Salta" chiude (run prosegue)
```

## Piano di test

- **Derivazione tappa:** data la fase X (draft / battaglia / Duo-attivo) → l'overlay espone la
  tappa attesa; "Avanti" avanza; "Salta" disattiva.
- **Offerta curata:** `tutorialStarterOffer()` contiene ≥1 coppia che forma un Duo valido (assert
  contro `DUOS`/ricette).
- **Nudge:** visibile con `tutorialNudgeSeen=false`; nascosto dopo dismiss; il flag persiste
  (round-trip `saveProfile`/`loadProfile`).
- **Overlay component:** rende la coach-mark corretta per una fase data; bottoni funzionano;
  con `?tutorial=1` assente l'overlay non monta.
- **Determinismo:** una run con `tutorialStarterOffer()` fissata è deterministica e l'overlay non
  cambia nessun output del motore (nessuna regressione di parità replay).

## Componenti nuovi / modificati

Nuovi:
- `components/tutorial/TutorialProvider.tsx`
- `components/tutorial/TutorialOverlay.tsx`
- `components/tutorial/steps.ts` (le 4 `TutorialStep`)
- `game/engine/tutorialOffer.ts` (`tutorialStarterOffer()`)

Modificati:
- `components/screens/MenuScreen.tsx` (voce Tutorial + nudge)
- `lib/metaStore.ts` (`tutorialNudgeSeen`)
- `components/screens/PlayFlow.gate.tsx` / `RunBRunner.tsx` (legge `?tutorial=1`, monta overlay,
  usa l'offerta curata)
- `components/screens/BattleArena` (o equivalente): `data-testid="battle-arena"` se manca

## Domande aperte

Nessuna: forma, profondità, trigger, nudge, e i tre punti di dettaglio (draft suggerito non
forzato, "Salta" prosegue la run, tappa Duo al Duo-attivo) sono stati validati.
