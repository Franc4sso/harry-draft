'use client'
import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DraftedWizard } from '@/types'
import { useRun } from '@/hooks/useRun'
import { BOSSES } from '@/data/bosses'
import { TeamScreen } from './TeamScreen'
import { BattleScreen } from './BattleScreen'
import { VictoryScreen } from './VictoryScreen'
import { BossScreen } from './BossScreen'
import { ResultScreen } from './ResultScreen'
import { RelicChoiceScreen } from './RelicChoiceScreen'
import { MapScreen } from './MapScreen'

const BOSS_NAME = BOSSES[0]?.name ?? 'Boss Finale'

/**
 * Walks a confirmed team through the whole campaign, mapping the useRun state
 * machine onto the right screen for each step.
 */
export function CampaignRunner({
  seed, team, onRestart,
}: {
  seed: string
  team: DraftedWizard[]
  onRestart: () => void
}) {
  const c = useRun(seed, team)

  // mvp ids are plain wizard ids; resolve a display name across both teams.
  const nameById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const dw of team) map[dw.wizard.id] = dw.wizard.name
    for (const dw of c.battle?.enemy ?? []) map[dw.wizard.id] = dw.wizard.name
    return map
  }, [team, c.battle])

  let view: React.ReactNode = null
  switch (c.view) {
    case 'team':
      view = <TeamScreen team={team} onConfirm={c.enterMap} onRestart={onRestart} />
      break

    case 'map':
      if (!c.run.map || !c.run.currentNodeId) break
      view = (
        <MapScreen
          map={c.run.map}
          currentNodeId={c.run.currentNodeId}
          reachableIds={c.reachable.map(n => n.id)}
          onChoose={c.chooseNode}
        />
      )
      break

    case 'boss':
      view = <BossScreen bossName={BOSS_NAME} onBegin={c.startBattle} />
      break

    case 'battle': {
      if (!c.battle) break
      const isBoss = c.battle.isBoss
      view = (
        <BattleScreen
          result={c.battle.result}
          playerTeam={team}
          playerSyn={c.run.activeSynergies}
          playerRelics={c.run.relics}
          enemy={c.battle.enemy}
          enemySyn={c.battle.enemySyn}
          title={isBoss ? `Boss: ${BOSS_NAME}` : `Sfida ${c.battleNumber} di ${c.enemyCount}`}
          rightTitle={isBoss ? 'Boss Finale' : 'Avversari'}
          onFinish={c.revealResult}
        />
      )
      break
    }

    case 'victory': {
      if (!c.battle) break
      view = (
        <VictoryScreen
          result={c.battle.result}
          mvpName={nameById[c.battle.result.mvpId] ?? c.battle.result.mvpId}
          battleNumber={c.battleNumber}
          enemyCount={c.enemyCount}
          bossNext={c.bossNext}
          onNext={c.advance}
        />
      )
      break
    }

    case 'win':
      view = (
        <ResultScreen
          outcome="win" seed={seed} stageReached={c.run.stage}
          enemyCount={c.enemyCount} onRestart={onRestart}
        />
      )
      break

    case 'defeat':
      view = (
        <ResultScreen
          outcome="defeat" seed={seed} stageReached={c.battleNumber}
          enemyCount={c.enemyCount} onRestart={onRestart}
        />
      )
      break

    case 'relic-choice':
      view = (
        <RelicChoiceScreen
          choices={c.relicChoices}
          owned={c.run.relics}
          onChoose={c.chooseRelic}
        />
      )
      break
  }

  // Crossfade between campaign phases. Key by view + current node (falling
  // back to stage) so consecutive map/battle transitions still re-animate.
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${c.view}-${c.run.currentNodeId ?? c.run.stage}`}
        className="flex-1 flex flex-col"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        {view}
      </motion.div>
    </AnimatePresence>
  )
}
