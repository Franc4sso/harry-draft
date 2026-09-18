# Showdown — ridisegno del combattimento (HP condiviso, tempo continuo, griglia 3×2)

Data: 2026-09-17
Stato: approvato a sezioni in chat, in attesa di revisione del documento.
Riferimento: Batomon Showdown (berrymint, 2026) — solo il **gameplay di combattimento**. Mappa, draft, reliquie, eventi restano.

## 0. Decisioni prese (in ordine)

| # | Decisione | Scelta |
|---|---|---|
| 1 | Cosa portare da Batomon | **Solo il combat** (HP condiviso, cooldown, trigger, griglia 3×2). Mappa/draft/reliquie restano. |
| 2 | HP condiviso | **Puro**: le unità cadono solo per KO esplicito. |
| 3 | Livello dei maghi | **Ri-draft = merge**: riprendere un mago posseduto = +1 livello. |
| 4 | Persistenza tra battaglie | **Vite** con costo crescente per area. Ogni battaglia parte a HP pieno. |
| 5 | Maghi in campo | **6** (griglia piena). Si parte da 3. |
| 6 | Livello a vittoria (attuale) | **Rimosso**. Il merge sostituisce. Niente snowball automatico. |
| 7 | Abilità | **Tutti i 60 maghi**, non 15. |
| 8 | Nemici in campo | 3–4 / 4–5 / **6** per area. Il pin storico "max 5" nasceva nel turn-based. |
| 9 | Spell | **Segni + reazioni**: ogni spell lascia o consuma un Segno. Combo per casata, per Duo/Trio, per spell. |
| 10 | Crescita | Le spell hanno **Crescendo** (in battaglia) o **Memoria** (nella run, senza cap): motore endless. |
| 11 | Nemici nel tempo | Livello, Memoria simulata e combo garantite crescono per area e per piano endless. |
| 12 | Approccio tecnico | **Motore nuovo a fianco** (`game/engine/rt/`), taglio del vecchio in una slice finale. |

Compatibilità con la stella polare (`2026-06-28-game-design-direction.md`): il combattimento resta **auto-risolto**, nessun input turno per turno. Cambia l'asse (secondi invece di turni) e la leva pre-battaglia (lo schieramento), non il principio "ingegnere di combo, non pilota".

## 1. Modello di combattimento

### 1.1 Tempo

- Simulazione a **tick da 0,1 s**, deterministica, seed come oggi (`rng.fork(depth + 100)`).
- Ogni mago ha un **timer** che sale di 0,1 s a tick. A `timer ≥ cooldown` lancia (`cast`), il timer torna a 0.
- La battaglia è **precalcolata** in eventi con timestamp e riprodotta nella UI a 1×/2×/4×. Il contratto "calcola, poi riproduci" resta.
- **Morte improvvisa** a 30 s: "Maledizione del tempo". Ogni 0,5 s entrambi i lati perdono `HPmax × p`, con `p = 1% + 0,5% × (secondi oltre 30)`. Ignora lo Scudo. Cap assoluto 60 s: vince chi ha % HP più alta, pari → giocatore. Sostituisce la Fatica.

### 1.2 Le quattro stat diventano quattro verbi

Le stat (`hp, atk, def, spd`) restano sui maghi come oggi (range per mago, roll al draft). Cambia cosa alimentano.

| Stat | Verbo | Formula |
|---|---|---|
| `hp` | Contributo all'**HP di squadra** | `HPsquadra = Σ hp_i × levelHpMult(lv_i)` |
| `atk` | **Danno** del cast base | `danno = atk × potenza × levelCastMult(lv) × mod` |
| `spd` | **Cooldown** | `cd = clamp(9 − spd/5, 3, 8) − levelCdBonus(lv) + spellCdMod`, minimo 2 s |
| `def` | **Scudo iniziale** | `⛨0 = Σ def_i × 2` a inizio battaglia, un unico strato per lato |

`levelHpMult = [1, 1,2, 1,4, 1,6]`, `levelCastMult = [1, 1,35, 1,70, 2,10]`, `levelCdBonus = [0, 0, 0,5, 1,0]` per lv 1–4.

`mod` = prodotto dei moltiplicatori attivi sul cast: abilità (Continuo/Al lancio), Indebolito del mago, Vulnerabile del nemico, Trio, archetipi, reliquie (`modifyOutgoingDamage`/`modifyIncomingDamage`), bonus permanenti "A vittoria". Il danno flat (Memoria, "+N danno flat") si somma **dopo** i moltiplicatori.

L'HP max di squadra è fissato all'inizio della battaglia (inclusi i Continui come Hagrid). I KO non lo riducono.

Spd 10 → cd 7 s, spd 30 → cd 3 s. Il veloce lancia più spesso. Niente iniziativa, niente ordine di turno.

### 1.3 Cast

Un cast = la spell del mago (regola UN MAGO UNA MAGIA invariata) tradotta in verbo: **Danno / Cura / Scudo / Status / Carica / Protego / Rianima**.

- **Multicast** = quante volte di fila il cast si risolve in un'attivazione. Base 1. Spell, livelli e abilità lo alzano. I cast multipli si risolvono nello stesso tick, in sequenza.
- **Carica N s** = il timer di un alleato sale di N s (può far scattare il cast nel tick corrente).
- **Innesco** = l'alleato lancia subito, senza toccare il suo timer. Anti-loop: massimo 8 trigger in catena per tick; oltre, il resto della catena è scartato e loggato.
- Ordine di risoluzione nello **stesso tick**: Scudo → Danno → Status → Cura → trigger accodati. Se nello stesso tick entrambi i lati vanno a 0 → vince il giocatore.
- Ordine di iterazione dei maghi in un tick: lato sinistro slot 0→5, poi lato destro slot 0→5. Il RNG è consumato solo da bersagli casuali e da proc percentuali, in questo ordine.

### 1.4 HP condiviso, Scudo, KO

- Una barra per lato. Il Danno rompe prima lo **Scudo**, poi l'HP. La Cura risale l'HP fino al max. Lo Scudo non ha durata, si consuma.
- **Il Veleno ignora lo Scudo** (regola generale; è il contro del Muro).
- I maghi non hanno HP. Cadono solo per **KO**: abilità Carnefice, Avada, effetti boss, Esecuzione a Freddo. Un mago KO smette di lanciare, le sue abilità Continue si spengono, i trigger "Al KO subìto" scattano una volta. L'HP di squadra non cambia. **Rianima** (Rennervate, Narcissa, Neville lv4) rimuove un KO.
- **Protego** (di unità, 1 carica): annulla il prossimo effetto ostile di unità (Gelo, Silenzio, Lentezza, Indebolito, Disarmo, Sospeso, KO).
- **Corrotto** (Marchio Nero assegnato): il contraccolpo delle sue magie oscure ignora lo Scudo di squadra.

### 1.5 Status

**Di squadra** (sul lato nemico, contatori accanto alla barra):

| Status | Segno | Regola |
|---|---|---|
| Bruciatura | 🔥 Fiamma | Ogni 0,5 s: danno `2 × stack`, poi stack −1. Cap 20 stack. |
| Veleno | ☠ Veleno | Ogni 1 s: danno `2 × stack`. **Permanente**, non decade. Ignora lo Scudo. Nessun cap. |
| Scossa | ⚡ Scossa | Ogni Danno diretto subito infligge in più `1 × stack`. Resta finché non è consumata (Deflagrazione) o rimossa. Cap 20. |
| Vulnerabile | — | +15% danno subito. Durata N s, refresh. |

**Di unità** (icona sul token):

| Status | Regola |
|---|---|
| Gelo ❄ | Timer fermo per N s. Refresh (non somma), salvo reazioni che dicono "+1 s". |
| Silenzio | Abilità spenta per N s (il cast base continua). |
| Lentezza | Per N s il timer sale a metà velocità. |
| Indebolito | −X% danno dei suoi cast per N s. |
| Disarmo | Il prossimo cast è saltato (timer azzerato). |
| Sospeso | 3 s: il prossimo Danno con lui come bersaglio-unità vale ×1,5 e applica Lentezza 1 s. |
| Protego | Vedi 1.4. |
| KO | Vedi 1.4. |

Stordimento → Gelo. Esposto/Indebolimento a 3 gradi → Vulnerabile (squadra) / Indebolito (unità). Regen → "ogni 3 s cura N". Crit e schivata **non esistono**.

### 1.6 Trigger

Per abilità, reliquie, Duo, tratti, boss:

