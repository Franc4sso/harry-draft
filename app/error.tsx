'use client' // Error boundaries must be Client Components (Next 16: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md)

import { useEffect } from 'react'

/**
 * Route-level error boundary — wraps every page/layout under `app/`. Added for Task 5 of
 * "la vetrata e gli incantesimi": `lib/battleStacks.ts` (`familyOf`) now throws BY DESIGN on
 * a status id it doesn't recognise, and that fail-fast is what made its guard falsifiable
 * (see `.superpowers/sdd/2026-09-16-vetrata-e-incantesimi/progress.md`, Task 1's ruling) —
 * it earns its keep and stays. But before this file, there was NO ErrorBoundary anywhere in
 * the project (grep for componentDidCatch/ErrorBoundary/app/error.tsx/app/global-error.tsx
 * all came back empty), so an engine-emitted status missing from that map would crash the
 * entire battle screen to a white page instead of degrading. This contains the blast radius:
 * a thrown render error now shows a recoverable screen instead.
 *
 * Next 16's `error.js` convention: a Client Component receiving `error` and `unstable_retry`
 * (the current retry API — this project's own AGENTS.md warns this Next version's
 * conventions may differ from training data; verified against the docs above rather than
 * assumed from memory).
 */
export default function ErrorScreen({
  error, unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#070610] px-6 text-center text-[#f2eee4]">
      <h1 className="font-display text-2xl font-bold text-[#e8d49a]">Qualcosa è andato storto</h1>
      <p className="max-w-md text-sm text-white/60">
        Un errore imprevisto ha interrotto questa schermata. Puoi riprovare senza perdere la partita.
      </p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="rounded-full border border-[#b8963f]/50 bg-white/[0.04] px-5 py-2 text-sm font-semibold uppercase tracking-wide text-[#e8d49a] transition-colors hover:bg-white/[0.08]"
      >
        Riprova
      </button>
    </main>
  )
}
