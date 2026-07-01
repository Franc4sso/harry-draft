'use client'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRunB } from '@/hooks/useRunB'
import { DraftScreen } from './DraftScreen'
import { MapScreen } from './MapScreen'
import { BattleScreen } from './BattleScreen'
import { VictoryScreen } from './VictoryScreen'
import { ResultScreen } from './ResultScreen'
import { RecruitScreen } from './RecruitScreen'
import { RelicNodeScreen } from './RelicNodeScreen'
import { InfirmaryScreen } from './InfirmaryScreen'
import { AreaClearedScreen } from './AreaClearedScreen'
import { TeamSynergyBar } from '@/components/run/TeamSynergyBar'
import { RelicBar } from '@/components/relics/RelicBar'
import { recruitOffer, relicOffer } from '@/game/engine/resolvers/recruit'
import { createRng } from '@/game/engine/rng'
import { runSummary } from '@/lib/runSummary'
import { displayName } from '@/lib/displayName'
import { BOSSES } from '@/data/bosses'
import { BALANCE } from '@/data/constants'
import { parseAreaNodeId } from '@/game/engine/map'

export function RunBRunner({ seed, onExit: _onExit }: { seed: string; onExit?: () => void }) {
  const c = useRunB(seed)
  const animKey = `${c.view}-${c.run.currentNodeId ?? c.area}`

  // Between-battle phases (map / recruit / relic) show the roster + owned relics as a
  // larger LEFT sidebar beside the screen content, so the player can read their wizards
  // and relics while choosing a path / recruit / relic. Battle and the end screens
  // don't use it (battle shows relics in-fight).
  const withTeamSidebar = (content: ReactNode) => (
    <div className="flex-1 flex flex-row items-start gap-4 p-3">
      <aside className="sticky top-3 flex w-56 shrink-0 flex-col gap-3">
        <TeamSynergyBar
          team={c.run.team}
          synergies={c.run.activeSynergies}
          orientation="vertical"
          onSetSpell={c.setWizardSpell}
        />
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Reliquie</span>
          <RelicBar relics={c.run.relics} className="mt-2" onUse={c.useConsumableRelic} team={c.run.team} />
        </div>
      </aside>
      <div className="min-w-0 flex-1">{content}</div>
    </div>
  )

  const renderView = () => {
    switch (c.view) {
      case 'draft':
        return <DraftScreen seed={seed} onComplete={c.completeDraft} />

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
        )

      case 'battle': {
        const b = c.battle!
        const title = b.isFinalBoss ? `Boss: ${BOSSES[0]!.name}` : b.isBoss ? 'Boss' : 'Battaglia'
        return (
          <BattleScreen
            result={b.result}
            playerTeam={b.playerTeam}
            playerSyn={b.playerSyn}
            playerRelics={c.run.relics}
            enemy={b.enemy}
            enemySyn={b.enemySyn}
            enemyLevel={b.enemyLevel}
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

      case 'infirmary':
        return withTeamSidebar(
          <InfirmaryScreen team={c.run.team} onContinue={c.ackInfirmary} />,
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
            seed={seed}
            stageReached={c.area + 1}
            enemyCount={c.areasTotal}
            onRestart={c.restart}
          />
        )

      case 'defeat':
        return (
          <ResultScreen
            outcome="defeat"
            seed={seed}
            stageReached={c.area + 1}
            enemyCount={c.areasTotal}
            onRestart={c.restart}
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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex-1 flex flex-col"
      >
        {renderView()}
      </motion.div>
    </AnimatePresence>
  )
}
