# La vetrata e gli incantesimi in scena — Design

**Data:** 2026-09-16
**Stato:** approvato dall'utente
**Mockup vincolanti:**
- Struttura e mondo: https://claude.ai/artifact/PNqfY2yLXxHiY4ziu6QsUq (variante **Vetrata**, la B)
- Effetti e movimento: https://claude.ai/artifact/Dk93L833VQCrhqUvzHwgo3

**Sostituisce:** `2026-09-16-battaglia-il-duello-in-primo-piano-design.md`, dopo che l'utente ha
visto il teatro implementato e l'ha respinto: «in modalità teatro non si capisce tanto cosa
funziona, forse era meglio prima».

## Da dove si riparte

Il piano precedente ha portato a schermo il duello in primo piano — due ritratti grandi al
centro, gli altri quattro in miniatura. Tecnicamente riuscito, e comunque sbagliato: con
**cinque maghi per lato** perdi il campo, e il giocatore non capisce più chi sta messo come.
Tre richieste dell'utente, tutte confermate misurando il motore e non a occhio:

1. **Carte complete**, tutte e dieci, sempre. `BALANCE.draft.teamSize = 5`, e un boss arriva a
   `unitCount: 5`: il caso peggiore è **dieci carte**, non sei.
2. **Ordine dei turni sopra**, con gli attacchi futuri — non solo chi tocca.
3. **Registro fuori dal combattimento**, a fine scontro.

## La forma

Le misure escono da un conto, non da un gusto. Con corsia e registro sui fianchi, cinque carte
per fila scendono a **150px**: un francobollo. Togliendoli, si torna a **212px**. Da qui la
regola: **niente occupa le colonne laterali**.

```
┌──────────────────────────────────────────────────────────┐
│ turno · forza nemici ▬▬ · forza tua ▬▬                 32│
├──────────────────────────────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                      │
│  │    │ │    │ │    │ │    │ │    │   cinque nemici   254│
│  └────┘ └────┘ └────┘ └────┘ └────┘                      │
├──────────────────────────────────────────────────────────┤
│  ◇─◇──[ ORA · BELLATRIX LANCIA ]──◇──◇──◇──◇          180│
│         il nastro dei sigilli                            │
├──────────────────────────────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                      │
│  │    │ │    │ │    │ │    │ │    │   i tuoi cinque   254│
│  └────┘ └────┘ └────┘ └────┘ └────┘                      │
└──────────────────────────────────────────────────────────┘
```

Carta **212×254**, fila da `x=135`, passo 221. Nastro a `y=316`, alto 180.

**Il mondo è la vetrata:** losanghe di piombo appena percettibili sul fondo (due trame a 60° e
−60°), un filo di luce sul bordo alto di ogni carta, vignettatura che stringe l'occhio al
centro. Zero bagliori: cornici a **angoli incisi**, sigilli **ottagonali**, tacche.

## Il nastro dei sigilli

Il centro non è decorazione: è **la sequenza degli incantesimi**. Ogni nodo è un ottagono col
sigillo del *tipo* — e quei tipi esistono già in `lib/glossary.ts`, `SPELL_TYPE_META`: Attacco
`#FF8A7A` spade, Difesa `#7DB7FF` scudo, Cura `#7CFC9B` cuore, Controllo `#C98BFF` bacchetta.
Si riusano, non si reinventano.

- I turni **passati** sbiadiscono a sinistra (opacità .2).
- Il turno **attuale** è un riquadro con angoli dorati: chi lancia, cosa, su chi, con che
  probabilità.
- I **futuri** mostrano nome e incantesimo; chi salterà porta una **tacca** sul sigillo
  (`✦` stordito, `❄` congelato) — lo sai prima che accada.

## Il colpo, sulla carta

Il numero del danno nasce **sulla carta di chi lo subisce**, centrato sul ritratto — non in una
colonna laterale, non sopra il bordo. Richiesta esplicita dell'utente: «il danno lo farei
leggermente più piccolo e al centro dell'immagine, non così sopra».

| evento | resa |
|---|---|
| colpo | numero bianco 56px |
| critico | numero oro 72px |
| cura | numero verde col `+` |
| assorbito | numero azzurro **barrato** |
| uccisione | `K.O.` |

Sotto il numero, quando serve, la **targhetta dell'effetto**: `✖ SILENZIATA`, `◈ INFRANTO`.
Su una carta di bordo il numero va vincolato dentro la cornice, altrimenti esce — misurato.

## Gli stati si sommano

Correzione dell'utente, confermata dal motore. In `data/statuses.ts` veleno e bruciatura hanno
`stack: 'accumulate'` fino a **8 dosi**, e il veleno fa `tickDamage*stacks + tickPctMaxHp*stacks`.
Quindi **una pillola per stato, col totale**: `☠ 3`, non tre teschi.

Lo scudo è diverso e va trattato diversamente: non ha dosi ma `absorb` — **punti di danno
assorbibile**. Si mostra `◈ 50`, e quel numero **cala** man mano che incassa.

**L'aura sulla cornice è un segno di intensità, non di presenza.** Scatta per gli stati che
bloccano il turno (gelo, stordimento) sempre, e per i danni nel tempo **da 2 dosi in su**. Con
una dose sola basta la pillola. Ragione misurata: quando il Duo Miasma propaga il veleno a
cinque alleati, cinque cornici tratteggiate insieme sono illeggibili — e animarle costava
**19 fps contro 52**.

## Gli effetti

**Nessuna libreria nuova.** Il progetto ha già `pixi.js@8`, `pixi-filters`, `gsap` e
`framer-motion` nel `package.json`, **e** una libreria VFX matura in `lib/vfx/`: `PixiStage`,
`choreograph`, `spellVfx` (un catalogo per incantesimo) e 919 righe di `effects.ts` con
proiettili, esplosioni, fiamme, schegge di ghiaccio, barriere esagonali, Avada, teschi.

Il lavoro **non è costruire effetti: è collegarli alla nuova scena.** Oggi `PixiArena` ancora
li ancora ai riquadri del vecchio palco.

Perché Pixi e non CSS, dato che gli FPS sono il vincolo: una battaglia 5v5 emette **198
fotogrammi** e ogni impatto può portare decine di particelle. Su CSS ogni particella è un nodo
del DOM da calcolare e ridipingere; su Pixi sono vertici su GPU in un unico canvas. GSAP resta
per muovere le carte HTML, dove serve precisione di tempo e non massa.

## Vincoli

- **1366×768, dieci carte, niente tagli.** `main` è `overflow-hidden`: `scrollHeight` a 768
  **non è una prova**, va verificato che ogni carta stia in `[0, 768]` — top e bottom.
- **FPS**: la scena deve restare sopra i 45 fps con gli effetti in corso. Misurato sul mockup:
  52 fps a raffica, 44 durante un Duo che propaga a cinque.
- `prefers-reduced-motion`: restano numeri, barre, pillole e aure; spariscono i movimenti.
- Non si tocca `game/engine/`, `data/`, né il bilanciamento.
- Nessun test silenziato: quelli sul vecchio palco si riscrivono sulla nuova scena, con un
  commento che dice perché.

## Confini

**Dentro:** `BattleArena`, `BattleScreen`, il nastro, la carta di battaglia, il collegamento
dei VFX esistenti.

**Fuori:** il motore, i dati, `WizardCard` (resta la carta di pesca), e la libreria `lib/vfx/`,
che si **usa** e non si riscrive.

## Piano

`docs/superpowers/plans/2026-09-16-vetrata-e-incantesimi.md`
