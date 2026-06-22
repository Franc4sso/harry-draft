'use client'
import { useMemo } from 'react'
import type { DraftedWizard } from '@/types'
import { useRun } from '@/hooks/useRun'
import { BOSSES } from '@/data/bosses'
import { TeamScreen } from './TeamScreen'
import { BattleScreen } from './BattleScreen'
import { VictoryScreen } from './VictoryScreen'
import { BossScreen } from './BossScreen'
import { ResultScreen } from './ResultScreen'

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

  switch (c.view) {
    case 'team':
      return <TeamScreen team={team} onConfirm={c.startBattle} onRestart={onRestart} />

    case 'boss':
      return <BossScreen bossName={BOSS_NAME} onBegin={c.startBattle} />

    case 'battle': {
      if (!c.battle) return null
      const isBoss = c.battle.isBoss
      return (
        <BattleScreen
          result={c.battle.result}
          playerTeam={team}
          playerSyn={c.run.activeSynergies}
          enemy={c.battle.enemy}
          enemySyn={c.battle.enemySyn}
          title={isBoss ? `Boss: ${BOSS_NAME}` : `Sfida ${c.run.stage} di ${c.enemyCount}`}
          rightTitle={isBoss ? 'Boss Finale' : 'Avversari'}
          onFinish={c.revealResult}
        />
      )
    }

    case 'victory': {
      if (!c.battle) return null
      return (
        <VictoryScreen
          result={c.battle.result}
          mvpName={nameById[c.battle.result.mvpId] ?? c.battle.result.mvpId}
          battleNumber={c.run.stage}
          enemyCount={c.enemyCount}
          bossNext={c.bossNext}
          onNext={c.advance}
        />
      )
    }

    case 'win':
      return (
        <ResultScreen
          outcome="win"
          seed={seed}
          stageReached={c.run.stage}
          enemyCount={c.enemyCount}
          onRestart={onRestart}
        />
      )

    case 'defeat':
      return (
        <ResultScreen
          outcome="defeat"
          seed={seed}
          stageReached={c.run.stage}
          enemyCount={c.enemyCount}
          onRestart={onRestart}
        />
      )
  }
}
