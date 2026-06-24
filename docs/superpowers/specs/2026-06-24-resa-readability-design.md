# Redesign "La Resa" — Leggibilità draft & battaglia (Plan 3.5)

**Data:** 2026-06-24
**Tipo:** Redesign UI/UX mirato — leggibilità e resa di draft e battaglia.
**Riferimento:** estende `2026-06-23-resa-redesign-design.md` (Plan 3 battaglia animata già implementato sul branch `feat/resa-battle`, non ancora mergiato). Questo spec rifinisce ciò che Plan 3 ha costruito + corregge il draft.
**Stato:** approvato in brainstorm con l'utente (2026-06-24).

---

## 1. Problema (dalle parole dell'utente)

1. **Chip di affiliazione nel draft**: troppi, impilati in un blocco verticale troppo ampio, brutti, e ripetono nomi di sinergia. Confondono.
2. **Etichetta chip**: non deve MAI mostrare un conteggio (es. "3 Grifondoro") — solo il nome ("Grifondoro"). Il conteggio confonde.
3. **Card draft troppo grandi**.
4. **Battaglia illeggibile**: "non capisco nulla di ciò che succede". Va resa accattivante E intuibile; cambiare layout se serve.
5. **Sinergie/reliquie invisibili in battaglia**: l'utente vuole vedere le sinergie attive **sue e dell'avversario** durante il fight.
6. **Domanda esplicita**: sinergie e reliquie hanno valore reale nei combattimenti?

## 2. Risposta alla domanda 6 (verificata nel codice)

**SÌ.** In `game/engine/combat/simulate.ts` ogni unità entra in battaglia con stat già modificate: `applyBonuses(stats, synergies)` poi `applyRelicBonuses(...)` (`toBattleUnits`, righe 19-20). Inoltre regen da sinergie/reliquie e trigger reliquie via EventBus durante il fight. **Vincolo del motore (da rispettare e da rendere visibile):** le **reliquie si applicano solo alla squadra del giocatore** (lato `left`); l'avversario non ha mai reliquie. Le **sinergie** si applicano a entrambe le squadre. Questo spec rende quel valore **visibile** in battaglia (ribbon §6); non modifica il motore.

## 3. Obiettivo

Draft e battaglia in cui ogni informazione importante **si vede e si capisce**, mobile-first, senza toccare il motore deterministico né i dati di gioco. Resa "accattivante ma sobria"; battaglia ad **auto-play lento e leggibile**.

**Vincoli globali** (validi per ogni task):
- **Mobile-first**, leggibile a 390px; poi desktop.
- **Deterministico**: tutto presentazionale. Nessuna modifica a `game/`, `types/`, `data/`. I test replay/seed restano il cancello di regressione.
- **TypeScript strict** — niente `any`.
- **`prefers-reduced-motion`**: fallback statico via `useReducedMotion` (framer-motion v12).
- **Copy in italiano**.
- **Riuso** dei primitivi Plan-1: `RarityFrame`, `PortraitImage`, `HouseCrest`, `rarityStyle`, `houseTheme`/`cn`, `RoleIcon`, `Chip`.
- **Suite**: parte da 399 verde (branch `feat/resa-battle`). Ogni task chiude verde.
- **Ritratti fuori scope** qui: NON vengono generati. L'utente inserirà manualmente i file in `public/portraits/<id>.webp`. Il lookup per `id` è già pronto (`PortraitImage`), quindi i ritratti compaiono da soli appena la cartella è popolata, senza cambi di codice. Fino ad allora la UI usa il fallback migliorato (§7).

## 4. Chip di affiliazione nel draft — "striscia compatta, icona-prima"

Sostituisce il blocco verticale di pill attuale.

