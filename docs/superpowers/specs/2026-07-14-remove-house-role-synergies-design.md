# Rimozione sinergie casata + ruolo (fase 1 di 2)

Data: 2026-07-14
Tipo: rimozione di meccanica + ri-bilanciamento (fondamento per i Trio di casata)

## Visione (contesto delle due fasi)

L'utente vuole che le **casate abbiano valore dentro il sistema Duo**, non come sistema parallelo:
un Duo attivo + 3 maghi della stessa casata → **Trio** (lo stesso Duo, amplificato dal carattere
della casa). Per arrivarci servono due fasi:

- **Fase 1 (QUESTA spec)**: rimuovere le sinergie **ruolo** (bonus flat noiosi) e **casata**
  (sinergia + poteri passivi dodge/crit/DR/cunning) — sgomberare il campo. Le casate restano
  temporaneamente solo estetiche. Ri-bilanciare.
- **Fase 2 (spec separata, dopo il merge della fase 1)**: aggiungere i **Trio di casata** — 4 boost
  di casata (Serpeverde=potenza, Corvonero=crit, Tassorosso=durata, Grifondoro=frequenza) che
  amplificano qualsiasi Duo quando 3 maghi condividono la casa.

Questa spec copre SOLO la fase 1.

## Cosa si rimuove

Da `data/synergies.ts` (`SYNERGIES`):
- **12 sinergie ruolo** (`kind: 'role'`): 2/3/4 di ogni ruolo → bonus flat (+atk/+def). Nessun altro
  codice le legge oltre `applyBonuses`. Via pulite.
- **12 sinergie casata** (`kind: 'house'`): 2/3/4 di ogni casa. Bonus quasi nullo (solo Tassorosso
  ha `regen`); il loro effetto VERO sono i poteri di casata via `houseEffects`.

**RESTANO** (non toccate): `kind: 'group'` (Golden Trio, Weasley, Mangiamorte, Malandrini, DA,
Ordine) e `kind: 'origin'` (Tossicità, Spietatezza, Bastione, Oscurità). Le origin alimentano i
segnali dei Duo → intatte, essenziali.

Da `game/engine/houseEffects.ts`:
- I poteri di casata (Grifondoro dodge, Corvonero crit, Tassorosso damage-reduction, Serpeverde
  cunning) **non vengono più applicati**. Il modo pulito: `houseEffects()` ritorna una mappa vuota
  (o non viene più chiamato in `simulate.ts:39`). I CAMPI `dodgeBonus`/`critBonus`/`damageReduction`/
  `cunning` su BattleUnit **restano** (li usano anche reliquie e la DR di battaglia) — si smette solo
  di alimentarli dalle case.

## Cosa NON si rompe (verificato)

- `applyBonuses`/`totalRegen` (`synergy.ts:54-76`) iterano su `activeSynergies`: con meno sinergie
  in lista, continuano a funzionare (sommano ciò che resta: group+origin).
- `detectSynergies` (`synergy.ts:33`) itera su `SYNERGIES`: rimuovere le entry role/house è
  sufficiente, la logica di famiglia/soglia resta valida per group/origin.
- `darkMagic.ts` legge la sinergia **Oscurità** (origin) → intatta.
- I campi combat (`dodgeBonus`/`critBonus`/`damageReduction`/`cunning`) restano sul tipo e sono
  ancora settati da reliquie/menace → nessun riferimento rotto in `effects.ts`.

## Impatto sul bilanciamento (il vero lavoro)

Togliere i poteri di casata è un cambio GROSSO:
- Il **player** perde dodge/crit/DR/cunning → più fragile e meno letale.
- I **nemici** li perdono anch'essi (houseEffects si applica a entrambi i lati) → più deboli.

Netto probabile: si compensano in parte, ma la winRate si sposterà. Va **rimisurato**
`campaignBalanceB` e, se sfora la banda, **ritarato** con le leve documentate (enemy count è la leva
primaria; hpMult/budget secondarie — NON reintrodurre i poteri di casata). I test di casata
esistenti (`serpeverdeBalance` che gate il cunning Serpeverde <0.71, ecc.) vanno rimossi o
riscritti — non hanno più senso senza i poteri.

**Regola**: se il ri-bilanciamento richiede più di un ritocco leva, fermarsi e riportare i numeri
all'utente (è una decisione di difficoltà, non automatica).

## Impatto UI

- La lista sinergie (SynergyTracker/SynergyRibbon in draft/battle) mostrerà solo group+origin.
  Verificare che non resti UI vuota/rotta quando role/house spariscono (es. un pannello "Sinergie"
  che ora ha meno righe — ok, ma non deve crashare su liste vuote).
- I tooltip/testi dei poteri di casata (`houseEffectText`) vanno rimossi o neutralizzati se
  mostrati da qualche parte (draft card, hover).

## Test

- **`detectSynergies` non ritorna più role/house**: dato un team con 3 Attaccanti + 4 Grifondoro,
  `detectSynergies` NON include `attackers3` né `gryffindor4`; include ancora group/origin se
  presenti.
- **`houseEffects` non applica poteri**: dato un team di 4 Serpeverde, nessuna unità riceve
  `cunning` da houseEffects (la mappa è vuota per le case).
- **Combat invariato nella struttura**: una battaglia gira senza crash; nessuna unità ha
  dodge/crit/DR/cunning DA CASATA (possono averli da reliquia — quello resta).
- **group/origin intatte**: Tossicità/Oscurità/Golden Trio ecc. ancora rilevate e applicate
  (Oscurità → darkMagic bonus ancora presente).
- **Balance**: `campaignBalanceB` rimisurato; documentare il nuovo valore. Se in banda, ok; se no,
  ritarare (enemy count) e ri-documentare.
- **Test casata obsoleti rimossi/riscritti**: `serpeverdeBalance` e simili che gate i poteri di
  casata non hanno più senso → rimuovere.

## Fuori scope (fase 2)

- Il sistema **Trio di casata** (i 4 boost). Spec separata dopo il merge di questa.
- Non toccare group/origin/Duo. Non reintrodurre i poteri di casata sotto altra forma (li
  sostituiranno i Trio).
