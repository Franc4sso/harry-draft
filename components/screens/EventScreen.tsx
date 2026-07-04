'use client'
import { motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Frame } from '@/components/ui/Frame'
import { Insegna } from '@/components/ui/Insegna'
import { Parchment } from '@/components/ui/Parchment'
import { Stagger, StaggerItem, EASE_CINEMATIC } from '@/components/ui/motion'

export interface EventChoice {
  id: string
  label: string
  enabled: boolean
  reason?: string
}

export interface EventData {
  title: string
  text: string
  choices: EventChoice[]
}

/** A narrative map event: a title, some flavor text, and a handful of choices —
 *  some of which may be gated (disabled, with a reason shown beneath). */
export function EventScreen({ event, onChoose }: { event: EventData; onChoose: (id: string) => void }) {
  const reduce = useReducedMotion()
  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-6">
      <Insegna kicker="Evento" title={event.title} />

      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_CINEMATIC }}
        className="w-full max-w-2xl"
      >
        <Frame variant="panel" innerClassName="relative overflow-hidden p-5">
          <Parchment className="absolute inset-0" />
          <p className="relative text-center text-sm leading-relaxed text-white/80">{event.text}</p>
        </Frame>
      </motion.div>

      <Stagger delay={0.15} className="flex w-full max-w-2xl flex-col items-center gap-3">
        {event.choices.map(choice => (
          <StaggerItem key={choice.id} className="flex w-full flex-col items-center gap-1.5">
            <Button
              variant="primary"
              disabled={!choice.enabled}
              onClick={() => choice.enabled && onChoose(choice.id)}
              className="w-full max-w-md"
            >
              {choice.label}
            </Button>
            {!choice.enabled && choice.reason && (
              <p className="text-center text-xs text-white/45">{choice.reason}</p>
            )}
          </StaggerItem>
        ))}
      </Stagger>
    </main>
  )
}