| Trigger | Quando |
|---|---|
| All'inizio | t = 0, dopo lo Scudo iniziale, slot 0→5 sinistra poi destra |
| Al lancio | ogni cast del mago (una volta per attivazione, non per Multicast) |
| Continuo | applicato sempre, ricalcolato a ogni cambiamento (KO, adiacenza, soglia) |
| Al KO subìto | il mago va KO |
| Al KO alleato | un altro alleato va KO |
| Al KO nemico | un nemico va KO per opera della squadra |
| Quando un alleato adiacente lancia | |
| Quando la squadra cura | ogni Cura che atterra sul proprio lato |
| Sotto soglia | HP squadra scende sotto X% (una volta per soglia per battaglia) |
| Ogni N s | orologio di battaglia |
| A vittoria | dopo la vittoria: **bonus permanente per la run** |

### 1.7 Fine e risultato

`RtBattleResult = { winner, durata, events, frames, mvpId, koLeft[], koRight[], memoriaDelta, reazioniCount }`.
`mvpId` = mago con più danno + cura + scudo prodotti (score come oggi).

## 2. Griglia, bersagli, schieramento

### 2.1 Griglia

3×2 per lato. Slot 0–2 = **prima fila**, 3–5 = **seconda fila**; la colonna è `slot % 3`. Adiacenza ortogonale (su/giù/sinistra/destra), niente diagonali. **Opposto** = stesso slot sul lato nemico.

La posizione vive sul mago: `DraftedWizard.slot: 0..5`. Persistita nel run, nel `RunLog` endless e nel replay.

### 2.2 Bersagli

- Danno, Cura, Scudo, Segni di squadra: nessun bersaglio-unità.
- Effetti di unità (Gelo, Silenzio, Lentezza, Indebolito, Disarmo, Sospeso, KO) e le clausole "opposto": bersaglio-unità = **opposto**; se vuoto o KO → il più vicino nella stessa riga (colonna adiacente, sinistra prima); se la riga è vuota → casuale tra i vivi.
- **Copertura**: se il bersaglio-unità è in seconda fila e lo slot davanti nella stessa colonna è occupato e vivo, prende lui. La prima fila para gli effetti brutti per chi sta dietro.
- Le clausole "a un nemico casuale" usano il RNG; "a tutti i nemici" no.

### 2.3 Schieramento (schermata nuova)

- Si apre dalla mappa prima di ogni nodo di battaglia e dopo ogni reclutamento/Rinforzo.
- Due griglie affiancate: la tua e quella nemica del nodo (il pacchetto è pre-generato, quindi nota).
- Drag o tap-swap tra slot. Sotto ogni mago, le clausole posizionali dell'abilità che si accendono/spengono spostandolo (verde = si accende, rosa = si spegne, oro = attiva).
- Tab **Reazioni**: le reazioni che la squadra può innescare data la coppia di Segni presenti.
- Pulsante "Combatti". Lo schieramento resta memorizzato per il nodo successivo.
- I nemici sono schierati dal generatore (§6.3).

## 3. Livelli, vite, run

### 3.1 Livelli (merge)

- Tutti a lv1 al draft. Prendere un mago **già posseduto** (Rinforzo) = +1 livello, cap 3.
- Lv4 solo via **Allenamento** (spoglia), **Altare**, evento **Cappello Parlante**.
- Effetto per livello (§1.2): cast ×1/1,35/1,70/2,10 · HP +0/20/40/60% · cd −0/0/0,5/1,0 s · lv4 **riga nuova** dell'abilità. Le abilità hanno numeri propri per lv1–3.
- La **Memoria** delle spell sopravvive al merge.
- Il vecchio livello a vittoria (`levelsPerBattle/Elite/Boss`, `leveledStats`, `growthBudgetPerLevel`, `PendingLevelUp`, `GrowthChoice`, `exp`) **è rimosso**.

### 3.2 Dove trovi le copie

- **Recruit**: 3 candidati. Ogni slot ha il 35% di essere un Rinforzo (mago posseduto con lv < 3), altrimenti un nuovo mago. Cap recruit per area: 1 → **2**.
- **Spoglie** (dopo vittoria normale): 3 carte tra **Marchio** (come oggi), **Allenamento** (+1 lv, anche a 4), **Rinforzo** (copia: +1 lv a un tuo mago con lv < 3), **Vita** (+1 vita, solo se vite < max; sostituisce Ristoro). Il vincolo di offerta "Marchio che completa un Duo garantito" resta.
- A squadra piena (6) reclutare un mago nuovo = **scambio** (il tradeoff della perdita resta, con preview di Duo/Trio/Reazioni perse). Reclutare un Rinforzo non scambia.

### 3.3 Vite

| Regola | Valore |
|---|---|
| Vite iniziali / max | 5 / 5 |
| Costo sconfitta | area 0: 1 · area 1: 2 · area 2: 3 |
| Sconfitta | il nodo è risolto, si avanza (anche boss di area). Niente spoglie, niente Memoria "a vittoria". |
| Boss finale perso | run finita |
| Zero vite | **Fenice**, una volta per run: torni a 1 vita e prendi un evento premio. La seconda volta: run finita. |
| Infermeria | +2 vite (cap max) |
| Fine area | +1 vita |
| Eventi | "cura squadra" → +1 vita · "−25%/−20%/−30% vita" → −1 vita · "Sacrifica il mago più debole" invariato |
| Spoglia Vita | +1 |

`RunState` guadagna `lives`, `livesMax`, `feniceUsed`. `currentHp`, `isDead/livingOf`, `applyBattleToRoster`, `battleReadyTeam` con frazione ferita, cura di fine area, `corrotto` non-curabile: **rimossi**.

### 3.4 Altare, eventi, infermeria

- Altare: costo `maxHp` (−40/−30 HP max a un mago) resta come riduzione permanente del suo `hp`. Costo `wizard`/`relic` invariati.
- Eventi: rimappati in §7.5.
- Infermeria: "+2 vite". Testo nuovo.

## 4. Spell: Segni, reazioni, crescita

### 4.1 Cinque Segni

| Segno | Dove | Casa d'elezione |
|---|---|---|
| 🔥 Fiamma | squadra nemica | Grifondoro |
| ☠ Veleno | squadra nemica | Serpeverde |
| ⚡ Scossa | squadra nemica | Corvonero |
| ❄ Gelo | unità nemica | Corvonero |
| ⛨ Scudo | proprio lato | Tassorosso |

Non esclusivi: ogni casa ha 2–3 "traditori" cross-casa per aprire reazioni anche in mono-casa.

### 4.2 Reazioni (automatiche, annunciate in UI col nome)

| # | Innesco | Nome | Effetto |
|---|---|---|---|
| 1 | 🔥 applicata con ☠ presente, o ☠ con 🔥 presente | **Miasma** | Danno `4 × stack ☠`. Il Veleno resta. |
| 2 | 🔥 con ⚡ presente, o ⚡ con 🔥 | **Deflagrazione** | Consuma entrambi. Danno `5 × (🔥 + ⚡)`. |
| 3 | ☠ con ⚡, o ⚡ con ☠ | **Conduzione** | Per 4 s il Veleno ticka ogni 0,5 s. Non consuma. |
| 4 | Danno con bersaglio-unità ❄ | **Frantuma** | Consuma il Gelo. Quel Danno ×2. ⚡ +2. |
| 5 | 🔥 con bersaglio-unità ❄ | **Vapore** | Consuma il Gelo. Vulnerabile 4 s. |
| 6 | ☠ con bersaglio-unità ❄ | **Necrosi** | ☠ +3. Gelo +1 s. |
| 7 | Cura con ⛨ > 0 | **Baluardo** | Cura +30%. |
| 8 | ⛨ con ≥1 alleato con Protego | **Bastione** | Scudo +50%. |
| 9 | Gelo su unità Lenta | — | Gelo ×1,5 durata. |
| 10 | Silenzio su unità Disarmata, o Disarmo su Silenziata | **Impotente** | Gelo 2 s. |

Reazioni 1–3: scattano una volta per applicazione (non per stack). Reazioni 4–6: una volta per cast, sulla prima risoluzione. Ogni reazione emette un evento `reazione` con nome, per la UI e per i contatori di Memoria.

Combo per casata gratis: Grif+Serp = Miasma · Grif+Corv = Deflagrazione/Vapore · Serp+Corv = Conduzione/Necrosi · Tass+chiunque = Baluardo/Bastione.

### 4.3 Crescita