- **Una sola riga orizzontale** di chip piccoli sotto il nome del mago; mai impilati in un blocco alto. Wrap su massimo due righe solo se indispensabile in colonna stretta.
- **Chip Casa**: stemma SVG (`HouseCrest`) + nome casa — es. `🦁 Grifondoro`. **Solo il nome, mai un numero.**
- **Chip Ruolo**: `RoleIcon` + nome ruolo (es. `Tank`).
- **Chip Sinergie speciali**: per le sinergie a cui il mago appartiene che NON sono semplicemente casa/ruolo (cioè le sinergie `by-id`/`tag` come Trio d'Oro, Malandrini, ecc.), un chip oro con icona + nome breve della sinergia. Le sinergie che coincidono con casa o ruolo NON generano un chip aggiuntivo (già rappresentate dai chip casa/ruolo) — questo elimina la ripetizione.
- **Stato "hot"**: un chip la cui affiliazione farebbe **avanzare una sinergia** della squadra attuale riceve un **anello/glow oro** (riuso logica `hotByCandidate` esistente). Nessun testo extra, solo il glow.
- Risultato tipico: 2–4 chip piccoli su una riga. Pulito, scansionabile, name-only.
- **Sorgente dati**: `wizardAffiliations(wizard)` (esistente) per le affiliazioni; classificazione casa/ruolo/speciale derivata dal `kind`/`requires` della sinergia (dato esistente in `data/synergies.ts`). Il conteggio/soglia resta **solo** nel `SynergyTracker`.

## 5. Card draft — più compatta

- Larghezza `w-44` (~176px) da `w-60`. Banda ritratto `h-28` da `h-40`.
- Le 4 stat passano da 4 righe `StatBar` piene a una **griglia 2×2** compatta: etichetta + numero + barretta sottile. Tutte e 4 le stat restano visibili (HP/ATK/DIF/VEL), solo più dense.
- Magia: nome + un chip tipo; i chip-effetto solo se presenti.
- Striscia chip (§4) su una riga.
- Netto: card ~30–35% più corta, informazione completa. Più card per schermata.
- `CARD_STAT_MAX` invariato. Il componente resta `WizardCard` (riusato anche altrove): la nuova densità non deve rompere i suoi consumatori (TeamScreen, ecc.) — verificare.

## 6. Battaglia — arena frontale a due corsie, leggibile

Ripensa la presentazione costruita in Plan 3 (`BattleArena`, `UnitBust`, `SpellFx`, `InitiativeBar`, `ActionBanner`) per chiarezza. Niente nuovi concetti di motore.

**Struttura verticale (mobile-first, anche desktop):**
1. **Barra iniziativa** (in cima, già esistente): chi agisce ORA + coda, derivata dall'ordine del replay. Mostrare la **VEL** dell'unità corrente accanto, così è esplicito *perché* agisce prima.
2. **Ribbon sinergie/reliquie — sopra ogni squadra** (RICHIESTA UTENTE):
   - Sopra i busti della **tua** squadra (sx): pill oro delle **sinergie attive** della tua squadra + pill delle **tue reliquie attive**.
   - Sopra i busti **nemici** (dx): pill delle **sinergie attive** del nemico. (Niente reliquie: il nemico non ne ha — §2.)
   - Ogni pill: icona + nome + effetto brevissimo (es. "Grifondoro · +20 DIF"). Riusa `synergyBonusText` (`lib/glossary`) per il testo bonus, già usato dal tracker.
   - Sorgente dati: `playerSyn`/`enemySyn` e `playerRelics` sono **già** props di `BattleScreen` — oggi non mostrati in battaglia. Solo lettura.
3. **Arena a due colonne**: tua squadra a sinistra, nemici a destra. Ogni unità = `UnitBust` (cornice rarità + ritratto/fallback + HP bar + icone stato). Chi **agisce**: si solleva + aura verde. Chi è **bersaglio**: flash rosso.
4. **Layer effetti** tra le colonne: proiettile caster→bersaglio col colore dell'archetipo; su parata, cupola Protego + "PARATO".
5. **ActionBanner** sotto l'arena, grande: "Harry → Stupeficium → Draco: −42", sincronizzato con l'animazione. È l'ancora testuale: anche senza guardare il moto, leggi cosa è successo.
6. **Controlli ritmo**: play/pausa, **Passo** (passo-passo), velocità, salta.

**Ritmo (auto-play lento + leggibile):**
- Parte da sola, ritmo calmo: una mossa ben visibile alla volta con **breve pausa sull'impatto** (il numero danno resta leggibile un istante prima del passo successivo). Lo `stepMs` di default va aumentato rispetto all'attuale per dare respiro; resta accelerabile (velocità) e saltabile.

**Resa (accattivante ma sobria):**
- Proiettili colorati per tipo (archetipo già mappato), flash d'impatto, numeri che volano (rosso danno / oro critico / verde cura), cupola Protego, aura su chi agisce/subisce, HP che calano animati, icone di stato (🔥/💫/🛡️), caduti grigi al loro posto.
- **Niente** screen-shake/particelle/traiettorie curve/ritratti reattivi (esplicitamente fuori scope — YAGNI, rischio perf mobile).
- Performante su mobile: preferire transform/opacity; rispettare `prefers-reduced-motion` (fallback statico, già presente nei componenti Plan 3).

**Architettura:** il `BattleScreen` resta thin shell. La ribbon è un nuovo componente puro `SynergyRibbon` (riceve `synergies`, `relics?`, `side`) consumato due volte da `BattleArena` (o da `BattleScreen` attorno all'arena). `BattleArena`/`UnitBust`/`SpellFx`/`InitiativeBar`/`ActionBanner` esistenti vengono raffinati, non riscritti da zero.

## 7. Fallback ritratto — intenzionale, non un orb a caso

Finché mancano i ritratti veri, `PortraitImage` mostra oggi un orb a gradiente. Renderlo una **silhouette/busto stilizzato nei colori della casa con lo stemma**, così sembra una scelta di design e non un placeholder rotto. Modifica confinata a `PortraitImage` (ramo `failed`), zero impatto sull'API.

## 8. Testing

- **Logica UI pura**: classificazione chip (casa/ruolo/speciale, niente duplicati, niente conteggi); selezione sinergie/reliquie attive per la ribbon.
- **Componenti** (RTL): la card mostra stat 2×2 + striscia chip a una riga; `SynergyRibbon` mostra le pill attive del lato; l'arena renderizza ribbon di entrambi i lati; il banner narra l'azione corrente; i controlli ritmo funzionano; il fallback ritratto rende silhouette+stemma.
- **Determinismo**: i test replay/seed esistenti restano verdi (nessun cambio motore).
- **Accessibilità**: fallback `prefers-reduced-motion`.

## 9. Fuori scope (YAGNI)

- Generazione dei ritratti (li inserisce l'utente manualmente in `public/portraits/`).
- Screen-shake, particelle, traiettorie curve, ritratti reattivi.
- Tuning di bilanciamento/difficoltà (è il Plan 4, separato).
- Modifiche a motore/tipi/dati.
- Nuove sinergie/reliquie/magie.

## 10. Decomposizione in piani

Un singolo piano sequenziale (`writing-plans`), ogni task verde a sé:
1. Fallback ritratto (silhouette+stemma) — piccolo, sblocca la resa visiva di card e busti.
2. Chip draft: lib di classificazione (casa/ruolo/speciale, no-count, no-dup) + striscia compatta in `DraftCandidateCard`/`WizardCard`.
3. Card draft compatta (w-44, stat 2×2, banda ritratto ridotta) — verificare consumatori di `WizardCard`.
4. `SynergyRibbon` (componente puro) + selezione sinergie/reliquie attive.
5. Battaglia: montare le ribbon sopra ogni squadra in `BattleArena`/`BattleScreen`; VEL accanto all'iniziativa; ritmo più lento (stepMs); rifinitura leggibilità/banner.
6. Suite completa + build + smoke manuale (draft + battaglia) a 390px e desktop.
