'use client'
import { useMemo, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { DraftedWizard, RunNode, RunState } from '@/types'
import { screenVariants } from '@/components/ui/motion'
import { Frame } from '@/components/ui/Frame'
import { useRunB, type RunBController } from '@/hooks/useRunB'
import type { EndlessController } from '@/hooks/useEndless'
import type { ActiveBattleB } from '@/hooks/useRunB.combat'
import type { RunSharedView, CurrentEventView } from '@/hooks/useRunShared'
import { tutorialStarterOffer, tutorialGuidedPickIds } from '@/game/engine/tutorialOffer'
import { detectDuos } from '@/game/engine/duos'
import { livingOf } from '@/game/engine/roster'
import { TutorialProvider } from '@/components/tutorial/TutorialProvider'
import { TutorialOverlay } from '@/components/tutorial/TutorialOverlay'
import type { TutorialCtx } from '@/components/tutorial/steps'
import { DraftScreen } from './DraftScreen'
import { MapScreen } from './MapScreen'
import { BattleScreen } from './BattleScreen'
import { VictoryScreen } from './VictoryScreen'
import { ResultScreen } from './ResultScreen'
import { RecruitScreen } from './RecruitScreen'
import { RelicNodeScreen } from './RelicNodeScreen'
import { EventScreen } from './EventScreen'
import { SpellForgeScreen } from './SpellForgeScreen'
import { SpellSwapScreen } from './SpellSwapScreen'
import { InfirmaryScreen } from './InfirmaryScreen'
import { AreaClearedScreen } from './AreaClearedScreen'
import { AltareScreen } from './AltareScreen'
import { TeamSynergyBar } from '@/components/run/TeamSynergyBar'
import { DuoToast } from '@/components/run/DuoToast'
import { RelicBar } from '@/components/relics/RelicBar'
import { recruitOffer, relicOffer } from '@/game/engine/resolvers/recruit'
import { altareOffer } from '@/game/engine/resolvers/altare'
import { swapOffer } from '@/game/engine/resolvers/spellSwap'
import { createRng } from '@/game/engine/rng'
import { rollSpoils, spoilsRngForNode, type SpoilChoice } from '@/game/engine/spoils'
import { runSummary } from '@/lib/runSummary'
import { displayName } from '@/lib/displayName'
import { BOSSES } from '@/data/bosses'
import { BALANCE } from '@/data/constants'
import { parseAreaNodeId } from '@/game/engine/map'

/** Structural subset of {@link RunBController} (campaign) / {@link EndlessController}
 *  (endless) that RunBRunner actually drives. Fields that only campaign phases ever
 *  reach ('draft', 'win') are optional here — EndlessController doesn't implement them
 *  because endless never produces those views (endless's draft/house pick happens in
 *  EndlessRunner BEFORE RunBRunner mounts; endless never sets phase:'win', see
 *  game/engine/endless.ts advanceEndlessArea).
 *  Both concrete controllers satisfy this structurally — no runtime adapter needed. */
export interface RunnerController {
  run: RunState; view: RunSharedView
  battle: ActiveBattleB | null; reachable: RunNode[]; currentNode: RunNode | undefined
  lastFallen: string[]
  /** Duo ids newly discovered by the move that just entered battle (empty otherwise) —
   *  rendered as a DuoToast in the 'battle' case. */
  newlyDiscoveredDuoIds?: string[]
  areasTotal?: number
  completeDraft?: (picked: DraftedWizard[]) => void
  chooseNode: (nodeId: string) => void
  commitBattle: () => void
  acknowledgeVictory: () => void
  /** Le Spoglie della Vittoria: campagna-only, come buyAltare. L'endless non le implementa
   *  (§6 del piano: ri-simula le run per l'anti-cheat) e senza questa callback la
   *  VictoryScreen resta il vecchio "Prosegui". */
  chooseSpoil?: (choice: SpoilChoice) => void
  chooseRecruit: (wizardId: string, replaceId?: string) => void
  skipRecruit: () => void
  chooseRelic: (relicId: string, assignedTo?: string, replaceRelicId?: string) => void
  /** Altare Oscuro (P5): campaign-only, mirrors buyShopItem/leaveShop's optionality —
   *  endless never generates 'altare' nodes (Task 6), so EndlessController doesn't
   *  implement these. */
  buyAltare?: (relicId: string, costWizardId?: string, costRelicId?: string, carrierId?: string, replaceRelicId?: string) => void
  skipAltare?: () => void
  ackInfirmary: () => void
  currentEvent: CurrentEventView | null
  chooseEventOption: (optionId: string) => void
  chooseSpellUpgrade: (wizardId: string) => void
  /** Campaign-only, mirrors buyAltare's optionality — endless never generates 'spellSwap'
   *  nodes (weight zeroed in nodeGen.ts), so EndlessController doesn't implement this. */
  chooseSpellSwap?: (wizardId: string, spellId: string) => void
  useConsumableRelic: (relicId: string) => void
  cioccorane?: number
  advanceArea: () => void
  restart?: () => void
  runReward?: RunBController['runReward']
}

export function RunBRunner({
  seed, controller, onExit: _onExit, tutorial = false,
}: {
  seed: string
  /** Injected run controller — defaults to useRunB(seed) (campaign, unchanged). Pass
   *  useEndless(seed) to drive this SAME view tree in endless mode with zero rebuild. */
  controller?: RunnerController
  onExit?: () => void
  /** Tutorial mode (`?tutorial=1`, see PlayFlow.gate.tsx): the starter draft offer is
   *  the curated `tutorialStarterOffer` instead of the normal seeded multi-screen
   *  draft, and coach-marks (TutorialProvider/TutorialOverlay) mount over the run.
   *  Purely additive UI — never touches engine state or determinism. */
  tutorial?: boolean
}) {
  // Rules-of-hooks note: `seed` never changes identity across a component's lifetime
  // (it comes from the URL/route param that mounted this screen), and `controller`'s
  // presence is a per-route constant (RunBRunner is only ever rendered bare — campaign
  // — or with `controller` — endless — never toggled at runtime on the same instance).
  // So this call is unconditional in practice despite the `if`, and never runs both
  // useRunB AND useEndless simultaneously (which would double up pool-restriction
  // globals and localStorage writes under different keys for no reason).
  const c: RunnerController = controller ?? useRunB(seed) // eslint-disable-line react-hooks/rules-of-hooks
  const area = c.run.area ?? 0
  const router = useRouter()
  const reduce = useReducedMotion()
  const animKey = `${c.view}-${c.run.currentNodeId ?? area}`

  // Tutorial mode: curated starter offer, RESTRICTED to exactly the guided trio
  // (game/engine/tutorialOffer.ts's tutorialGuidedPickIds) — not the full house offer.
  // This structurally guarantees the Duo: with only 3 candidates shown and STARTER_PICKS
  // = 3, picking a full team IS picking the trio, so detectDuos can never come up empty
  // (see game/engine/duos.ts). The trio is a fixed Tassorosso cast independent of house
  // (tutorialOffer.ts), so 'Tassorosso' is just a deterministic argument to
  // `tutorialStarterOffer`, not a player choice — this codebase's live draft has no
  // house-pick step (2026-07-10 draft-parity refactor).
  const tutorialOffer = useMemo(() => {
    if (!tutorial) return undefined
    const full = tutorialStarterOffer('Tassorosso')
    return tutorialGuidedPickIds
      .map(id => full.find(d => d.wizard.id === id))
      .filter((d): d is DraftedWizard => !!d)
  }, [tutorial])
  const tutorialPhase: TutorialCtx['phase'] =
    c.view === 'draft' ? 'draft' : c.view === 'battle' ? 'battle' : 'other'
  const hasActiveDuo = useMemo(
    () => detectDuos(livingOf(c.run.team), c.run.relics).length > 0,
    [c.run.team, c.run.relics],
  )
  const tutorialCtx: TutorialCtx = { phase: tutorialPhase, hasActiveDuo }

  // Between-battle phases (map / recruit / relic) show the roster + owned relics as a
  // larger LEFT sidebar beside the screen content, so the player can read their wizards
  // and relics while choosing a path / recruit / relic. Battle and the end screens
  // don't use it (battle shows relics in-fight).
  const withTeamSidebar = (content: ReactNode) => (
    <div className="flex-1 flex flex-row items-start gap-4 p-3">
      <motion.aside
        initial={reduce ? false : { opacity: 0, x: -18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        className="sticky top-3 flex w-72 shrink-0 flex-col gap-3"
      >
        <TeamSynergyBar
          team={c.run.team}
          relics={c.run.relics}
          orientation="vertical"
        />
        <Frame variant="panel" innerClassName="p-3" className="[&>.frame-inner]:!overflow-visible">
          <span className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Reliquie</span>
          <RelicBar relics={c.run.relics} className="mt-2" onUse={c.useConsumableRelic} team={c.run.team} />
        </Frame>
      </motion.aside>
      <div className="min-w-0 flex-1">{content}</div>
    </div>
  )

  const renderView = () => {
    switch (c.view) {
      case 'draft':
        // Campaign-only: endless's draft/house-pick phase is handled by EndlessRunner
        // BEFORE RunBRunner ever mounts (see hooks/useEndless.ts — the recorded/replayed
        // starterOffer+chooseStarters flow is a different UI than DraftScreen's free
        // 2-of-N pick). Guard defensively rather than crash if ever reached without it.
        return c.completeDraft
          ? <DraftScreen seed={c.run.seed} onComplete={c.completeDraft} fixedOffer={tutorialOffer} />
          : null

      case 'map':
        return withTeamSidebar(
          <MapScreen
            map={c.run.map ?? []}
            currentNodeId={c.run.currentNodeId ?? ''}
            reachableIds={c.reachable.map(n => n.id)}
            onChoose={c.chooseNode}
            area={area}
            areasTotal={c.areasTotal}
            noRecruits={c.run.runModifiers?.noRecruits}
          />,
        )

      case 'battle': {
        const b = c.battle!
        const title = b.isFinalBoss ? `Boss: ${b.bossName ?? BOSSES[0]!.name}` : b.isBoss ? 'Boss' : 'Battaglia'
        return (
          <>
            <DuoToast duoIds={c.newlyDiscoveredDuoIds ?? []} />
            <BattleScreen
              result={b.result}
              playerTeam={b.playerTeam}
              playerSyn={b.playerSyn}
              playerRelics={c.run.relics}
              enemy={b.enemy}
              enemySyn={b.enemySyn}
              enemyLevel={b.enemyLevel}
              rightMenace={b.rightMenace}
              rightRelics={b.rightRelics}
              rightDamageReduction={b.rightDamageReduction}
              rightIgnoresTaunt={b.rightIgnoresTaunt}
              title={title}
              onFinish={c.commitBattle}
            />
          </>
        )
      }

      case 'victory': {
        const b = c.battle!
        const allUnits = [...c.run.team, ...b.enemy]
        const nameById: Record<string, string> = {}
        for (const d of allUnits) {
          nameById[d.wizard.id] = displayName(d)
        }
        const mvpName = nameById[b.result.mvpId] ?? b.result.mvpId
        const node = c.currentNode!
        const { floor } = parseAreaNodeId(node.id)
        const battleNumber = floor + 1
        const enemyCount = BALANCE.map.floorsPerArea - 1
        const bossNext = floor === BALANCE.map.floorsPerArea - 2
        // LE SPOGLIE — solo dopo una battaglia NORMALE di campagna: élite e boss hanno già le
        // loro ricompense (§5 del piano), e l'endless non passa `chooseSpoil` (§6). L'offerta
        // si genera dal seed+nodo, quindi ri-renderizzare non la cambia mai; il controller la
        // rigenera identica quando applica la scelta.
        const spoils = c.chooseSpoil && node.type === 'battle'
          ? rollSpoils(c.run, spoilsRngForNode(c.run.seed, node.id))
          : undefined
        return (
          <VictoryScreen
            result={b.result}
            mvpName={mvpName}
            battleNumber={battleNumber}
            enemyCount={enemyCount}
            bossNext={bossNext}
            fallenNames={c.lastFallen}
            onNext={c.acknowledgeVictory}
            spoils={spoils}
            team={c.run.team}
            onChooseSpoil={c.chooseSpoil}
          />
        )
      }

      case 'recruit':
        return withTeamSidebar(
          <RecruitScreen
            offer={recruitOffer(c.run, c.currentNode!, createRng(c.run.seed))}
            team={c.run.team}
            teamMax={c.run.teamMax ?? 5}
            relics={c.run.relics}
            onPick={c.chooseRecruit}
            onSkip={c.skipRecruit}
            noRecruits={c.run.runModifiers?.noRecruits}
          />,
        )

      case 'relic':
        return withTeamSidebar(
          <RelicNodeScreen
            offer={relicOffer(c.run, c.currentNode!, createRng(c.run.seed))}
            owned={c.run.relics}
            team={c.run.team}
            onPick={(relicId, assignedTo, replaceRelicId) => c.chooseRelic(relicId, assignedTo, replaceRelicId)}
          />,
        )

      case 'altare':
        // Campaign-only: altare nodes never generate in endless (Task 6 — mirrors shop's
        // exclusion), so buyAltare/skipAltare are optional on RunnerController and this view
        // is unreachable in endless.
        return c.buyAltare && c.skipAltare
          ? withTeamSidebar(
              <AltareScreen
                offers={altareOffer(c.run, c.currentNode!, createRng(c.run.seed))}
                team={c.run.team}
                owned={c.run.relics}
                onBuy={(relicId, choice) => c.buyAltare!(relicId, choice.costWizardId, choice.costRelicId, choice.carrierId, choice.replaceRelicId)}
                onSkip={c.skipAltare}
              />,
            )
          : null

      case 'event':
        return withTeamSidebar(
          <EventScreen event={c.currentEvent!} onChoose={c.chooseEventOption} />,
        )

      case 'spellForge':
        return withTeamSidebar(
          <SpellForgeScreen team={c.run.team} onUpgrade={c.chooseSpellUpgrade} />,
        )

      case 'spellSwap':
        // Campaign-only: endless areas never generate spellSwap nodes (weight zeroed in
        // nodeGen.ts when state.endless), so this view is unreachable in endless.
        return c.chooseSpellSwap
          ? withTeamSidebar(
              <SpellSwapScreen
                team={c.run.team}
                offers={swapOffer(c.run, c.currentNode!, createRng(c.run.seed)).map(s => s.id)}
                onConfirm={c.chooseSpellSwap}
              />,
            )
          : null

      case 'infirmary':
        return withTeamSidebar(
          <InfirmaryScreen team={c.run.team} onContinue={c.ackInfirmary} />,
        )

      case 'area-cleared':
        return (
          <AreaClearedScreen
            area={area}
            areasTotal={c.areasTotal}
            summary={runSummary(c.run)}
            onContinue={c.advanceArea}
          />
        )

      case 'win':
        // Campaign: the LAST area's boss win — show the terminal win screen.
        // Endless: 'win' is NOT terminal. The shared combat resolver
        // (game/engine/resolvers/combat.ts phaseAfterNode) isn't endless-aware — it
        // sets phase:'win' after ANY boss win once area >= BALANCE.map.areas-1, which
        // in an infinite run means every area from index 2 onward. useEndless.test.tsx's
        // driver documents this explicitly and treats 'win' exactly like 'area-cleared'
        // (call advanceArea to generate the next area) — mirror that here.
        return c.restart ? (
          <ResultScreen
            outcome="win"
            seed={c.run.seed}
            stageReached={area + 1}
            enemyCount={c.areasTotal ?? area + 1}
            onRestart={c.restart}
            reward={c.runReward}
            onCollection={() => router.push('/collection')}
            onMenu={() => router.push('/')}
          />
        ) : (
          <AreaClearedScreen
            area={area}
            areasTotal={c.areasTotal}
            summary={runSummary(c.run)}
            onContinue={c.advanceArea}
          />
        )

      case 'defeat':
        // Endless's own defeat/wipeout screen (EndlessResult) is rendered by
        // EndlessRunner OUTSIDE this component once c.score !== null, so this
        // campaign ResultScreen branch is only reached for campaign (c.restart set).
        return c.restart ? (
          <ResultScreen
            outcome="defeat"
            seed={c.run.seed}
            stageReached={area + 1}
            enemyCount={c.areasTotal ?? area + 1}
            onRestart={c.restart}
            reward={c.runReward}
            onCollection={() => router.push('/collection')}
            onMenu={() => router.push('/')}
          />
        ) : null

      default:
        return null
    }
  }

  return (
    <TutorialProvider active={tutorial} ctx={tutorialCtx}>
      <AnimatePresence mode="wait">
        <motion.div
          key={animKey}
          variants={reduce ? undefined : screenVariants}
          initial={reduce ? { opacity: 0 } : 'initial'}
          animate={reduce ? { opacity: 1 } : 'animate'}
          exit={reduce ? { opacity: 0 } : 'exit'}
          className="flex-1 flex flex-col"
        >
          {renderView()}
        </motion.div>
      </AnimatePresence>
      <TutorialOverlay />
    </TutorialProvider>
  )
}
