# Carte draft "poster" — leggibilità del valore — design

Data: 2026-07-07. Stato: approvato (brainstorming + mockup). Copy in italiano.

## Problema

Al draft l'utente sceglie il mago sul DANNO perché è l'unica cosa leggibile. Il valore vero
(ruolo, cosa fa in battaglia, abilità unica, sinergie) c'è ma è invisibile o mal descritto:
- La card attuale (`components/cards/WizardCard.tsx`) mostra il ruolo come una minuscola icona
  e chip vaghi ("Gioco Leale", "Bastione", "Stazza") che non dicono cosa fa.
- Il tooltip di ruolo (`lib/roleInfo.ts`) è OBSOLETO dopo i cambi combattimento (dice "Controllo
  scavalca il Tank" — ora scavalca solo con hard-control; "Supporto = guaritore" — ora ci sono 4
  archetipi).
- Nessun segnale dell'abilità UNICA del mago ("solo lui rianima / provoca / avvelena").

## Obiettivo

Ridisegnare la card del draft come un **poster del personaggio**: il ritratto è protagonista,
il ruolo è dichiarato con un verbo, l'abilità unica del mago è in evidenza, l'effetto è
leggibile a parole (come una carta collezionabile). Scegliere diventa una scelta difficile
perché il valore non-danno è finalmente visibile.

Design VALIDATO a mockup (direzione "poster", vedi `scratchpad/mockup/poster2.html`).

## Vincoli globali

