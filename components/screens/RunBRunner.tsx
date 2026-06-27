'use client'
import { AnimatePresence, motion } from 'framer-motion'
import { useRunB } from '@/hooks/useRunB'
import { DraftScreen } from './DraftScreen'
import { MapScreen } from './MapScreen'
import { BattleScreen } from './BattleScreen'
import { VictoryScreen } from './VictoryScreen'
import { ResultScreen } from './ResultScreen'
import { RecruitScreen } from './RecruitScreen'
import { RelicNodeScreen } from './RelicNodeScreen'
import { AreaClearedScreen } from './AreaClearedScreen'
import { TeamSynergyBar } from '@/components/run/TeamSynergyBar'
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
  // Persistent team + synergy strip on the between-battle phases. Battle has its
  // own in-fight synergy display, and the end screens (draft/win/defeat) don't
  // need it — so it's scoped to map/recruit/relic only.
  const showTeamBar = c.view === 'map' || c.view === 'recruit' || c.view === 'relic'

  const renderView = () => {
    switch (c.view) {
      case 'draft':
        return <DraftScreen seed={seed} onComplete={c.completeDraft} />

      case 'map':
        return (
          <MapScreen
            map={c.run.map ?? []}
            currentNodeId={c.run.currentNodeId ?? ''}
            reachableIds={c.reachable.map(n => n.id)}
            onChoose={c.chooseNode}
            area={c.area}
            areasTotal={c.areasTotal}
          />
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
        return (
          <RecruitScreen
            offer={recruitOffer(c.run, c.currentNode!, createRng(c.run.seed))}
            team={c.run.team}
            teamMax={c.run.teamMax ?? 5}
            onPick={c.chooseRecruit}
          />
        )

      case 'relic':
        return (
          <RelicNodeScreen
            offer={relicOffer(c.run, c.currentNode!, createRng(c.run.seed))}
            owned={c.run.relics}
            onPick={c.chooseRelic}
          />
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
        {showTeamBar && (
          <div className="sticky top-0 z-10 px-3 pt-3">
            <TeamSynergyBar team={c.run.team} synergies={c.run.activeSynergies} />
          </div>
        )}
        {renderView()}
      </motion.div>
    </AnimatePresence>
  )
}
