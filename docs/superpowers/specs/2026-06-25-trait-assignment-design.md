# Assegnazione tratti ai 60 wizard · Design

> Assegna a ciascuno dei 60 wizard almeno un tratto, scelto dentro il pool
> meccanico del suo ruolo e rifinito per coerenza col personaggio. Solo dati in
> `data/wizards.ts` + un test di copertura. Zero modifiche al motore o ai tratti.

## Contesto

- 15 tratti esistono (`data/traits.ts`): 5 originali (esecuzione, furia, roccia,
  sifone, benedizione) + 10 Phase 3 (pietrificazione, bavaglio, disarmo, veleno,
  logoramento, ferocia, rigenerazione, anticipo, crescendo, vendetta).
- `Wizard.traits?: string[]` (`types/wizard.ts`). Il motore registra
  `u.wizard.traits` via `registerTraitTriggers` (`game/engine/traits.ts:9`).
- 4 wizard già assegnati — **restano invariati**: voldemort
  `[esecuzione, furia]`, bellatrix `[sifone]`, mcgonagall `[roccia]`, lupin
  `[benedizione]`.
- 56 wizard da assegnare.

## Decisioni (dall'utente)

- **Densità:** 1 tratto ciascuno; tier 1-2 possono averne 2.
- **Criterio:** pool per ruolo + lore dentro il pool.
- **Ripetizione:** OK — più wizard dello stesso ruolo possono condividere un
  tratto; il tratto rinforza l'identità di ruolo.

## Pool per ruolo

| Ruolo | Pool di tratti |
|-------|----------------|
| **Attaccante** | esecuzione, furia, ferocia, crescendo, veleno |
| **Controllo** | pietrificazione, bavaglio, disarmo, logoramento, sifone, anticipo |
| **Supporto** | benedizione, rigenerazione |
| **Tank** | roccia, vendetta |

Regola: ogni wizard riceve un tratto dal pool del suo ruolo. La scelta dentro il
pool segue il personaggio (lore). I 4 già assegnati rispettano già il pool.

## Assegnazione completa (60)

Legenda: `id` → `[tratti]` · motivo.

### Tier 1
- `dumbledore` (Controllo) → `[pietrificazione]` · il più grande mago, blocca i nemici (Stupeficio/Petrificus).
- `voldemort` (Attaccante) → `[esecuzione, furia]` · **esistente**, invariato.
- `harry` (Attaccante) → `[esecuzione, furia]` · l'eroe sotto pressione colpisce più forte; tier 1 → 2 tratti.

### Tier 2
- `snape` (Attaccante) → `[veleno]` · maestro di pozioni.
- `bellatrix` (Controllo) → `[sifone]` · **esistente**, invariato.
- `mcgonagall` (Tank) → `[roccia]` · **esistente**, invariato.
- `sirius` (Attaccante) → `[furia, ferocia]` · combattente impulsivo; tier 2 → 2.
- `lupin` (Supporto) → `[benedizione]` · **esistente**, invariato.
- `moody` (Tank) → `[roccia, vendetta]` · "vigilanza costante", reagisce alle perdite; tier 2 → 2.
- `lucius` (Attaccante) → `[esecuzione]` · finisce i feriti senza pietà.
- `kingsley` (Tank) → `[roccia]` · auror solido.
- `fleur` (Attaccante) → `[ferocia]` · scariche crescenti di fuoco.
- `viktor` (Attaccante) → `[crescendo]` · campione che sale di colpi.

### Tier 3
- `hermione` (Controllo) → `[bavaglio]` · silenzia con intelligenza tattica.
- `ron` (Tank) → `[roccia]` · regge i colpi per gli amici.
- `draco` (Attaccante) → `[veleno]` · colpi sleali.
- `ginny` (Attaccante) → `[ferocia]` · aggressiva, sale a ogni colpo.
- `neville` (Tank) → `[vendetta]` · si infuria quando un alleato cade (coraggio).
- `luna` (Supporto) → `[rigenerazione]` · presenza calmante e curativa.
- `fred` (Controllo) → `[logoramento]` · scherzi che rallentano.
- `george` (Attaccante) → `[crescendo]` · gemello incalzante.
- `molly` (Supporto) → `[benedizione]` · madre protettiva (scudo a chi cura).
- `arthur` (Supporto) → `[rigenerazione]` · sostegno costante.
- `tonks` (Controllo) → `[anticipo]` · metamorfomaga reattiva e velocissima, prende l'iniziativa.
- `narcissa` (Supporto) → `[benedizione]` · protegge i suoi.
- `dolohov` (Attaccante) → `[veleno]` · maledizioni persistenti.
- `greyback` (Tank) → `[vendetta]` · belva che si scatena.
- `cho` (Controllo) → `[pietrificazione]` · stordisce.
- `cedric` (Attaccante) → `[ferocia]` · campione corretto ma incalzante.
- `slughorn` (Supporto) → `[rigenerazione]` · pozioni di sostegno.
- `hagrid` (Tank) → `[roccia]` · resistenza fisica enorme.
- `flitwick` (Controllo) → `[anticipo]` · piccolo e fulmineo, agisce per primo (spd più alta del roster).
- `sprout` (Supporto) → `[rigenerazione]` · erbologia curativa.