- Copy in italiano. Push su master senza chiedere quando finito.
- Riusa il sistema visivo esistente: palette Notturno (`lib/notturno.ts`: ink #0a0813, oro
  #b08d57→#f3e6a0, viola #7c3aed), font Cinzel (display) + Inter (body), `HouseFrame`/`RarityFrame`.
- 60 maghi, tutti con ritratto `.webp` in `public/portraits/<id>.webp` (copertura 100% verificata).
  Fallback elegante (iniziale + colore-casa) per robustezza, anche se oggi non serve.
- Solo UI + dati testuali (nuove stringhe descrittive). NESSUN cambio al motore di combattimento.
- Quality floor: responsive → mobile, focus tastiera visibile, `prefers-reduced-motion` rispettato
  (l'hover-lift è motion-safe). Il draft è già montato in un GameShell statico (perf) — non
  reintrodurre animazioni infinite.

## Architettura visiva (dal mockup approvato)

La card diventa un **poster verticale** (~330×494, ma responsive):
1. **Ritratto a tutta carta** (`background-size:cover`), il volto protagonista. Wash di colore-ruolo
   in `soft-light` per l'atmosfera; gradiente inferiore + vignette perché il testo resti leggibile.
2. **Fascia ruolo in diagonale** in alto-sinistra: icona + verbo di ruolo (colore-ruolo).
   Badge rarità (tier) in alto-destra.
3. **Nome monumentale** (Cinzel) che invade dal basso, con un occhiello (l'"epiteto" del mago).
4. **Sheet informativo** in basso (gradiente che sale sul ritratto):
   - **Effetto ruolo**: una parola-chiave in grassetto (Provoca / Colpisce / Cura / Disabilita) +
     una frase breve su cosa fa in battaglia.
   - **Targa oro = abilità unica del mago**: stella oro + nome-abilità + descrizione scritta a mano.
   - **Stat** in riga (HP/ATT/DIF/VEL).
5. **Nudge sinergia** (riusa l'esistente `previewSynergies`/`hotSynergyIds`): "Aggiunge <Sinergia>"
   quando il candidato fa avanzare una sinergia — già calcolato in `DraftScreen`, va solo mostrato
   nel nuovo layout.

Colori-ruolo (nuovi token, derivati dal Notturno): Tank #3aa0f2, Attaccante #ff5140,
Supporto #20d894, Controllo #b355ff. Effetto/verbo per ruolo: Tank "Provoca", Attaccante
"Colpisce", Supporto "Cura", Controllo "Disabilita".

## Componenti (unità con confini chiari)

- **`lib/wizardAbilities.ts`** (NUOVO): mappa `<wizardId> → { name: string; blurb: string }` — la
  frase-abilità UNICA scritta a mano per ognuno dei 60 maghi. `abilityFor(id)` con fallback
  (deriva dal nome della magia se un id manca — non deve mai crashare). Un test garantisce
  copertura di TUTTI i 60 maghi.
- **`lib/roleInfo.ts`** (AGGIORNATO): `ROLE_INFO` riscritto per riflettere il combattimento ATTUALE
  (Controllo scavalca SOLO con hard-control; Supporto cura+pulisce+scuda, non solo "guaritore").
  Aggiungere `ROLE_VERB: Record<Role,string>` (Provoca/Colpisce/Cura/Disabilita) e
  `ROLE_ACCENT: Record<Role,string>` (i 4 colori-ruolo). Un solo posto per i dati-ruolo player-facing.
- **`lib/wizardEpithet.ts`** (NUOVO, piccolo): `epithetFor(id) → string` — l'occhiello sotto il nome
  ("Muro della squadra", "Disturbatrice"). Scritto a mano coi ~60, fallback = `ROLE_INFO` breve.
- **`components/cards/WizardCard.tsx`** (RISCRITTO): dal layout attuale (ritratto in cima + chip +
  stat + box magia) al layout poster sopra. È il grosso del lavoro UI. Mantiene la stessa
  interfaccia props (`drafted`, `onClick`, `selected`, `hotSynergyIds`, ...) così i chiamanti
  (DraftScreen, Collezione) non cambiano firma.
- **`components/cards/RoleBanner.tsx`** (NUOVO, piccolo): la fascia diagonale ruolo (icona+verbo+
  colore) — unità riusabile e testabile da sola.

Nota decomposizione: `WizardCard` oggi è 170 righe e diventerebbe densa. Estrarre `RoleBanner`
e un `AbilityPlate` (la targa oro) come sotto-componenti tiene ogni file focalizzato.

## Data flow

`DraftScreen` → passa `drafted` + `hotSynergyIds` a `WizardCard` (invariato) → la card legge
ruolo/stat/magia dal `drafted` + `abilityFor(id)`/`epithetFor(id)`/`ROLE_VERB`/`ROLE_ACCENT` dai
nuovi lib. Nessun nuovo stato, nessun cambio al draft engine.

## Contenuto testuale (il lavoro di scrittura)

60 frasi-abilità + 60 epiteti, scritti a mano in italiano, caratterizzanti ma concisi (l'abilità
≤ ~90 caratteri, l'epiteto ≤ ~24). Derivati da: ruolo, magia tipica, casa, lore del personaggio.
Vengono scritti in un unico task dedicato e approvati dall'utente (che può correggere i maghi che
gli stanno a cuore) PRIMA di cablarli nella card. Esempi (dal mockup):
- Cedric (Tank/Tassorosso): epiteto "Muro della squadra"; abilità "Gioco Leale — Fianto Duri: erige
  una barriera che assorbe il danno."
- Bellatrix (Controllo/Serpeverde): epiteto "Disturbatrice"; abilità "Crudeltà — Crucio: dolore che
  indebolisce e logora nel tempo."

## Testing

1. `lib/wizardAbilities.ts`: test che `abilityFor` copre TUTTI i 60 maghi (nessun fallback silenzioso)
   e che `name`/`blurb` rispettano i limiti di lunghezza.
2. `lib/roleInfo.ts`: `ROLE_VERB`/`ROLE_ACCENT` definiti per tutti e 4 i ruoli; `ROLE_INFO`
   aggiornato (un test che asserisce che NON contiene più la frase obsoleta "scavalca il Tank"
   per Controllo senza la qualifica hard-control).
3. `WizardCard`: render test — mostra nome, verbo di ruolo, la targa abilità (testo di `abilityFor`),
   le 4 stat, e il nudge sinergia quando `hotSynergyIds` non è vuoto. Fallback ritratto: rende
   l'iniziale se il file manca (mockando un id senza webp).
4. `RoleBanner`: test — il colore/verbo giusto per ogni ruolo.
5. Regressione completa + `tsc`. Nessun test di combattimento toccato (solo UI/dati).
6. Verifica visiva reale (Playwright headed, GPU): screenshot del draft con le nuove card,
   confronto col mockup approvato; controllo leggibilità testo su ritratti chiari E scuri
   (Cedric luminoso vs Bellatrix scura — il gradiente+vignette devono reggere entrambi).

## Fuori scope (YAGNI)

- Nessuna nuova meccanica/abilità di motore (solo TESTO che descrive l'esistente).
- Nessun ridisegno della Collezione oltre a ciò che eredita da `WizardCard` (se la Collezione usa
  la stessa card, la eredita gratis; se ha un layout diverso, resta invariata in questa slice).
- Niente ritratti nuovi (i 60 esistono).
- Niente pannello sinergie separato ridisegnato (il nudge sulla card + il tracker esistente bastano).

## Rischi

- **Leggibilità testo su ritratti chiari**: un volto luminoso (Cedric) può rendere il testo bianco
  poco leggibile. Mitigazione: gradiente inferiore forte + vignette + eventuale scrim locale dietro
  il testo. Verificato a mockup, da ri-verificare su tutti gli sfondi reali (test 6).
- **Scrittura 60 frasi**: è la parte più lunga. Mitigazione: task dedicato, approvazione utente,
  fallback derivato così la card non è mai vuota anche se una frase manca.
- **Propagazione del restyle (VERIFICATO)**: `WizardCard` è consumata da `DraftSlot`,
  `WizardCardColumn`, `WizardCardRow`, `DraftCandidateCard` → usate in `DraftBoard` (draft),
  `TeamScreen` (la squadra), `RecruitScreen` (reclutamento). TUTTI contesti "scegli/guarda un mago"
  → il poster ha senso ovunque (coerenza desiderata). La **Collezione NON usa `WizardCard`** (ha il
  suo `CardBack`/PortraitImage per l'album) → fuori scope, non si rompe. Il restyle va comunque
  ri-verificato a schermo in tutti e 3 i contesti (draft/team/recruit), non solo nel draft, perché
  la card può apparire in dimensioni/griglie diverse (`WizardCardColumn` vs `Row`).
