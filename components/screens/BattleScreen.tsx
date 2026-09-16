'use client'
import { useMemo, useState } from 'react'
import { Play, Pause, SkipForward, FastForward, ChevronRight } from 'lucide-react'
import type { ActiveRelic, ActiveSynergy, BattleResult, DraftedWizard } from '@/types'
import { buildReplay } from '@/game/engine/combat/replay'
import { detectDuos } from '@/game/engine/duos'
import { livingOf } from '@/game/engine/roster'
import { useBattleReplay, REPLAY_SPEEDS } from '@/hooks/useBattleReplay'
import { BALANCE } from '@/data/constants'
import { Hourglass } from 'lucide-react'
import { BattleArena } from '@/components/battle/BattleArena'
import { BattleEndModal } from '@/components/battle/BattleEndModal'
import { recapTotals } from '@/lib/battleRecap'

/** Portrait height fed to every WizardCard in the arena — FIXED, never shrunk.
 *  "Il ritratto non si rimpicciolisce" is an explicit user requirement (D1 in the
 *  design spec), so unlike MapScreen's row-step contraction, the fit to 768px
 *  here comes entirely from trimming the surrounding chrome (header, controls,
 *  bottom bar), not from shrinking the card. */
const PORTRAIT_HEIGHT = 118

export function BattleScreen({
  result, playerTeam, playerSyn, playerRelics, enemy, enemySyn, title, rightTitle, onFinish, enemyLevel = 1,
  rightMenace = 0, rightRelics, rightDamageReduction = 0, rightIgnoresTaunt = false,
}: {
  result: BattleResult
  playerTeam: DraftedWizard[]
  playerSyn: ActiveSynergy[]
  playerRelics?: ActiveRelic[]
  enemy: DraftedWizard[]
  enemySyn: ActiveSynergy[]
  title: string
  rightTitle?: string
  onFinish: () => void
  /** Level shown on enemy cards (menace was removed 2026-07-01); players use their own. */
  enemyLevel?: number
  /** Same values simulateBattle used for the enemy side — threaded into buildReplay so
   *  the turn lane's displayed spd matches the sim's actual turn order. */
  rightMenace?: number
  rightRelics?: ActiveRelic[]
  rightDamageReduction?: number
  rightIgnoresTaunt?: boolean
}) {
  const replay = useMemo(
    () => buildReplay(result, playerTeam, enemy, {
      leftSyn: playerSyn, rightSyn: enemySyn, leftRelics: playerRelics ?? [],
      rightRelics: rightRelics ?? [], rightMenace, rightDamageReduction, rightIgnoresTaunt,
    }),
    [result, playerTeam, enemy, playerSyn, enemySyn, playerRelics, rightRelics, rightMenace, rightDamageReduction, rightIgnoresTaunt],
  )
  const r = useBattleReplay(replay)
  // Stessa lista di Duo che ha davvero agito nel motore. Il resolver (resolvers/combat.ts) fa
  // detectDuos(ready, state.relics) su `battleReadyTeam(livingOf(state.team))` — i caduti sono già
  // fuori. Qui invece `playerTeam` arriva da prepareCombat come `battleReadyTeam(run.team)`, che NON
  // filtra i caduti: senza questo `livingOf` le pill mostrerebbero Duo che in battaglia non erano
  // accesi. Il livingOf è quindi PORTANTE, non ridondante — non toglierlo.
  const activeDuos = useMemo(
    () => detectDuos(livingOf(playerTeam), playerRelics ?? []),
    [playerTeam, playerRelics],
  )
  // Lets the player dismiss the end modal to review the settled board/log,
  // then reopen it (or confirm) via the floating "Rivedi esito" button.
  const [dismissed, setDismissed] = useState(false)
  // Fatigue ("Sfinimento") kicks in once the anti-stall system starts ticking
  // true damage every turn. Flag it as soon as the current turn passes the
  // threshold, or the moment a Fatica entry has actually played (whichever
  // comes first) so the banner never lags behind the log/HP bars.
  const fatigueActive = r.currentTurn > BALANCE.combat.fatigueStart
    || replay.frames.slice(0, r.index + 1).some(f => f.entry?.action === 'Fatica')

  // End-of-battle payoff: the player's top damage dealer (MVP) + the single biggest hit.
  const summary = useMemo(() => {
    const rows = recapTotals(replay.frames, replay.units, 'left')
    const top = [...rows].sort((a, b) => (b.dealt + b.healed) - (a.dealt + a.healed))[0]
    let bigHit: { name: string; value: number } | undefined
    for (const f of replay.frames) {
      const e = f.entry
      if (e && e.actorSide === 'left' && typeof e.value === 'number' && e.value > 0 && !e.flags.includes('heal')) {
        if (!bigHit || e.value > bigHit.value) {
          const actor = replay.units.find(u => u.id === e.actorId && u.side === e.actorSide)
          bigHit = { name: actor?.name ?? e.actorId ?? '—', value: e.value }
        }
      }
    }
    return { mvpName: top?.name ?? '—', mvpDealt: top?.dealt ?? 0, bigHit }
  }, [replay])

  return (
    // `max-h-[100dvh]` invece di `h-[100dvh]`: `body` ha `min-h-full` (altezza
    // MINIMA, non massima), quindi un'altezza imposta qui non aveva alcun tetto
    // sopra di se' e il main cresceva col registro fino a 824px. Un massimo,
    // invece, vincola davvero — e `overflow-hidden` tiene dentro cio' che eccede.
    <main className="flex max-h-[100dvh] min-h-0 flex-1 flex-col items-center gap-1 overflow-hidden p-1.5 sm:p-2">
      {/* Titolo + turno + controlli sulla STESSA riga: nel budget fisso di 768px
          (il ritratto non si rimpicciolisce, D1) ogni riga di intestazione pesa,
          quindi qui condividono un'unica fascia invece di impilarsi. */}
      <div className="flex w-full max-w-5xl shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <div className="flex flex-col items-center leading-tight">
          <h1 className="font-display text-base text-[#F0D98A] [text-shadow:0_0_18px_rgba(201,162,75,0.25)]">{title}</h1>
          <p className="text-[9px] uppercase tracking-widest text-white/35">
            Turno {r.entry?.turn ?? 0}
            {r.entry?.actorId ? <> · agisce <span className="text-white/60">{replay.units.find(u => u.id === r.entry!.actorId && u.side === r.entry!.actorSide)?.name ?? r.entry!.actorId}</span></> : null}
          </p>
        </div>

        {/* Controlli di riproduzione — bottoni nativi compatti (non il componente
            Button condiviso, la cui base `px-6 py-3` non si lascia stringere da un
            className successivo per come funziona la cascata CSS) così questa riga
            resta bassa nel budget fisso di 768px. */}
        {!r.done && (
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-1">
          {[
            { onClick: r.toggle, label: r.playing ? 'Pausa' : 'Riproduci', icon: r.playing ? <Pause size={14} /> : <Play size={14} />, text: null },
            { onClick: r.step, label: 'Passo', icon: <ChevronRight size={13} />, text: 'Passo' },
            { onClick: () => r.setSpeed(REPLAY_SPEEDS[(REPLAY_SPEEDS.indexOf(r.speed) + 1) % REPLAY_SPEEDS.length]!), label: `${r.speed}×`, icon: <FastForward size={13} />, text: `${r.speed}×` },
            { onClick: r.skip, label: 'Salta', icon: <SkipForward size={13} />, text: 'Salta' },
          ].map((b, i) => (
            <button
              key={i}
              type="button"
              onClick={b.onClick}
              aria-label={b.text ? undefined : b.label}
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[11px] uppercase tracking-wide text-white/75 transition-colors hover:border-gold/40 hover:bg-white/[0.08] hover:text-white"
            >
              {b.icon}{b.text}
            </button>
          ))}
          </div>
        )}
      </div>

      {fatigueActive && (
        <div
          data-testid="fatigue-banner"
          className="flex shrink-0 items-center gap-2 rounded-xl border border-fuchsia-400/40 bg-fuchsia-950/40 px-3 py-0.5 text-xs font-semibold text-fuchsia-200 shadow-[0_0_16px_rgba(217,70,239,0.15)]"
        >
          <Hourglass size={14} className="shrink-0 text-fuchsia-300" aria-hidden />
          Sfinimento! Tutti i maghi perdono PV ogni turno.
        </div>
      )}

      {/* Campo contro campo: il ritratto NON si rimpicciolisce mai (D1, requisito
          esplicito) — questa regione può crescere ma le due carte-densità-combat
          restano a PORTRAIT_HEIGHT fisso; il bilancio di 768px viene tutto dallo
          spazio intorno (header, controlli, barra danni), non dalla carta.

          `overflow-hidden` + `justify-start` qui, non `justify-center`: BattleArena
          (Task 5, territorio approvato, non toccato) non porta NESSUN tetto di
          altezza, e la sua altezza vera dipende dal ROSTER — non dal ritratto (fisso),
          ma dalla riga della magia sotto (`SpellLine`, `break-words` senza limite di
          righe): un nome lungo va a capo e aggiunge una riga, altri no. Col solo
          `overflow-hidden` + `justify-center` ereditato, quando una carta eccede la
          quota calcolata da flex l'arena viene CENTRATA nella propria fascia e
          l'eccedenza esce in parti uguali sopra E sotto: la metà sopra tagliava via
          proprio le prime righe della fila nemica (nome, badge archetipo) — misurato
          dal vivo su un roster con nomi lunghi (Penelope Clearwater/Peter Minus/Marcus
          Flint), screenshot alla mano, non solo `getBoundingClientRect` fuori range.
          `justify-start` sposta quel taglio SOLO in fondo (il bordo inferiore della
          fila giocatore, l'ultima cosa disegnata) invece che in cima alla fila nemica,
          la prima cosa che l'occhio legge: stesso `overflow-hidden` (quindi ancora
          contenuto DENTRO la fascia, mai fuori dal documento — `scrollHeight` resta
          768), ma la degradazione è nella direzione meno dannosa, non simmetrica. Il
          ritratto non si rimpicciolisce comunque (D1): l'eccedenza va tagliata qui —
          non spinta fuori dallo schermo in modo invisibile, e non a scapito della fila
          che il giocatore deve leggere per prima. */}
      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start overflow-hidden">
        <BattleArena
          replay={replay} hp={r.hp} entry={r.entry} frameKey={r.index} rightTitle={rightTitle}
          enemyLevel={enemyLevel} speed={r.speed} duos={activeDuos} intensity={r.intensity}
          portraitHeight={PORTRAIT_HEIGHT}
        />
      </div>

      {/* 2026-09-16 (Task 6) — QUI C'ERANO la corsia dei turni (100px) e la fascia
          coi due resoconti danni piu' il registro (92px). Sono RIMOSSE dal
          combattimento, e la ragione e' geometrica, non di gusto: `BattleArena`
          posiziona le dieci carte a top ASSOLUTO (46/768 la fila nemica, 510/768
          quella alleata, altezza 254), cioe' assume di avere per se' l'intera
          cornice di 768px. Ogni striscia sorella le sottrae proprio lo spazio che
          da' per scontato: 192px di strisce schiacciavano la fila alleata fino a
          lasciarne visibili solo i volti — nomi, vita e statistiche coperti. Visto
          in uno screenshot a 1366x768, non dedotto: le misure dicevano
          `bottom 747 <= 768` e passavano mentre la fila era illeggibile, che e'
          esattamente il modo di sbagliare contro cui il piano metteva in guardia.

          Cosa NON si perde:
          - l'ordine dei turni lo dice il nastro dei sigilli (stessa fonte,
            `initiativeAt` sul futuro vero del replay) e in piu' dice con QUALE
            incantesimo ciascuno agira';
          - gli stati li dicono le pillole sommate sulla carta (Task 1+2), che
            quando il registro fu reintrodotto non esistevano ancora;
          - il racconto di cos'e' successo resta nel resoconto di fine scontro.
          Cio' soddisfa il requisito dello spec «registro fuori dal combattimento».
          I componenti restano in repo: e' la schermata a non montarli piu'. */}

      {r.modalReady && !dismissed && (
        <BattleEndModal
          outcome={result.winner === 'left' ? 'win' : 'loss'}
          timedOut={result.timedOut}
          onConfirm={onFinish}
          onClose={() => setDismissed(true)}
          summary={summary}
        />
      )}

      {r.modalReady && dismissed && (
        <button
          type="button"
          onClick={() => setDismissed(false)}
          className="fixed bottom-6 right-6 z-50 rounded-full border border-[#C9A24B]/40 bg-[rgba(20,16,33,0.92)] px-4 py-2 text-sm font-display tracking-wide text-[#F0D98A] shadow-[0_0_24px_rgba(201,162,75,0.2)] transition-colors hover:bg-[rgba(20,16,33,1)]"
        >
          Rivedi esito
        </button>
      )}
    </main>
  )
}