- **Crescendo**: contatore di battaglia, si azzera a fine scontro.
- **Memoria**: contatore per (mago, spell) nella run, `DraftedWizard.memoria: Record<string, number>`. Sopravvive al merge. Mostrato sulla carta ("Sectumsempra +14"). **Senza cap** dove indicato: è il motore endless.
- Regola di catalogo: ~1/3 Memoria senza cap, ~1/3 Crescendo, ~1/3 nessuna crescita con numeri base ×1,2 ("sicure").

### 4.4 Catalogo spell (37)

Potenza = moltiplicatore di `atk`. Cura/Scudo = valori flat (scalano col livello del mago via `levelCastMult`). `cd` = modificatore al cooldown del mago.

**Applicatori**

| id | Nome | Verbo | Segno | Combo | Crescita |
|---|---|---|---|---|---|
| incendio | Incendio | Danno 1,2 | 🔥 +3 | — | Crescendo: 🔥 +1 per cast precedente in battaglia |
| confringo | Confringo | Danno 1,9 | 🔥 +2 | — | Memoria: 🔥 +1 ogni 5 Deflagrazioni (no cap) |
| fiendfyre | Ardemonio | Danno 2,8, cd +1 | 🔥 +5 | magieOscure | Crescendo: dopo il cast la 🔥 non decade per 2 s |
| serpensortia | Serpensortia | Danno 0,45 | ☠ +2 | — | Memoria: ☠ +1 ogni 3 Miasma (no cap) |
| oppugno | Oppugno | Danno 1,5 | ☠ +1 | — | Crescendo: ☠ +1 ogni 2 cast |
| crucio | Crucio | Danno 0,8 | ⚡ +3 | — | Crescendo: ⚡ +1 per cast consecutivo senza subire Gelo |
| baubillious | Baubillious | Danno 1,4 | ⚡ +2 | — | Memoria: ⚡ +1 ogni 5 Frantuma (no cap) |
| fulgari | Fulgari | Status | ⚡ +2 | Lentezza 1,5 s all'opposto | — (base ⚡ +2 → +3 come "sicura") |
| glacius | Glacius | Status | ❄ 2,4 s | — | — (sicura) |
| petrificus | Petrificus Totalus | Status | ❄ 1,8 s | Lentezza 1 s | — (sicura) |
| stupeficium | Stupeficium | Danno 1,6 | ❄ 1 s | — | Memoria: ❄ +0,1 s per vittoria (cap 2 s) |
| imperio | Imperio | Status, cd +1 | ❄ 2,5 s | — | Crescendo: ogni 2° cast anche Silenzio 2 s |

**Detonatori**

| id | Nome | Verbo | Combo | Crescita |
|---|---|---|---|---|
| reducto | Reducto | Danno 1,8 | Frantuma ×2,5 invece di ×2 | Memoria: +10% danno per Frantuma (no cap) |
| diffindo | Diffindo | Danno 0,7 ×2 (Multicast 2) | ogni colpo su squadra con ⚡ → ⚡ +1 | Crescendo: +1 colpo ogni 3 cast |
| bombarda | Bombarda | Danno 2,4 | 🔥 +1 | — (sicura) |
| avada | Avada Kedavra | Danno 3,2, cd +2, magieOscure | HP nemica < 25% → KO opposto | Memoria: cd −0,3 s per KO fatto (min 3 s) |
| sectumsempra | Sectumsempra | Danno 2,4, magieOscure | Vulnerabile 2 s | Memoria: +1 danno flat per vittoria (no cap) |
| expelliarmus | Expelliarmus | Danno 1,4 | Disarmo; se entro 2 s da un Gelo alleato → Silenzio 2 s | Memoria: +1 danno flat per Disarmo riuscito (no cap) |
| levicorpus | Levicorpus | Danno 0,5 | Sospeso 3 s | Crescendo: Sospeso +0,5 s per cast |
| tarantallegra | Tarantallegra | Status | Lentezza 2 s; su squadra con ⚡ → anche Gelo 1 s | — (sicura: Lentezza 2,4 s) |
| confundo | Confundo | Status | Lentezza 1,5 s + Vulnerabile 2 s | Memoria: Vulnerabile +0,2 s per vittoria (no cap) |
| langlock | Langlock | Status | Silenzio 3 s | Crescendo: +0,5 s per cast |
| silencio | Silencio | Status | Silenzio 2 s + Indebolito 20% 3 s | — (sicura: 2,4 s) |
| flipendo | Flipendo | Danno 1,1, cd −1 | Lentezza 1 s | Crescendo: +5% danno per cast (no cap in battaglia) |

**Sostegno**

| id | Nome | Verbo | Combo | Crescita |
|---|---|---|---|---|
| episkey | Episkey | Cura 34 | — | — (sicura) |
| vulnera | Vulnera Sanentur | Cura 48 | Baluardo ×2 (+60%) | Memoria: +4 cura per vittoria (no cap) |
| anapneo | Anapneo | Cura 26 | Purifica un alleato adiacente (rimuove 1 status di unità) | — (sicura) |
| aguamenti | Aguamenti | Cura 18 + ⛨ 10 | Rimuove 🔥 dalla propria squadra | Memoria: +2 cura per battaglia (no cap) |
| ferula | Ferula | Cura 17 + ⛨ 18 | — | — (sicura) |
| fianto | Fianto Duri | ⛨ 48 | — | — (sicura) |
| aegis | Aegis | ⛨ 60, cd +1 | — | Memoria: +5 ⛨ per battaglia combattuta (no cap) |
| protego | Protego | Protego | all'alleato adiacente senza Protego, altrimenti sé | — |
| protego_maxima | Protego Maxima | Protego a tutti, cd +3 | — | Memoria: cd −0,5 s per boss battuto |
| incitamento | Incitamento | Cura 8 | Carica 1 s all'alleato davanti o dietro | Crescendo: Carica +0,25 s per cast |
| salvio | Salvio Hexia | Carica | 0,5 s a tutti gli adiacenti | Memoria: +0,05 s per vittoria (no cap) |
| expecto | Expecto Patronum | ⛨ 30 | Carica 1 s agli adiacenti | Crescendo: Carica +0,25 s per cast |
| rennervate | Rennervate | Rianima, cd +4 | rimuove il KO dell'alleato con slot più basso; se nessuno: Cura 20 | — |
| riddikulus | Riddikulus | Buff | +15% danno alla squadra per il resto della battaglia (max 3) | — |

`base_attack`, `hitChance`, `priority`, `crit`, `dodge`: **rimossi**.

### 4.5 Riassegnazione mago → spell

Regola: ogni casa ha ≥2 applicatori del proprio Segno, ≥2 detonatori, ≥1 sostegno, 2–3 traditori cross-casa. Ruolo → verbo: Attaccante = Danno, Tank = Scudo, Supporto = Cura/Carica/Rianima, Controllo = Status.

