# Onda 1.d — Potare le firme a ~15 percepibili

**Data:** 2026-07-27
**Stato:** spec approvata nelle due decisioni di forma (vedi §2), lista dei 15 da confermare.
**Ripara:** difetto **D4** di `2026-07-25-core-fun-direction.md`.
**Precede:** Onda 1.f (potare le reliquie di statistiche piatte).

---

## 1. Il problema, misurato

Il catalogo ha **60 firme** (`data/signatures.ts`, una per mago) che si riducono a poche
meccaniche ripetute. Misura fatta sul file, 2026-07-27:

| Prova | Dato |
|---|---|
| Firme totali | 60 (Tier 1: 3 · Tier 2: 10 · Tier 3: 20 · Tier 4: 27) |
| Cloni **esatti** (stesso nome, stesso effetto) | `goyle` e `crabbe` = "Stazza", `idReduce(0.10)` |
| `-10% danni subiti` sotto nomi diversi | **5** (Stazza ×2, Resistenza, Disciplina, Orgoglio Tassorosso) |
| `+10% danni` sotto nomi diversi | **3** (Mano Ferma, Slancio, Determinazione) |
| `curata → piccolo scudo` sotto nomi diversi | **4** (Devozione, Gentilezza, Lealtà, Grazia) |

Il Tier 4 — **27 maghi, il 45% del roster** — è un muro di ±10% e proc deboli. In un gioco
che si **guarda** (auto-battler), un modificatore del 10% senza icona a schermo non è
un'abilità: è un numero che nessuno vedrà mai muoversi.

> 60 righe non sono 60 identità. Sono 12 meccaniche scritte 60 volte.

## 2. Le due decisioni di forma (prese dall'utente, 2026-07-27)

1. **Forma della potatura: `~15 maghi con firma, gli altri puliti`.**
   Non si condividono keyword, non si ritarano i Tier 4 verso l'alto. I ~45 maghi restanti
   **non hanno alcuna firma**. Se vedi la targa oro, è un momento raro.
2. **Criterio di scelta: distintività, sparsa su tutti i tier.**
   Tiene la firma chi ha una meccanica **memorabile e visibile a schermo**, a qualunque tier.
   NON si allinea "ha la firma" a "è di tier alto": un Tier 3 con una meccanica strana batte
   un Tier 2 con un `+30%` invisibile. Così anche un mago comune resta una scelta interessante
   nel draft, e la targa oro significa *"questo fa una cosa strana"*, non *"questo è raro"*.

### Cosa NON cambia (garanzia esplicita all'utente)

**Tutti e 60 i maghi restano nel gioco.** Un mago "pulito" mantiene nome, ritratto, casata,
ruolo, tag, magia, statistiche, e continua ad alimentare **Duo / Trii / Sinergie esattamente
come oggi** — quei sistemi leggono `tag + ruolo`, mai le firme (verificato: `duos.ts`,
`trios.ts`, `synergies.ts` non importano `SIGNATURE_BY_ID`). Perde solo la targa oro.

## 3. La regola di taglio

Una firma sopravvive **solo se** produce a schermo qualcosa che il giocatore può nominare:
un'icona di stato, un'unità che salta il turno, una barra che si muove contro corrente.

**Sopravvivono:** applicazione di stato visibile (stordisci, congela, silenzia, disarma,
avvelena, rallenta), trasformazioni di regola (curata → scudo), trigger narrativi
(un alleato cade → furia), scaling che si vede crescere (più ferito → più forte).

**Cadono:** moltiplicatori piatti di danno (`od`), riduzioni piatte di danno (`idReduce`),
bonus condizionali senza segnale (`odIfFaster`), bonus di cura percentuali (`healMod`),
e **ogni clone** di una meccanica già coperta da una firma più forte.

## 4. I 15 che tengono la firma (proposta)

Una meccanica visibile diversa per ciascuno — zero sovrapposizioni.