### Tier 4
- `seamus` (Attaccante) → `[ferocia]` · esplosivo.
- `dean` (Attaccante) → `[crescendo]`.
- `parvati` (Controllo) → `[logoramento]`.
- `lavender` (Supporto) → `[benedizione]`.
- `pansy` (Controllo) → `[bavaglio]`.
- `goyle` (Tank) → `[roccia]`.
- `crabbe` (Tank) → `[roccia]`.
- `marcus` (Attaccante) → `[furia]`.
- `pettigrew` (Supporto) → `[rigenerazione]` · codardo che si tiene in vita.
- `padma` (Controllo) → `[disarmo]`.
- `terry` (Controllo) → `[pietrificazione]`.
- `michael` (Attaccante) → `[crescendo]`.
- `roger` (Tank) → `[vendetta]`.
- `marietta` (Supporto) → `[rigenerazione]`.
- `anthony` (Tank) → `[roccia]`.
- `hannah` (Supporto) → `[benedizione]`.
- `susan` (Supporto) → `[rigenerazione]`.
- `ernie` (Tank) → `[roccia]`.
- `justin` (Attaccante) → `[ferocia]`.
- `zacharias` (Controllo) → `[logoramento]`.
- `leanne` (Controllo) → `[bavaglio]`.
- `eloise` (Tank) → `[vendetta]`.
- `theodore` (Controllo) → `[pietrificazione]`.
- `blaise` (Attaccante) → `[veleno]`.
- `astoria` (Supporto) → `[benedizione]`.
- `penelope` (Supporto) → `[rigenerazione]`.
- `megan` (Controllo) → `[logoramento]`.

## Distribuzione risultante (controllo)

Conta per tratto (i 4 esistenti inclusi):

- esecuzione: voldemort, harry, lucius → 3
- furia: voldemort, harry, sirius, marcus → 4
- ferocia: sirius, fleur, ginny, cedric, seamus, justin → 6
- crescendo: viktor, george, dean, michael → 4
- veleno: snape, draco, dolohov, blaise → 4
- pietrificazione: dumbledore, cho, terry, theodore → 4
- bavaglio: hermione, pansy, leanne → 3
- disarmo: padma → 1
- anticipo: tonks, flitwick → 2
- logoramento: fred, parvati, zacharias, megan → 4
- sifone: bellatrix → 1
- roccia: mcgonagall, moody, kingsley, ron, hagrid, goyle, crabbe, anthony, ernie → 9
- vendetta: moody, neville, greyback, roger, eloise → 5
- benedizione: lupin, molly, narcissa, lavender, hannah, astoria → 6
- rigenerazione: luna, arthur, slughorn, sprout, pettigrew, marietta, susan, penelope → 8

**Nota su `sifone`:** resta su bellatrix soltanto (esistente, invariato). È una
versione più debole di `logoramento` (anch'esso -VEL); tenerlo raro evita
ridondanza. Tutti gli altri 14 tratti sono in gioco su almeno un wizard.

## File toccati

- `data/wizards.ts` — aggiunge/lascia il campo `traits` su ogni wizard. I 4
  esistenti **non si toccano**.
- `tests/data/traitAssignment.test.ts` (nuovo) — verifica:
  1. Ogni wizard ha `traits` non vuoto.
  2. Ogni id di tratto referenziato esiste in `TRAIT_BY_ID`.
  3. I 4 esistenti hanno ancora i loro tratti esatti (regressione).
  4. (Opzionale, soft) ogni tratto assegnato appartiene al pool del ruolo del
     wizard — un controllo di coerenza che documenta la regola di design.

## Test plan

- Nuovo test data-level come sopra. Nessun test di combattimento nuovo: il
  motore già esegue i tratti (provato in Phase 2/3). L'integrazione è già coperta.
- Suite intera + `tsc` + `build` verdi. `roleBalance.test.ts` non è influenzato
  (controlla solo le stat, non i tratti).

## Fuori scope (YAGNI)

- Bilanciamento numerico dei tratti (è Phase 3, già fatto).
- Nuovi tratti o modifiche al motore.
- Forzare l'uso di `anticipo`/`sifone` su altri wizard solo per copertura.
- UI: la chip tratto su WizardCard già mostra qualunque tratto assegnato.
