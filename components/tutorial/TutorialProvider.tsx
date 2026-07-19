'use client'
import { createContext, useContext, useState, useMemo } from 'react'
import { TUTORIAL_STEPS, type TutorialCtx, type TutorialStep } from './steps'

export interface TutorialControls {
  active: boolean
  visibleStep: TutorialStep | null
  advance: () => void
  skip: () => void
}

const Ctx = createContext<TutorialControls | null>(null)

export function useTutorial(): TutorialControls {
  const c = useContext(Ctx)
  if (!c) throw new Error('useTutorial must be used within <TutorialProvider>')
  return c
}

export function TutorialProvider(
  { active, ctx, children }: { active: boolean; ctx: TutorialCtx; children: React.ReactNode },
) {
  const [stepIndex, setStepIndex] = useState(0)
  const [skipped, setSkipped] = useState(false)
  const isActive = active && !skipped

  const value = useMemo<TutorialControls>(() => {
    const step = TUTORIAL_STEPS[stepIndex]
    const visibleStep = isActive && step && step.when(ctx) ? step : null
    return {
      active: isActive,
      visibleStep,
      advance: () => setStepIndex(i => Math.min(i + 1, TUTORIAL_STEPS.length)),
      skip: () => setSkipped(true),
    }
  }, [isActive, stepIndex, ctx])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