| Mago | Ruolo | Spell | Nota |
|---|---|---|---|
| **Grifondoro** | | | 🔥 seamus, dean · ❄ dumbledore, sirius (traditori) |
| harry | Att | expelliarmus | detonatore, combo con Gelo alleato |
| dumbledore | Ctrl | petrificus | ❄ |
| mcgonagall | Tank | protego_maxima | |
| sirius | Att | stupeficium | ❄ |
| lupin | Sup | expecto | ⛨ + Carica |
| moody | Tank | aegis | |
| hermione | Ctrl | confundo | |
| ron | Tank | protego | |
| ginny | Att | reducto | Frantuma |
| neville | Tank | fianto | |
| fred | Ctrl | tarantallegra | |
| george | Att | diffindo | |
| molly | Sup | episkey | |
| arthur | Sup | incitamento | Carica |
| hagrid | Tank | fianto | |
| seamus | Att | incendio | 🔥 |
| dean | Att | confringo | 🔥 |
| parvati | Ctrl | levicorpus | |
| lavender | Sup | anapneo | |
| **Serpeverde** | | | ☠ draco, blaise · ⚡ bellatrix · ❄ lucius · 🔥 dolohov (traditori) |
| voldemort | Att | avada | KO |
| snape | Att | sectumsempra | |
| bellatrix | Ctrl | crucio | ⚡ |
| lucius | Att | imperio | ❄ (Controllo di fatto) |
| draco | Att | serpensortia | ☠ |
| narcissa | Sup | vulnera | |
| dolohov | Att | bombarda | 🔥 → Miasma in mono-Serp |
| greyback | Tank | fianto | |
| slughorn | Sup | anapneo | |
| pansy | Ctrl | langlock | |
| goyle | Tank | fianto | |
| crabbe | Tank | aegis | |
| marcus | Att | reducto | Frantuma |
| pettigrew | Sup | rennervate | |
| theodore | Ctrl | silencio | |
| blaise | Att | oppugno | ☠ |
| astoria | Sup | episkey | |
| **Corvonero** | | | ⚡ flitwick, michael · ❄ cho, terry · 🔥 fleur (traditrice) |
| kingsley | Tank | aegis | |
| fleur | Att | incendio | 🔥 |
| viktor | Att | reducto | |
| luna | Sup | aguamenti | |
| cho | Ctrl | glacius | ❄ |
| flitwick | Ctrl | fulgari | ⚡ |
| padma | Ctrl | levicorpus | |
| terry | Ctrl | petrificus | ❄ |
| michael | Att | baubillious | ⚡ |
| roger | Tank | fianto | |
| marietta | Sup | anapneo | |
| anthony | Tank | protego | |
| penelope | Sup | incitamento | |
| **Tassorosso** | | | ⛨ sprout, ernie, eloise · ❄ megan, cedric (traditori) |
| tonks | Ctrl | confundo | |
| cedric | Att | stupeficium | ❄ |
| sprout | Sup | ferula | ⛨ |
| hannah | Sup | episkey | |
| susan | Sup | rennervate | |
| ernie | Tank | protego | |
| justin | Att | flipendo | |
| zacharias | Ctrl | langlock | |
| leanne | Ctrl | tarantallegra | |
| eloise | Tank | fianto | |
| megan | Ctrl | petrificus | ❄ |

Il whitelist `lib/roleSpellPools.ts` viene riscritto su questa tabella.

## 5. Abilità (60)

### 5.0 Budget di potere per rarità

La rarità (`tier` 1–4) è potere, non solo probabilità di apparire. Vale per stat (già oggi), spell assegnata, abilità e combo.

| Tier | Righe lv1 | Condizione | Numeri | Lv4 |
|---|---|---|---|---|
| 1 Leggendario | 2, entrambe incondizionate | — | ×1,0 | cambia la partita (Protego a tutti, Multicast, Carica di squadra) |
| 2 Epico | 2, una può essere condizionata | lore o posizione | ×0,85 | forte |
| 3 Raro | 1–2; la seconda sempre condizionata | lore o posizione | ×0,75 | media |
| 4 Comune | 1, spesso condizionata o stretta | lore o posizione | ×0,6 | modesta |

Regole:
- Un Comune non può avere una riga incondizionata più forte della riga condizionata di un Raro della stessa famiglia (es. ⛨ iniziale: Comune ≤ 45, Raro ≤ 60, Epico ≤ 80 a lv3).
- I detonatori di KO (Voldemort, Moody, Bellatrix lv4, Molly lv4) stanno solo su tier ≤ 3 e sempre con soglia.
- Le spell "no cap" (Memoria infinita) sono distribuite su tutti i tier, ma i tier alti hanno il `per` più alto (Sectumsempra +1, Flipendo +5%).
- Una combo (catena §5, coppia di Segni, Duo) non deve dipendere da un solo Comune: ogni catena ha almeno un tier ≤ 2 come perno.

Verifica: statica al design (questa tabella) e **empirica** nell'harness (§8.5: `tierOrdering`, `comboBalance`, `inclusionDelta`).

**Cooldown delle righe "Al lancio" (regola utente, 2026-09-18).** Un mago lancia molte volte per battaglia, quindi ogni riga con trigger **Al lancio** (e ogni Combo di spell che scatta al lancio) dichiara un **cooldown in secondi** (`limit.everySeconds`): la riga scatta al primo lancio e poi solo quando il cooldown è passato. Valori di riferimento: 2–4 s per effetti piccoli (+Segno, Carica ≤1 s), 6–10 s per effetti grossi (KO, Innesco, Multicast, Silenzio ≥2 s); i tier alti hanno cooldown più corti a parità di effetto. Il motore lo supporta già (`AbilityLine.limit.everySeconds`, Task 9 del Piano 1); il Piano 2 lo rende obbligatorio con un test di validazione dati (`ogni riga 'lancio' ha everySeconds > 0`) e i numeri di §5 vanno completati con il cooldown per riga.

Formato: **Nome** — Trigger: effetto con numeri `[lv1/lv2/lv3]`. **Lv4:** riga aggiuntiva. "Adiacente" = ortogonale. "In squadra" = presente e non KO. I tag lore (Weasley, ES, Ordine, Mangiamorte, Malandrini, Trio) e il tier sono quelli di `data/wizards.ts` (T1: harry, dumbledore, voldemort · T2: snape, bellatrix, mcgonagall, sirius, lupin, moody, lucius, kingsley, fleur, viktor · T3: hermione, ron, draco, ginny, neville, luna, fred, george, molly, arthur, tonks, narcissa, dolohov, greyback, cho, cedric, slughorn, hagrid, flitwick, sprout · T4: il resto).

### Grifondoro

| Mago | Abilità |
|---|---|
| harry | **Coraggio del Grifondoro** — Al lancio: +[50/75/100]% danno se un alleato adiacente ha lanciato negli ultimi 2 s. A vittoria: +[2/3/4] danno flat permanente a Ron e Hermione se in squadra. **Lv4:** Sotto 50% HP squadra: Multicast +1. |
| dumbledore | **Bacchetta di Sambuco** — All'inizio: Gelo [1,5/2/2,5] s a tutta la prima fila nemica. Al lancio: Carica [0,5/0,75/1] s a tutti gli alleati. **Lv4:** Al lancio: Protego a tutti gli alleati (una volta per battaglia). |
| mcgonagall | **Trasfigurazione Marziale** — All'inizio: ⛨ pari a [2/3/4]× la sua def. Continuo: il primo KO subìto dalla squadra è annullato. **Lv4:** Ogni 10 s: ⛨ +50. |
| sirius | **Fuga da Azkaban** — Al lancio: se un Malandrino è in squadra, Carica [1/1,5/2] s a sé. Al KO nemico: Multicast +1 per 5 s. **Lv4:** Al KO nemico: Innesco di Lupin se in squadra. |
| lupin | **Furia Lupesca** — Sotto 50% HP squadra: Multicast +1 e +[30/45/60]% danno. **Lv4:** Sotto 25%: la squadra è immune al Gelo. |
| moody | **Vigilanza Costante** — All'inizio: Protego a tutta la prima fila. Al KO alleato: KO all'opposto ([1/2/3] volte per battaglia). **Lv4:** All'inizio: Protego anche alla seconda fila. |
| hermione | **Mente Brillante** — Al lancio: Carica [0,75/1/1,25] s all'alleato davanti. Ogni 3° lancio: Silenzio 2 s all'opposto. **Lv4:** Le Lentezze della squadra durano il doppio. |
| ron | **Scacchi Magici** — All'inizio: Protego agli adiacenti. ⛨ iniziale +[30/45/60] per Weasley in squadra. **Lv4:** Al KO subìto: Innesco di tutti gli adiacenti. |
| ginny | **Fattura Mocciovolante** — Al lancio: Multicast +1 se un Weasley adiacente. A vittoria: +[3/4/5] danno flat permanente. **Lv4:** Frantuma anche su bersaglio Lento (senza Gelo). |
| neville | **Coraggio Tardivo** — Al KO alleato: +[40/60/80]% danno a tutti gli ES per il resto della battaglia. All'inizio: Protego a sé. **Lv4:** Al lancio: Rianima un alleato (una volta per battaglia). |
| fred | **Tiro Mancino** — Al lancio: se George è in squadra, Innesco di George (max 1 ogni [4/3/2] s). **Lv4:** Ogni Innesco di George: 🔥 +2. |
| george | **Scherzo Ustionante** — Al lancio: se Fred è in squadra, Innesco di Fred (max 1 ogni [4/3/2] s). **Lv4:** Ogni Innesco di Fred: ⚡ +2. |
| molly | **Istinto Materno** — Al lancio: Cura +[10/15/20] per Weasley in squadra. Quando la squadra cura: ⛨ +[10/15/20]. **Lv4:** Al KO di un Weasley: KO all'opposto. |
| arthur | **Officina Weasley** — Al lancio: Carica [0,5/0,75/1] s a tutti i Weasley. **Lv4:** Carica anche gli adiacenti non Weasley. |
| hagrid | **Cuore di Mezzogigante** — Continuo: HP di squadra +[10/15/20]%. All'inizio: ⛨ +40. **Lv4:** Al KO subìto: ⛨ +150. |
| seamus | **Esplosione Facile** — Al lancio: 🔥 +[1/2/3]; 25%: esplode, 🔥 +2 anche alla propria squadra. **Lv4:** L'esplosione fa anche Danno 1,0 al nemico. |
| dean | **Tifoso** — Continuo: +[15/25/35]% danno se Seamus adiacente. **Lv4:** Continuo: +15% danno per ogni Grifondoro adiacente. |
| parvati | **Divinazione Gemella** — Continuo: se Padma è in squadra, entrambe cd −[0,5/0,75/1] s. **Lv4:** Al lancio: Sospeso anche a un secondo nemico casuale. |
| lavender | **Won-Won** — Al lancio: Cura +[10/15/20] se Ron è adiacente. **Lv4:** Quando Ron va KO: Cura 80. |

