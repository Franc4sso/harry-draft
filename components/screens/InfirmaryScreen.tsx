'use client'
import type { DraftedWizard } from '@/types'
import { Button } from '@/components/ui/Button'

export function InfirmaryScreen({
  team,
  onContinue,
}: {
  team: DraftedWizard[]
  onContinue: () => void
}) {
  return (
    <main className="flex-1 w-full flex flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-8 py-6 max-w-md shadow-[0_0_32px_rgba(52,211,153,0.12)]">
        <p className="text-3xl mb-3" aria-hidden>+</p>
        <h1 className="font-display text-2xl text-emerald-200">Infermeria</h1>
        <p className="mt-2 text-sm text-white/70 leading-relaxed">
          L&apos;Infermeria ti rimette in sesto — tutti tornano in piena salute.
        </p>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-xs">
        {team.map(d => (
          <div key={d.wizard.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm">
            <span className="text-white/80">{d.wizard.name}</span>
            <span className="text-emerald-300 font-semibold">{d.maxHp} / {d.maxHp} HP</span>
          </div>
        ))}
      </div>

      <Button variant="primary" onClick={onContinue}>Continua</Button>
    </main>
  )
}