| # | Mago | Tier | Firma | Cosa vedi a schermo |
|---|---|---|---|---|
| 1 | dumbledore | 1 | Bacchetta di Sambuco | +30% e **stordisce** |
| 2 | voldemort | 1 | Terrore Immortale | **esegue** i morenti, semina terrore |
| 3 | harry | 1 | Coraggio del Grifondoro | più ferito = **più forte**, poi si rigenera |
| 4 | snape | 2 | Pozioni Letali | **avvelena + espone** la difesa |
| 5 | bellatrix | 2 | Tortura Cruciatus | **stordisce** (il Cruciatus puro) |
| 6 | mcgonagall | 2 | Trasfigurazione Marziale | **−30% danni** — il pilastro Tank |
| 7 | lupin | 2 | Furia Lupesca | sotto metà vita **+ATT ogni turno** |
| 8 | kingsley | 2 | Pugno dell'Auror | **rallenta** pesantemente |
| 9 | fleur | 2 | Fascino Veela | **disarma** |
| 10 | hermione | 3 | Mente Brillante | **silenzia** |
| 11 | cho | 3 | Lacrime Gelide | **congela** (l'unica nel roster) |
| 12 | molly | 3 | Istinto Materno | curata → **scudo** (rompe una regola) |
| 13 | neville | 3 | Coraggio Tardivo | un alleato cade → **furia** |
| 14 | luna | 3 | Serenità | **si rigenera** ogni turno |
| 15 | tonks | 3 | Riflessi Mutanti | **accelera** ogni turno |

**Distribuzione:** Tier 1 → 3/3 · Tier 2 → 6/10 · Tier 3 → 6/20 · **Tier 4 → 0/27.**
Il Tier 4 esce interamente: è esattamente il muro di ±10% che D4 denuncia.

### Tagli che meritano una riga di motivazione

- **lucius** (`+45% sotto il 35%`) — stessa forma dell'esecuzione di voldemort, più debole.
  Una sola esecuzione nel gioco, e appartiene all'Oscuro Signore.
- **moody** (`−22%` + defUp) — duplica il pilastro difensivo di mcgonagall. *Alternativa
  aperta:* il suo defUp per-turno è **più visibile** del −30% piatto di mcgonagall; se in
  review si preferisce, si scambiano le posizioni 6 ↔ moody. Una sola delle due resta.
- **draco / dolohov** (veleno) — cloni più deboli di snape. ⚠️ Il **tag** `veleno` resta su
  entrambi: le build veleno e la Sinergia Tossicità **non sono toccate**.
- **sirius / cedric** (atkUp al colpo) — stessa meccanica su due maghi, nessuna delle due
  produce un momento raccontabile.
- **arthur / slughorn** (`+20% cure`) — invisibile per costruzione.
- **viktor** (`+30% se più veloce`) — condizione vera o falsa senza alcun segnale a schermo.

## 5. Impatto tecnico

L'infrastruttura regge la sottrazione **senza modifiche strutturali**:

- `registerSignatures` (`game/engine/signatures.ts:11`) fa già `if (!sig) continue`.
- `WizardCardRow` (riga 159) rende la firma già dietro `{signature && (…)}`.
- `abilityFor` (`lib/wizardAbilities.ts`) ha già un fallback per-ruolo.

**L'unico punto che va cambiato davvero è la carta-poster.** `WizardCardColumn:353` rende
`<AbilityPlate>` **sempre**, perché `abilityFor` non torna mai `undefined`. Se ogni carta
continua a mostrare una targa, la rarità della targa — cioè tutto il valore di questa onda —
viene distrutta.

**Requisito:** su un mago senza firma la targa oro **non viene renderizzata affatto**
(niente placeholder, niente testo di ruolo: il ruolo è già sul `RoleBadge`). Il fallback
per-ruolo di `abilityFor` diventa quindi codice morto per la carta-poster: o si rimuove, o
resta solo come difesa documentata. Decisione: **`abilityFor` torna `undefined`** per un mago
senza firma e la carta salta il blocco — un solo modo di rappresentare l'assenza.

## 6. Bilanciamento — cosa aspettarsi e come misurarlo

⚠️ **Le firme valgono per entrambi gli schieramenti**: `simulate.ts:148` chiama
`registerSignatures(bus, [...L, ...R])`. Togliere 45 firme indebolisce **anche i nemici**.
L'effetto netto **non è prevedibile a tavolino** e non va assunto.

**Aspettativa da verificare, non da dare per buona:** i nemici pescano più spesso da Tier 3/4
(il roster comune), il player pesca tier-weighted nel draft ma tiene i suoi maghi tutta la run.
Il segno del delta è una domanda aperta.

### ✅ REFERTO — misurato 2026-07-27

A/B sugli stessi 120 seed, stesso commit-base, nessuna costante toccata.

| | PRIMA (60 firme) | DOPO (15 firme) |
|---|---|---|
| `Restricted` winRate | 0.0417 | 0.0500 |
| `Restricted` normalBattlesWon | 98 | **116** (+18%) |
| `Restricted` nodesResolved | 551 | 594 |
| `Restricted` maxDepth a0/1/2 | 87/8/25 | 83/11/26 |
| `campaignBalanceB` winRate | 0.0000 | 0.0000 |
| `campaignBalanceB` maxDepth | 116/2/2 | 116/2/2 (identico) |

**Lettura.** Il winRate non ha risoluzione (5→6 run su 120 = +1 seme; su B è 0.0000 su
entrambi i lati). Il segnale utile è `normalBattlesWon`: **+18%** → il gioco è **un filo più
facile per il bot**. Meccanismo *plausibile ma non verificato*: le firme valgono per entrambi
gli schieramenti e i nemici pescano più spesso dal roster comune di Tier 3/4 — cioè proprio le
45 firme tolte.

**⚠️ Segnale opposto, misurato e non nascosto.** `scudiRigenSweep` dice il contrario per
l'archetipo Scudi-Rigen: battaglie 460→388 (−16%), run che arrivano ad area 1 46→35 (−24%),
ad area 2 32→21 (−34%), winRate 0.008→0.000. Quell'archetipo si appoggiava davvero alle firme
`-10% danni subiti` dei Tassorosso di Tier 4. **Le due cose convivono:** il gioco generico è
appena più facile, un archetipo specifico è più debole. Il gate `winRate > 0` di quello sweep
aveva esaurito la risoluzione (poggiava su 1 vittoria su 120) ed è stato **ri-espresso**, non
svuotato: ora chiede che le run combattano e superino l'area 0 (388 battaglie, 35 run — margine
largo).