### Serpeverde

| Mago | Abilità |
|---|---|
| voldemort | **Terrore Immortale** — Al lancio: KO l'opposto se HP nemica < [30/35/40]%. A vittoria: +[5/7/10]% danno permanente ai Mangiamorte. **Lv4:** Al KO nemico: Carica 2 s a tutti i Mangiamorte. |
| snape | **Pozioni Letali** — Al lancio: ☠ +[2/3/4]. Al KO nemico: ☠ +[4/6/8]. **Lv4:** Le Vulnerabili della squadra durano il doppio. |
| bellatrix | **Tortura Cruciatus** — Continuo: le sue ⚡ valgono +[50/75/100]% se un Mangiamorte adiacente. Al lancio: 30% Gelo 1 s. **Lv4:** I Frantuma fatti da lei → KO se HP nemica < 40%. |
| lucius | **Denaro e Influenza** — All'inizio: Carica [1/1,5/2] s a tutti i Mangiamorte. Al lancio: Vulnerabile 3 s. **Lv4:** Al lancio: Lentezza 2 s a tutta la prima fila nemica. |
| draco | **Orgoglio Malfoy** — Al lancio: ☠ +[1/2/3] se un Serpeverde adiacente. A vittoria: +[3/4/5] danno flat permanente. **Lv4:** Se Goyle o Crabbe in squadra: Protego a sé all'inizio. |
| narcissa | **Amore di Madre** — Quando la squadra cura: ⛨ pari a [30/45/60]% della cura. Al lancio: Rianima un Mangiamorte (una volta per battaglia). **Lv4:** Draco non può subire KO. |
| dolohov | **Maledizione Viola** — Al lancio: se il nemico ha ☠, 🔥 +[2/3/4]. **Lv4:** I Miasma innescati da lui fanno ×1,5. |
| greyback | **Morso del Lupo** — All'inizio: ☠ +[1/2/3] per alleato Veleno. Al KO nemico: ⛨ +40. **Lv4:** Al lancio: ☠ +2. |
| slughorn | **Lumaclub** — Al lancio: Cura 22 e ☠ +[1/2/3] al nemico. **Lv4:** Cura +10 per ogni mago di tier ≤ 2 in squadra. |
| pansy | **Pettegolezzo** — Continuo: i suoi Silenzi applicano ☠ +[1/1/2]. **Lv4:** Silenzio anche all'adiacente del bersaglio. |
| goyle | **Guardia del Corpo** — ⛨ iniziale +[25/35/45]; +20 se Draco in squadra. **Lv4:** Gli effetti di unità diretti a Draco vanno a Goyle. |
| crabbe | **Guardia del Corpo** — ⛨ iniziale +[25/35/45]; +20 se Draco in squadra. **Lv4:** Al KO subìto: ⛨ +100. |
| marcus | **Capitano Brutale** — Al lancio: Danno ×[1,25/1,4/1,55] se HP nemica < 50%. **Lv4:** Al KO nemico: Multicast +1 per il resto della battaglia (max 3). |
| pettigrew | **Codardo** — All'inizio: Protego a sé. Al KO subìto: Innesco di tutti i Mangiamorte [/ + Carica 1 s / + Carica 2 s]. **Lv4:** Al KO subìto: torna in gioco dopo 5 s. |
| theodore | **Ombra Silente** — Al lancio: se il bersaglio è Silenziato, ☠ +[3/4/5]. **Lv4:** I Silenzi della squadra durano +50%. |
| blaise | **Distacco** — Continuo: +[10/15/20]% danno se nessun alleato è adiacente (lupo solitario). **Lv4:** Al lancio (ogni 4 s): ☠ +2 se la squadra ha slot vuoti o KO. |
| astoria | **Cura Discreta** — Al lancio: Cura +[8/12/16] per Serpeverde in squadra. **Lv4:** Quando cura: Purifica un alleato. |

### Corvonero

| Mago | Abilità |
|---|---|
| kingsley | **Pugno dell'Auror** — Al lancio: Lentezza [2/2,5/3] s all'opposto. Continuo: alleati dell'Ordine +[20/30/40]% ⛨ prodotto. **Lv4:** All'inizio: Protego a tutti gli alleati dell'Ordine. |
| fleur | **Fascino Veela** — Al lancio: 30% Disarmo all'opposto. Continuo: 🔥 +1 per cast se un Corvonero adiacente. **Lv4:** I suoi Vapori applicano anche Gelo 1 s. |
| viktor | **Bulgaro d'Acciaio** — Al lancio: Danno ×[1,3/1,5/1,7] se nessun alleato adiacente ha lanciato negli ultimi 2 s. **Lv4:** Frantuma ×3. |
| luna | **Serenità** — Ogni 4 s: Cura [10/15/20]. Quando cura: Purifica un alleato adiacente. **Lv4:** La squadra è immune al Silenzio. |
| cho | **Lacrime Gelide** — Al lancio: se l'opposto è già Gelato, Danno 1,5 (Frantuma ×[2/2,5/3]). **Lv4:** Al lancio: Gelo anche all'adiacente del bersaglio. |
| flitwick | **Maestro d'Incantesimi** — Al lancio: Carica [0,5/0,75/1] s a tutti i Corvonero. Ogni 3° lancio: Gelo 1 s all'opposto. **Lv4:** Carica a tutta la squadra. |
| padma | **Divinazione Gemella** — Continuo: se Parvati è in squadra, entrambe cd −[0,5/0,75/1] s. **Lv4:** Sospeso dura +2 s. |
| terry | **Analisi** — Ogni [3/2/2] cast della squadra Corvonero: ⚡ +[1/1/2]. **Lv4:** E Vulnerabile 1 s. |
| michael | **Precisione** — Al lancio: se il nemico ha ⚡ ≥ 3, Danno ×[1,2/1,3/1,4]. **Lv4:** Le Deflagrazioni lasciano ⚡ +2. |
| roger | **Capitano Corvonero** — ⛨ iniziale +[25/35/45]. **Lv4:** Continuo: +10% danno alla sua riga. |
| marietta | **Spifferona** — Al lancio: Vulnerabile [1/1,5/2] s. **Lv4:** Al lancio: Silenzio 1 s all'opposto. |
| anthony | **Prefetto** — All'inizio: ⛨ +[25/35/45]. **Lv4:** Continuo: gli adiacenti subiscono Gelo −50% durata. |
| penelope | **Prefetta** — Al lancio: Carica [0,5/0,75/1] s all'alleato davanti. **Lv4:** Carica anche all'alleato dietro. |

### Tassorosso

