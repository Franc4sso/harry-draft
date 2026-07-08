'use client'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { screenVariants } from '@/components/ui/motion'
import { Frame } from '@/components/ui/Frame'
import { useRunB } from '@/hooks/useRunB'
import { DraftScreen } from './DraftScreen'
import { MapScreen } from './MapScreen'
import { BattleScreen } from './BattleScreen'
import { VictoryScreen } from './VictoryScreen'
import { ResultScreen } from './ResultScreen'
import { RecruitScreen } from './RecruitScreen'
import { RelicNodeScreen } from './RelicNodeScreen'
import { EventScreen } from './EventScreen'
import { SpellForgeScreen } from './SpellForgeScreen'
import { InfirmaryScreen } from './InfirmaryScreen'
import { AreaClearedScreen } from './AreaClearedScreen'
import { ShopScreen } from './ShopScreen'
import { TeamSynergyBar } from '@/components/run/TeamSynergyBar'
import { RelicBar } from '@/components/relics/RelicBar'
import { recruitOffer, relicOffer } from '@/game/engine/resolvers/recruit'
import { shopOffer } from '@/game/engine/resolvers/shop'
import { createRng } from '@/game/engine/rng'
import { runSummary } from '@/lib/runSummary'
import { displayName } from '@/lib/displayName'
import { BOSSES } from '@/data/bosses'
import { BALANCE } from '@/data/constants'
import { parseAreaNodeId } from '@/game/engine/map'

export function RunBRunner({ seed, onExit: _onExit }: { seed: string; onExit?: () => void }) {
  const c = useRunB(seed)
  const router = useRouter()
  const reduce = useReducedMotion()
  const animKey = `${c.view}-${c.run.currentNodeId ?? c.area}`

  // Between-battle phases (map / recruit / relic) show the roster + owned relics as a
  // larger LEFT sidebar beside the screen content, so the player can read their wizards
  // and relics while choosing a path / recruit / relic. Battle and the end screens
  // don't use it (battle shows relics in-fight).
  // `editable` gates the per-wizard spell selector. The map (tree) view is a read-only
  // overview — you pick a path there, you don't manage loadouts — so it omits onSetSpell
  // and the rows stay collapsed with no spell pool. Other nodes keep it editable.
  const withTeamSidebar = (content: ReactNode, editable = true) => (
    <div className="flex-1 flex flex-row items-start gap-4 p-3">
      <motion.aside
        initial={reduce ? false : { opacity: 0, x: -18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        className="sticky top-3 flex w-72 shrink-0 flex-col gap-3"
      >
        <TeamSynergyBar
          team={c.run.team}
          synergies={c.run.activeSynergies}
          orientation="vertical"
          onSetSpell={editable ? c.setWizardSpell : undefined}
        />
        <Frame variant="panel" innerClassName="p-3">
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
        return <DraftScreen seed={c.run.seed} onComplete={c.completeDraft} />

      case 'map':
        return withTeamSidebar(
          <MapScreen
            map={c.run.map ?? []}
            currentNodeId={c.run.currentNodeId ?? ''}
            reachableIds={c.reachable.map(n => n.id)}
            onChoose={c.chooseNode}
            area={c.area}
            areasTotal={c.areasTotal}
          />,
          false, // tree view: read-only, no spell selector
        )

      case 'battle': {
        const b = c.battle!
        const title = b.isFinalBoss ? `Boss: ${b.bossName ?? BOSSES[0]!.name}` : b.isBoss ? 'Boss' : 'Battaglia'
        return (
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
        const { floor } = parseAreaNodeId(c.currentNode!.id)
        const battleNumber = floor + 1
        const enemyCount = BALANCE.map.floorsPerArea - 1
        const bossNext = floor === BALANCE.map.floorsPerArea - 2
        return (
          <VictoryScreen
            result={b.result}
            mvpName={mvpName}
            battleNumber={battleNumber}
            enemyCount={enemyCount}
            bossNext={bossNext}
            fallenNames={c.lastFallen}
            onNext={c.acknowledgeVictory}
          />
        )
      }

      case 'recruit':
        return withTeamSidebar(
          <RecruitScreen
            offer={recruitOffer(c.run, c.currentNode!, createRng(c.run.seed))}
            team={c.run.team}
            teamMax={c.run.teamMax ?? 5}
            onPick={c.chooseRecruit}
            onSkip={c.skipRecruit}
          />,
        )

      case 'relic':
        return withTeamSidebar(
          <RelicNodeScreen
            offer={relicOffer(c.run, c.currentNode!, createRng(c.run.seed))}
            owned={c.run.relics}
            team={c.run.team}
            onPick={(relicId, assignedTo) => c.chooseRelic(relicId, assignedTo)}
          />,
        )

      case 'event':
        return withTeamSidebar(
          <EventScreen event={c.currentEvent!} onChoose={c.chooseEventOption} />,
        )

      case 'spellForge':
        return withTeamSidebar(
          <SpellForgeScreen team={c.run.team} onUpgrade={c.chooseSpellUpgrade} />,
        )

      case 'infirmary':
        return withTeamSidebar(
          <InfirmaryScreen team={c.run.team} onContinue={c.ackInfirmary} />,
        )

      case 'shop':
        return withTeamSidebar(
          <ShopScreen
            stock={shopOffer(c.run, c.currentNode!, createRng(c.run.seed))}
            bought={c.currentNode?.shopBought ?? []}
            cioccorane={c.cioccorane}
            team={c.run.team}
            onBuy={c.buyShopItem}
            onReroll={c.rerollShop}
            onLeave={c.leaveShop}
          />,
        )

      case 'area-cleared':
        return (
          <AreaClearedScreen
            area={c.area}
            areasTotal={c.areasTotal}
            summary={runSummary(c.run)}
            onContinue={c.advanceArea}
          />
        )

      case 'win':
        return (
          <ResultScreen
            outcome="win"
            seed={c.run.seed}
            stageReached={c.area + 1}
            enemyCount={c.areasTotal}
            onRestart={c.restart}
            reward={c.runReward}
            onCollection={() => router.push('/collection')}
          />
        )

      case 'defeat':
        return (
          <ResultScreen
            outcome="defeat"
            seed={c.run.seed}
            stageReached={c.area + 1}
            enemyCount={c.areasTotal}
            onRestart={c.restart}
            reward={c.runReward}
            onCollection={() => router.push('/collection')}
          />
        )

      default:
        return null
    }
  }

  return (
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
  )
}
