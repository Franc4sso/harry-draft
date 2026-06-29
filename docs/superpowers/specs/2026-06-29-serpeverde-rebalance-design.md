# Rebalance casa Serpeverde — design (nerf deatheater)

> Data: 2026-06-29. Backlog item #4 (`docs/superpowers/remaining-work.md`), reso più pressante dai 3
> archetipi Serpeverde-leaning (Veleno 0.76, Esecuzione 0.85, Magie Oscure 0.95) che sweepano tutti
> molto sopra il Grifondoro calibrato 0.275. È un task di BILANCIAMENTO, non un archetipo — non segue
> il pattern tracer-bullet.

## Diagnosi (verificata, 2026-06-29)

Serpeverde vince **nonostante stat base PIÙ BASSI** delle altre case. Power medio dai midpoint dei range
(`hp + atk*2 + def*1.5 + spd`):

| Casa | avg power | per tier |
|---|---|---|
| Grifondoro | **187** | T1=228 T2=215 T3=185 T4=142 |
| Serpeverde | **172** | T1=224 T2=183 T3=180 T4=155 |
| Corvonero | 169 | — |
| Tassorosso | 161 | — |

Quindi lo squilibrio **NON è negli stat dei maghi** (Serpeverde è secondo, non primo). La causa è
l'**atk-stacking delle synergie**:
1. La synergia di casa `slytherin` dà **atk** (+10/22/40); le altre case danno def/spd/regen. L'atk è la
   stat più potente del combat (danno = atk × power della spell; nel `powerOf` atk pesa ×2).
2. **`deatheater` dà +25 atk PIATTO** — il più grosso bonus atk del gioco — e si attiva con 3 mangiamorte
   (tutti Serpeverde: voldemort, bellatrix, lucius, narcissa, dolohov, greyback, pettigrew).
3. Le tag-synergie d'archetipo (`tossicita`/`spietatezza`/`oscurita`, +5 atk ciascuna) si sommano sopra,
   anch'esse concentrate su Serpeverde.

Un team Serpeverde-mangiamorte stacka casa-atk + deatheater +25 + tag-atk. Grifondoro (def), Corvonero
(spd), Tassorosso (regen) non hanno un equivalente offensivo concentrato. **Vince la concentrazione di
atk, non la qualità dei maghi.**

## Fix (chirurgico)

Ridurre `deatheater.bonus.atk` da **25** a un valore tarato empiricamente (ipotesi iniziale **12**,
allineato all'ordine di grandezza delle altre tag/casa-synergie). UNA riga in `data/synergies.ts`.

**Cosa NON toccare (e perché):**
- **Stat dei maghi** — sono già più bassi della media; nerfarli peggiorerebbe la diagnosi al contrario.
- **Synergia di casa `slytherin`** — è SIMMETRICA con le altre case (ognuna dà una stat). Abbassarla
  romperebbe quella simmetria di design. L'outlier è deatheater, non la casa.
- **Scaling globale / menace** (`data/constants.ts`) — derivato dal livello nemico, condiviso con
  `campaignBalanceB` (starter Grifondoro). Toccarlo muoverebbe il test Grifondoro calibrato. ⚠️ vincolo
  dalla memory di progetto.
- **I +5 atk di tossicita/spietatezza/oscurita** — piccoli, e i 3 archetype-sweep ci sono appena stati
  calibrati sopra; toccarli muoverebbe quei numeri.

## Validazione (tre vincoli, da soddisfare insieme)

### A. Serpeverde scende in banda — `tests/engine/serpeverdeBalance.test.ts` (nuovo)
Un sweep diagnostico che misura il winRate di un team Serpeverde competente (pattern degli archetype-sweep:
starter Serpeverde, bias a `powerOf` + tag offensivi/deatheater, N=120, policy fight-for-EXP come
campaignBalanceB). Stampa la diagnostica. Asserzioni:
- `winRate < 0.60` — sceso dal regime gonfiato (0.76-0.95) verso la banda.
- `winRate > 0.10` — non sovra-nerfato (Serpeverde resta una casa giocabile).
- determinismo (stessi seed → stessi esiti).

Il valore esatto di `deatheater.atk` si tara su QUESTO numero: parti da 12, runna, aggiusta finché
Serpeverde è in `(0.10, 0.60)`.

### B. Grifondoro resta intatto — `campaignBalanceB` (esistente, NON modificare)
`tests/engine/campaignBalanceB.test.ts` (starter Grifondoro, banda 0.15-0.55) **deve restare verde** dopo
il nerf. È la prova che il fix è chirurgico (non ha toccato lo scaling globale). Se diventa rosso, il nerf
ha effetti collaterali inattesi → STOP e rivedere. Da verificare, non modificare.

### C. Gli archetype-sweep restano sopra soglia — commenti aggiornati
I 3 sweep Serpeverde (veleno/esecuzione/magieOscure) SCENDERANNO (è lo scopo). Le loro asserzioni sono
`winRate > 0.05` → restano verdi. Aggiornare SOLO i commenti diagnostici in-file (il numero osservato +
la nota "post-deatheater-nerf") perché restino veritieri. Le asserzioni non cambiano.
⚠️ Possibile: se un sweep scende sotto `0.05` (improbabile, deatheater è un bonus tra tanti), quello è un
segnale che 12 è troppo basso → rialzare verso 15-18 e ritarare su tutti i vincoli insieme.

## Rischi noti & leve

- **Sovra-nerf** (Serpeverde < 0.10, o un archetype-sweep < 0.05): rialzare `deatheater.atk` (12→15→18) e
  ritarare. La leva è un solo numero.
- **Sotto-nerf** (Serpeverde ancora > 0.60 a 12): abbassare ancora (12→8). Se nemmeno a valori molto bassi
  scende, la diagnosi va riconsiderata (forse la casa slytherin contribuisce più del previsto) — ma NON
  espandere lo scope senza un nuovo diagnostico.
- **campaignBalanceB rosso**: significherebbe che deatheater influenza anche i team Grifondoro — ma nessun
  mago Grifondoro ha il tag deatheater, quindi non dovrebbe accadere. Se accade, è un bug di
  comprensione → STOP.

## Non in scope (YAGNI)

- Rebalance delle altre case (Corvonero/Tassorosso più deboli) — task separato se mai servisse.
- Toccare la synergia di casa slytherin o i +5 degli archetipi.
- Ribilanciare gli stat dei singoli maghi.
- Cambiare lo scaling nemico / menace.

## Ordine di implementazione (per il plan)

1. Scrivere `tests/engine/serpeverdeBalance.test.ts` (diagnostico) — PRIMA del fix, per misurare il
   baseline gonfiato (deve fallire l'asserzione `< 0.60` a deatheater=25, confermando la diagnosi).
2. Ridurre `deatheater.atk` 25→12 in `data/synergies.ts`. Runnare il diagnostico + campaignBalanceB.
3. Tarare il valore finché: Serpeverde in `(0.10, 0.60)` AND campaignBalanceB verde AND i 3 sweep > 0.05.
4. Aggiornare i commenti diagnostici nei 3 archetype-sweep coi nuovi numeri.
5. Full suite verde + tsc. Aggiornare `remaining-work.md` (#4 → done).