| Mago | Abilità |
|---|---|
| tonks | **Riflessi Mutanti** — Continuo: cd −[15/20/25]% per ogni membro dell'Ordine adiacente. **Lv4:** All'inizio: Carica 2 s a sé. |
| cedric | **Campione di Hogwarts** — Al lancio: ⛨ +[15/20/25]. Continuo: +[20/30/40]% danno finché la squadra ha ⛨. **Lv4:** Al KO subìto: ⛨ +100 e Cura 50. |
| sprout | **Serra** — Continuo: ogni 1 s Cura [3/4/5] se un Tassorosso adiacente. Al lancio: ⛨ +[15/20/25]. **Lv4:** Ogni 5 s: rimuove ☠ dalla propria squadra (Mandragola). |
| hannah | **Tenacia** — Al lancio: Cura +[10/15/20] per Tassorosso in squadra. **Lv4:** Baluardo ×2. |
| susan | **Memoria dei Caduti** — Al lancio: ⛨ +[20/30/40] se ha Rianimato. Al KO alleato: Carica 2 s a sé. **Lv4:** Rennervate rimuove tutti i KO. |
| ernie | **Prefetto Zelante** — Al lancio (Protego): ⛨ +[15/20/25]. **Lv4:** Bastione ×2. |
| justin | **Nato Babbano** — Crescendo: +[5/8/10]% danno per cast in questa battaglia. **Lv4:** Una volta per battaglia: Multicast +1 per 6 s. |
| zacharias | **Lingua Lunga** — Continuo: i nemici Silenziati fanno −[10/15/20]% danno. **Lv4:** Silenzio anche all'adiacente del bersaglio. |
| leanne | **Amica Fedele** — Continuo: mentre la prima fila nemica ha almeno un Lento, il nemico subisce +[10/15/20]% danno. **Lv4:** Le Lentezze della squadra durano +50%. |
| eloise | **Pelle Dura** — ⛨ iniziale +[25/35/45]. **Lv4:** Continuo: la squadra subisce −8% danno mentre ha ⛨. |
| megan | **Gelo Tassorosso** — Continuo: i Gelo della squadra durano +[0,3/0,5/0,7] s. **Lv4:** Necrosi ×2. |

### Catene attese (per i test di copertura)

- **Weasley-motore**: Arthur carica → Fred/George si innescano a vicenda → Ginny Multicast → Molly cura scalata + scudo → Ron Protego.
- **Trio d'oro**: Hermione carica Harry davanti → Harry +50% → a vittoria nutre entrambi.
- **Mangiamorte-KO**: Lucius carica → Bellatrix ⚡ → Voldemort KO sotto 30% → Pettigrew al KO innesca tutti.
- **Gelo-frantuma**: Dumbledore/Flitwick/Cho/Terry gelano → Reducto/Viktor Frantuma → Esecuzione a Freddo KO.
- **Tassorosso-muro**: Ernie/Eloise scudo → Cedric +50% → Muro Vivente riflette → Sprout rigenera.
- **Veleno**: Draco/Blaise/Snape stack → Dolohov Miasma → Cancrena sotto 40% → Untore su ogni cura → Conduzione con Bellatrix.
- **Corvonero-deflagrazione**: Michael/Flitwick ⚡ → Fleur 🔥 → Deflagrazione → Terry ricarica ⚡.

## 6. Squadra: Duo, Trio, archetipi, nemici

### 6.1 Duo (6, segnali invariati)

| Duo | Segnali | Effetto nuovo |
|---|---|---|
| Cancrena | veleno + esecuzione | Il Veleno fa danno doppio mentre l'HP nemica è < 40%. |
| Miasma (Duo) | veleno + magieOscure | Ogni KO nemico: ☠ +3. Rinominato **Contagio** per non collidere con la reazione Miasma. |
| Untore | veleno + supporto | Ogni Cura della squadra: ☠ +1. |
| Muro Vivente | scudirigen + taunt | Finché la squadra ha ⛨, riflette il 50% del danno assorbito dallo Scudo. |
| Esecuzione a Freddo | esecuzione + controllo | Gelo applicato a un nemico mentre l'HP nemica è < 50% → KO. Leader boss immune. |
| Mietitore | esecuzione + magieOscure | Ogni KO nemico: +6 danno flat a chi ha fatto il KO (max 3 stack) per il resto della battaglia. |

Il segnale `taunt` (1 Tank) resta come segnale di composizione. Grado 2 (3 maghi con tag) → keyword mult +50% come oggi.

### 6.2 Trio di casa (gate: ≥1 Duo attivo e ≥3 vivi della casa; grado 1 con 4+)

| Casa | Grado 0 | Grado 1 |
|---|---|---|
| Grifondoro | La 🔥 non decade | E 🔥 +1 per cast |
| Serpeverde | Ogni cast: ☠ +1 | ☠ +2 |
| Corvonero | Ogni cast: ⚡ +1 | ⚡ +2 |
| Tassorosso | ⛨ iniziale ×1,5 | ×2 |

### 6.3 Archetipi (tier 2 dei segnali)

| Tag | Nome | Effetto grado 2 |
|---|---|---|
| veleno | Tossicità | Veleno +50%; Conduzione dura 8 s. |
| esecuzione | Carnefice | Ogni KO nemico: la soglia delle clausole "HP nemica < X%" della squadra sale di +5% (cap +25%). |
| scudirigen | Muro | Scudo prodotto +50%; la cura in eccesso oltre l'HP max diventa ⛨ (35%). |
| magieOscure | Patto Oscuro | Magie oscure +30% danno; contraccolpo 20% sul proprio HP (ignora lo Scudo se Corrotto). |

### 6.4 Nemici: generazione

- Stesso roster, stesse spell, stesse abilità, stessi Duo/Trio/archetipi (`rightDuos` già esiste).
- Numero: normale area 0: 3 · elite area 0: 4 · area 1: 4–5 · area 2: 5–6 · boss finale: 6. `enemyCountByArea = [4, 5, 6]`, `normalEnemyCount = [3, 4, 5]`.
- Livello: area 0: 1–2 · area 1: 2–3 · area 2: 3–4 · boss +1 (cap 4). Elite = livello massimo della banda.
- **Memoria simulata**: ogni spell nemica parte con `memoria = round(k × livelloArea)`, `k` = 2 per area, in unità della propria Memoria (es. Sectumsempra +2 danno in area 1). Endless: `k = 2 + 0,5 × piano`.
- **Combo garantite** (il generatore prova fino a 24 volte, poi accetta): area 0 = un Segno solo; area 1 = due Segni → ≥1 reazione possibile, ≥1 clausola posizionale soddisfatta; area 2 = due Segni + un Duo + un Trio.
- **Schieramento nemico**: Tank e maghi con "prima fila" davanti; Supporto e Controllo dietro; le clausole "dietro/davanti/adiacente" soddisfatte dove possibile; il resto per slot crescente.
- `capSupporto` (≤1) e `ensureOffense` restano. `powerOf` → `teamScore` (§8.2).

### 6.5 Boss scriptati

| Boss | Area | Unità | Meccanica |
|---|---|---|---|
| Il Muro / Marcus | 0 | 3 | ⛨ iniziale ×3, Bastione sempre attivo. Contro telegrafato: il Veleno ignora lo Scudo. |
| Bellatrix / Dolohov | 1 | 5 | Squadra ⚡ + ❄ (Frantuma). Il leader ha cd −1 s. |
| Voldemort / Lucius | 2 | 6 | Sei Mangiamorte, catena KO; `+20%` a tutte le stat; leader immune a KO; Avada e Ardemonio forzati. |

`hpMult` diventa moltiplicatore dell'`hp` del leader (contributo alla barra). `unitDamageReduction` e `ignoresTaunt`: **rimossi**.

## 7. Remap del resto

### 7.1 Reliquie: mappa degli hook

| Vecchio | Nuovo |
|---|---|
| `+atk / +def / +spd / +hp` | invariati (le stat esistono ancora) |
| `allPct` | invariato |
| `onBattleStart` | All'inizio |
| `onTurnStart` / `onTurnEnd` | Ogni 3 s |
| `onHit` (attore che colpisce) | Al lancio con verbo Danno |
| `onHeal` | Quando la squadra cura |
| `onDeath` / `onAllyDeath` | Al KO subìto / Al KO alleato |
| `onHpThreshold` (unità) | Sotto soglia HP squadra |
| `modifyOutgoing/Incoming/Healing` | invariati (moltiplicatori) |
| `scaling.trigger 'kill'` | Al KO nemico |
| `scaling.trigger 'turn'` | Ogni 5 s di battaglia |
| `scaling.trigger 'allyDead'` | Al KO alleato |
| `conditional.teamSizeBelow N` | maghi non KO < N |
| `Rigenerazione +N` | Cura N ogni 3 s |
| `grantsExecute {threshold, bonus}` | +bonus danno mentre HP nemica < threshold |
| `grantsAlwaysHit` (Occhio Magico) | **Ignora la Copertura**: gli effetti di unità colpiscono il bersaglio scelto |
| `grantsShieldConvert` | cura in eccesso → ⛨ |
| `grantsDarkMagic` | invariato; contraccolpo sull'HP proprio |
| `active: 'revive'` (Lacrime di Fenice) | Consumabile: **+3 vite** |
| `shield N` all'inizio | ⛨ +N |
| status `atkUp` 2 turni | +20 atk per 6 s |