**Nessuna ritaratura fatta, in nessuna delle due direzioni.** Decide il playtest.

---

**Protocollo di misura (obbligatorio, A/B sullo stesso commit-base):**
1. `campaignBalanceB` e `campaignBalanceRestricted` **prima** del taglio, annotati.
2. Stesso comando **dopo**, stessi seed.
3. **Lezione dell'Onda 1.e, da non ripetere:** il baseline è valido *solo se* l'harness
   gestisce tutti i nodi in gioco su entrambi i lati. Qui non si tocca nessun tipo di nodo,
   quindi il confronto **è** pulito — ma va dichiarato esplicitamente nel referto.
4. **Nessuna ritaratura preventiva.** Si misura, si scrive il numero, e si decide dopo. La
   regola di progetto *"la difficoltà più cattiva è approvata"* resta valida: se il gioco
   diventa più difficile non si ammorbidisce nulla senza il playtest dell'utente.

## 7. Criteri di accettazione

1. `SIGNATURES` contiene **esattamente 15** voci, quelle di §4 (salvo lo scambio moody/mcgonagall).
2. Tutti e **60 i maghi** restano in `data/wizards.ts`, con casata / ruolo / tag / magia intatti.
3. Nessun test su Duo, Trii o Sinergie cambia comportamento (sono ortogonali alle firme).
4. La carta-poster **non mostra la targa oro** per un mago senza firma; la mostra per i 15.
5. `WizardCardRow` continua a mostrare la firma per i 15 e nulla per gli altri.
6. Suite verde (`npm run test`) e `npm run typecheck` pulito.
7. Referto A/B di bilanciamento scritto con i numeri reali, senza ritaratura.

## 8. Fuori scope (esplicito)

- **Non** si aggiungono firme nuove né si potenziano le 15 sopravvissute. Questa onda è
  **solo sottrazione** — il principio dell'Onda 1.
- **Non** si toccano tag, ruoli, magie, statistiche, tier, né la pesca del draft.
- **Non** si tocca Onda 1.f (reliquie piatte): è la slice successiva, stessa logica.
