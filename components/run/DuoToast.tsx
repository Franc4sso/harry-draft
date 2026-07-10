'use client'
import { DUO_BY_ID } from '@/data/duos'

/**
 * First-discovery banner: "‹Nome› scoperta!" for each Duo id newly added to the run's
 * profile.codex.duosSeen this node-choice. Purely presentational, no camera shake, no
 * heavy animation — a static gold banner above the battle intro. Renders nothing when
 * `duoIds` is empty (the common case — most node choices discover nothing new).
 */
export function DuoToast({ duoIds }: { duoIds: string[] }) {
  if (duoIds.length === 0) return null
  return (
    <div
      data-testid="duo-toast"
      className="fixed left-1/2 top-4 z-50 flex -translate-x-1/2 flex-col items-center gap-1 rounded-xl border border-[#d9b65f]/50 bg-[rgba(20,16,33,0.92)] px-4 py-2 text-center shadow-[0_0_18px_rgba(217,182,95,0.2)]"
    >
      {duoIds.map((id) => {
        const duo = DUO_BY_ID[id]
        if (!duo) return null
        return (
          <p key={id} className="font-display text-sm font-semibold tracking-wide text-[#f3e6c4]">
            {duo.name} scoperta!
          </p>
        )
      })}
    </div>
  )
}