Testi da riscrivere: Ricordella, Pietra della Resurrezione, Coppa di Tassorosso, Furia Morente, Canto del Cigno, Assalto d'Apertura (→ "nei primi 6 s"), Marcia di Guerra (→ ogni 5 s), Eredità dei Caduti (→ per KO alleato), Ultimo Baluardo, Branco Ristretto, Sete di Sangue (→ −6 cura ogni 3 s), Lacrime di Fenice, Occhio Magico, Egida del Tasso, Specchio delle Emarb.

### 7.2 Tratti shiny (16)

| Tratto | Nuovo |
|---|---|
| Esecuzione | +50% danno mentre HP nemica < 30% |
| Furia | +danno pari al % HP squadra mancante × 0,6 |
| Roccia | Continuo: la squadra subisce −5% danno |
| Sifone | Al lancio: Lentezza 1 s all'opposto |
| Benedizione | Quando la squadra cura: ⛨ +25 |
| Pietrificazione | Al lancio: 30% Gelo 1 s |
| Bavaglio | Al lancio: 30% Silenzio 2 s |
| Disarmo | Al lancio: 30% Disarmo |
| Logoramento | Al lancio: 40% Indebolito 25% 3 s |
| Ferocia | Al lancio: +6 danno flat per il resto della battaglia (max 5) |
| Rigenerazione | Ogni 3 s: Cura 12 |
| Anticipo | All'inizio: Carica 2 s a sé |
| Crescendo | Ogni 3 s: +6 atk |
| Vendetta | Al KO alleato: +30 atk |
| Frantumazione | Al lancio: 50% Vulnerabile 2 s |
| Gelo | Al lancio: 25% Gelo 2 s |

### 7.3 Spoglie

Marchio (invariato) · Allenamento (+1 lv, anche a 4) · Rinforzo (+1 lv a un mago con lv < 3) · Vita (+1, se vite < max). Ristoro rimosso. Offerta: 3 carte, Marchio-che-completa garantito, Vita mai se vite = max, Rinforzo mai se nessun mago < lv3.

### 7.4 Infermeria, fine area, Altare

Infermeria: +2 vite. Fine area: +1 vita. Altare: invariato salvo il testo dei costi `maxHp`.

### 7.5 Eventi (8)

| Evento | Nuovo |
|---|---|
| Cappello Parlante | "mago più debole +2 livelli" → **il mago con lv più basso sale di 1 (anche a 4)** · "cura 15%" → +1 vita |
| Scambista | invariato (scambia il più debole per uno nuovo lv2) |
| Coppa Maledetta | 60% reliquia rompi-regole · 40% **−1 vita** |
| Patto | invariato |
| Fonte Incantata | 30 🍫 → **+2 vite** |
| Ombra Danzante | 50% reliquia · 50% **−1 vita** |
| Voto Infrangibile | invariato |
| Patto della Fame | +10% stat · **−1 vita** |
| Fenice (nuovo, solo via §3.3) | scegli: +1 vita extra / Allenamento / reliquia rara |

### 7.6 Tutorial (4 passi)

1. Draft: "Scegli 3 maghi. Guarda il Segno della spell: le combo nascono dagli incroci."
2. Schieramento: "La prima fila copre la seconda. Le abilità dicono dove stare."
3. Segni: "Fiamma su Veleno = Miasma. Prova."
4. Autobattle: "Non controlli i colpi. Il tuo lavoro è squadra e posizione."

## 8. Architettura

### 8.1 Motore `game/engine/rt/`

```
game/engine/rt/
  types.ts        RtUnit, RtSide, RtState, RtEvent, RtFrame, RtBattleResult, Segno, StatusUnità
  simulate.ts     simulateRt(left, right, rng, opts): tick loop, morte improvvisa, fine
  cast.ts         risoluzione di un cast (verbo, Multicast, bersaglio-unità, Copertura)
  segni.ts        applicazione Segni + tabella reazioni
  status.ts       status di squadra e di unità, tick 0,5 s / 1 s
  triggers.ts     bus dei trigger (§1.6), coda per tick, anti-loop
  abilities.ts    interprete delle AbilityLine (trigger × bersaglio × effetto)
  spells.ts       interprete delle Spell (verbo + combo + crescita)
  duos.ts         stamp dei Duo/Trio/archetipi sul lato
  relics.ts       hook reliquie (mappa §7.1)
  targeting.ts    opposto / Copertura / riga / casuale
  replay.ts       buildRtReplay(result) → frames per la UI
  teamGen.ts      generazione nemici con posizioni e combo garantite
```

`simulateRt` sostituisce `simulateBattle` nel solo chiamante di produzione (`resolvers/combat.ts`). `endlessReplay.ts` passa al nuovo motore.

### 8.2 Tipi (delta)

```ts
// types/combat.ts
interface DraftedWizard {
  wizard: Wizard; stats: Stats; spell: Spell
  slot?: 0|1|2|3|4|5
  level: 1|2|3|4                       // sostituisce level?/exp?
  memoria: Record<string, number>      // per spellId
  permanenti?: { dannoFlat?: number; dannoPct?: number }   // bonus "A vittoria" ricevuti nella run
  shiny?; recruitedVia?; grantedTags?; corrotto?
  // RIMOSSI: maxHp, currentHp, exp, growthChoices
}

// types/run.ts
interface RunState { …; lives: number; livesMax: number; feniceUsed?: true; lastBattle?: RtBattleResult }
// RIMOSSI: pendingLevelUps

// types/spell.ts
interface Spell {
  id; name; desc
  verb: 'danno'|'cura'|'scudo'|'status'|'carica'|'protego'|'rianima'|'buff'
  potenza?: number; cura?: number; scudo?: number
  segno?: { kind: 'fiamma'|'veleno'|'scossa'; stacks: number }
  gelo?: number                         // secondi
  unitStatus?: { kind: 'lentezza'|'silenzio'|'indebolito'|'disarmo'|'sospeso'; seconds?: number; pct?: number }
  teamStatus?: { kind: 'vulnerabile'; seconds: number }
  multicast?: number; cdMod?: number
  combo?: ComboClause                  // vedi 4.4
  crescita?: { kind: 'crescendo'|'memoria'; trigger: CrescitaTrigger; per: number; cap?: number; unit: 'danno'|'segno'|'cd'|'cura'|'scudo'|'secondi'|'pct'|'colpi' }
  keywords?: string[]
}

// types/ability.ts (nuovo) — vocabolario condiviso da abilità, combo delle spell, Duo, tratti, reliquie
type Trigger = 'inizio'|'lancio'|'continuo'|'koSubito'|'koAlleato'|'koNemico'|'adiacenteLancia'|'squadraCura'|'sottoSoglia'|'ogniSecondi'|'vittoria'
type Target = 'se'|'dietro'|'davanti'|'sinistra'|'destra'|'adiacenti'|'riga'|'colonna'|'tuttiAlleati'|'alleatiTag'|'alleatiCasa'|'alleatiRuolo'|'alleatoSlotMinimo'
            | 'opposto'|'nemicoCasuale'|'tuttiNemici'|'primaFilaNemica'|'adiacenteDelBersaglio'|'squadraNemica'|'squadraPropria'
type Effect =
  | { kind: 'danno'; potenza: number } | { kind: 'dannoFlat'; n: number } | { kind: 'dannoPct'; pct: number; durata?: number|'battaglia' }
  | { kind: 'cura'; n: number } | { kind: 'scudo'; n: number } | { kind: 'scudoIniziale'; n: number }
  | { kind: 'segno'; segno: 'fiamma'|'veleno'|'scossa'; stacks: number } | { kind: 'rimuoviSegnoProprio'; segno: 'fiamma'|'veleno' }
  | { kind: 'gelo'|'silenzio'|'lentezza'|'sospeso'|'vulnerabile'; secondi: number } | { kind: 'indebolito'; pct: number; secondi: number } | { kind: 'disarmo' }
  | { kind: 'carica'; secondi: number } | { kind: 'innesco' } | { kind: 'multicast'; n: number; durata?: number|'battaglia' }
  | { kind: 'ko' } | { kind: 'protego' } | { kind: 'purifica' } | { kind: 'rianima' }
  | { kind: 'cdPct'; pct: number } | { kind: 'cdFlat'; secondi: number } | { kind: 'hpPct'; pct: number }
  | { kind: 'immune'; a: 'gelo'|'silenzio'|'ko' } | { kind: 'copre'; wizardId: string } | { kind: 'durataStatusPct'; status: string; pct: number }
type Cond =
  | { adiacente: { wizardId?: string; tag?: string; casa?: string; ruolo?: string } } | { inSquadra: { wizardId?: string; tag?: string } }
  | { hpNemicaSotto: number } | { hpPropriaSotto: number } | { segnoNemico: { segno: string; min: number } }
  | { bersaglio: 'gelato'|'lento'|'silenziato' } | { entroSecondiDa: { evento: 'gelo'|'lancioAdiacente'; secondi: number } }
  | { ogniNLanci: number } | { chance: number } | { slotVuotiOKo: true } | { nessunAdiacente: true }
interface Ability { id: string /* = wizard.id */; name: string; lines: AbilityLine[]; lv4: AbilityLine }
interface AbilityLine {
  trigger: Trigger; target: Target; effect: Effect
  params?: [number, number, number]           // sovrascrive il numero principale dell'effetto per lv1-3
  cond?: Cond
  limit?: { perBattle?: number; everySeconds?: number }
}
type ComboClause = { cond: Cond; effect: Effect; target?: Target }   // sulle spell (§4.4), stesso vocabolario

// game/engine/rt/types.ts
interface RtEvent { t: number; kind: 'inizio'|'cast'|'danno'|'cura'|'scudo'|'segno'|'reazione'|'status'|'ko'|'rianima'|'trigger'|'carica'|'innesco'|'maledizione'|'fine';
  side?: Side; slot?: number; targetSide?: Side; targetSlot?: number; name?: string; value?: number; segno?: string; stacks?: number; duoId?: string; abilityId?: string }
interface RtFrame { t: number; hp: [number, number]; hpMax: [number, number]; shield: [number, number];
  segni: [Record<Segno, number>, Record<Segno, number>]; vulnerabile: [number, number];
  units: Record<string, { timer: number; cd: number; statuses: UnitStatus[]; ko: boolean; multicast: number }> }
```

`unitKey` resta `${side}:${wizard.id}`. La UI aggiorna solo agli eventi (2–6/s); anelli cooldown e barre animano in CSS con durata nota (`cd` e `t` sono nel frame).

### 8.3 Run layer

- `resolvers/combat.ts`: `battleReadyTeam` → `schieramento(team)` (assegna slot mancanti per ruolo); risultato → `applyMemoria`, `applyVittoria` (bonus permanenti), vite, spoglie.
- `runEngine.ts`: `startRunB` con `lives: 5`, `teamMax: 6`; `resolveCurrent` → sconfitta paga vite, `phaseAfterNode` con Fenice; `clearAreaAndAdvance` → +1 vita.
- `resolvers/recruit.ts`: Rinforzo; `resolvers/infirmary.ts`: vite; `spoils.ts`: Rinforzo/Vita; `sacrifice.ts`: costo `maxHp` → `stats.hp`.
- `roster.ts`: `isDead/livingOf` rimossi; `mergeLevel(team, wizardId)`.
- `leveling.ts`: **cancellato**.

### 8.4 UI

- `components/screens/SchieramentoScreen.tsx` (nuova) + `components/griglia/` (Griglia, SlotMago, AnteprimaClausole, TabReazioni).
- `components/battle/`: riscrittura di `BattleArena` su griglie; nuovi `BarraSquadra` (HP + ⛨ + contatori Segni), `TokenMago` (ritratto, anello cd, pip livello, icone status), `BannerReazione`, `NastroTempo` (evoluzione di NastroSigilli con asse in secondi); `SigilloDuo` riusato; `ColpoSullaCarta` → numeri sulla barra e sui token; Pixi mira a slot fissi.
- Rimossi: `TurnLane`, `InitiativeBar`, `BattleLog`, `BattleRecap`, `ActionPanel`, `Duellante`, `Miniatura`, `DuoPills`, `LegendaBersagli`, `lib/initiative.ts`, `lib/battleStacks.ts`, `roleCounter.ts`, `tenaciaAura`.
- Carte (`WizardCard`, `DraftCandidateCard`): spell come verbo + Segno + Combo + Crescita (contatore Memoria), abilità con righe lv1–4 e attiva evidenziata, pip livello, badge Rinforzo.
- `DuoTracker`: tab Reazioni. HUD: ♥ vite, Fenice. `RulesScreen`/Codex: pagina Reazioni e Segni.
- Tutorial §7.6.

### 8.5 Harness e test

- `tests/engine/rt/**` puri, `environmentMatchGlobs: [['tests/engine/**', 'node']]` in `vitest.config.ts`.
- Bot (`tests/engine/support/`): draft per `teamScore` (copertura Segni × reazioni possibili + Duo + Trio + clausole soddisfabili), schieramento euristico (§6.4), spoglie (Rinforzo > Marchio-che-completa > Allenamento > Vita).
- Gate `tests/engine/campaignBalanceRT.test.ts`: 120 seed, winRate in banda **misurata e registrata nel file** dopo la prima calibrazione (obiettivo iniziale 0,35–0,55), determinismo, durata media < 25 s, nessuna battaglia a 60 s.
- Copertura: `reazioniCoverage` (ogni reazione ≥1 volta su 120 run), `abilitaCoverage` (ogni riga lv1 e lv4 scatta in una probe per mago con squadra costruita ad hoc), `crescitaCoverage` (ogni Memoria/Crescendo muove il contatore), `catene` (le 7 catene di §5 producono l'evento atteso).
- **Bilanciamento per rarità e delle combo** (§5.0), eseguito a ogni modifica di dati:
  - `tierOrdering`: ogni mago a lv1 in una squadra di riferimento neutra (5 manichini fissi) contro una scala di 20 squadre nemiche seedate → "contributo" = danno + cura + scudo + valore KO. Assert: media T1 > T2 > T3 > T4 con margine ≥ 15% tra tier adiacenti; nessun T4 sopra la mediana dei T3; nessun T3 sopra la mediana dei T2.
  - `inclusionDelta`: per ogni mago, winRate della squadra di riferimento con lui vs senza (120 seed). Assert: delta ordinato per tier (medie), nessun mago con delta ≤ 0 (inutile) o ≥ 0,35 (obbligatorio).
  - `comboBalance`: le 7 catene di §5 e le 4 mono-casa, come squadre canoniche a lv1 e a lv3, contro la stessa scala nemica. Assert: ogni squadra in banda [0,40, 0,70]; rapporto max/min tra squadre ≤ 1,5; nessuna squadra vince > 90% con Memoria azzerata.
  - `crescitaSanity`: dopo 10 vittorie simulate, nessuna spell "no cap" da sola supera il 60% del danno di squadra nella scala nemica di area 2.
  - I numeri misurati vanno registrati nel file del test con data, come per `campaignBalanceB`.
- `endlessReplayParity` sul motore nuovo, `ENGINE_VERSION` → `endless-3`.
- Sweep: per casa mono, per coppia di Segni, per boss.

## 9. Piano di migrazione (7 slice, suite verde a ogni passo)

1. **Motore rt** — tipi, tick loop, cast, Segni, reazioni, status, KO, Protego, morte improvvisa, trigger bus, targeting/Copertura, replay. Test puri. Nessun chiamante di produzione.
2. **Contenuti** — `data/spells.ts` nuovo, `data/abilities.ts` (60), riassegnazione in `data/wizards.ts`, Duo/Trio/archetipi/reliquie/tratti/eventi/boss rimappati. Test di validazione dati (ogni mago ha spell + abilità, ogni casa rispetta §4.5).
3. **Run layer** — slot, vite, Fenice, livelli-merge, Rinforzo/Vita, infermeria/altare/eventi, `resolvers/combat.ts` → rt. Test run.
4. **Nemici** — `rt/teamGen.ts`: posizioni, livello/Memoria, combo garantite, boss. Test generazione.
5. **UI** — Schieramento, Battaglia, carte, Reazioni, HUD, tutorial, Codex. Test UI.
6. **Harness** — bot, gate, copertura, parity, sweep. Calibrazione e registrazione dei numeri.
7. **Taglio** — motore vecchio (`game/engine/combat/*`, `status.ts`, `leveling.ts`), componenti orfani, ~150 test vecchi, `lib/initiative.ts`, docs (HANDOFF, remaining-work, glossario).

## 10. Fuori scope

- Economia (oro, negozio, reroll, lock): non richiesta.
- PvP asincrono: non richiesto.
- Panchina: non serve (i Rinforzi si fondono subito).
- Stile grafico Batomon (pixel, UI flat): separato, non in questa spec.
