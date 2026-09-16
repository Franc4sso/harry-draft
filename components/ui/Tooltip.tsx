'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/theme'

/**
 * Tap-and-hover tooltip. Works on desktop (hover) AND mobile (tap), where the
 * native `title` attribute shows nothing. The trigger is a real button that
 * stops event propagation, so tapping it never triggers a clickable ancestor
 * (e.g. a draft card's "pick" handler). Tapping outside closes it.
 */
export function Tooltip({
  content, label, className, triggerClassName, children,
}: {
  content: ReactNode
  /** Accessible name for the trigger; omit when the child already carries one. */
  label?: string
  /** Positioning wrapper (the popover anchors to this). */
  className?: string
  /** The visible trigger styling (e.g. an icon badge). */
  triggerClassName?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const popRef = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  /**
   * La posizione si MISURA, non si decide a priori.
   *
   * Prima il popover era sempre `absolute bottom-full left-0` con `w-44` fisso, e
   * si rompeva in tre modi diversi — tutti dallo stesso difetto: su un trigger
   * vicino al bordo destro usciva a destra; su uno in cima alla finestra usciva
   * sopra; dentro un contenitore con `overflow-hidden` veniva tagliato.
   *
   * `position: fixed` risolve il terzo caso (esce dal flusso, quindi nessun
   * antenato lo ritaglia) e rende gli altri due un calcolo: si guarda lo spazio
   * sopra e sotto il trigger e si sceglie il lato, poi si vincola l'orizzontale
   * dentro la finestra con un margine.
   */
  const MARGIN = 8
  const place = useCallback(() => {
    const trigger = ref.current
    const pop = popRef.current
    if (!trigger || !pop) return
    const t = trigger.getBoundingClientRect()
    const p = pop.getBoundingClientRect()

    // Verticale: sotto se di sopra non ci sta e di sotto sì.
    const spaceAbove = t.top
    const spaceBelow = window.innerHeight - t.bottom
    const sopra = spaceAbove >= p.height + MARGIN || spaceAbove >= spaceBelow
    const top = sopra ? t.top - p.height - 6 : t.bottom + 6

    // Orizzontale: allineato al trigger, poi vincolato dentro la finestra.
    const maxLeft = window.innerWidth - p.width - MARGIN
    const left = Math.max(MARGIN, Math.min(t.left, Math.max(MARGIN, maxLeft)))

    setPos({ top: Math.max(MARGIN, Math.min(top, window.innerHeight - p.height - MARGIN)), left })
  }, [])

  // `useLayoutEffect`: si posiziona PRIMA della pittura, altrimenti il popover
  // lampeggia per un frame nell'angolo sbagliato prima di saltare al posto giusto.
  //
  // Due misure, non una: alla prima passata il popover puo' non avere ancora la
  // sua altezza definitiva (font non applicato, contenuto che manda a capo), e la
  // posizione calcolata su un'altezza sbagliata resta poi INCHIODATA li'. Misurato
  // a 390x844: un tooltip finiva a `top: -356` con il clamp che, da solo, avrebbe
  // dovuto impedirlo — segno che il valore era stantio, non mal calcolato.
  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    place()
    const raf = requestAnimationFrame(place)
    return () => cancelAnimationFrame(raf)
  }, [open, place])

  // Se il trigger esce dalla finestra (la schermata avanza, una lista scorre) il
  // popover va chiuso invece di restare ancorato a coordinate che non esistono piu'.
  useEffect(() => {
    if (!open) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => { if (e && !e.isIntersecting) setOpen(false) })
    io.observe(el)
    return () => io.disconnect()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onMove = () => place()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, place])

  // The popover anchors to this wrapper, so it must be a positioned ancestor.
  // Default to `relative`, but if the caller positions the wrapper itself
  // (e.g. `absolute bottom-2 left-2`), don't also emit `relative` — our `cn`
  // is a plain join with no Tailwind conflict resolution, and two `position`
  // utilities would let the cascade pick the wrong one (hiding the trigger).
  const positioned = /\b(absolute|fixed|relative|sticky)\b/.test(className ?? '')

  useEffect(() => {
    if (!open) return
    const onDocPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointer)
    return () => document.removeEventListener('pointerdown', onDocPointer)
  }, [open])

  return (
    <span ref={ref} className={cn('inline-flex', !positioned && 'relative', className)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onPointerDown={(e) => e.stopPropagation()}
        // Il click col MOUSE tiene aperto, non fa toggle: su desktop l'hover ha
        // già aperto il popover, quindi un toggle cieco lo richiuderebbe subito
        // e cliccare un tooltip sembrerebbe non fare nulla. Col dito l'hover non
        // esiste (`detail === 0` per i click sintetici da tocco/tastiera), e lì
        // il toggle è il comportamento giusto: tocco per aprire, ritocco per chiudere.
        onClick={(e) => {
          e.stopPropagation()
          const fromMouse = e.detail > 0
          setOpen((o) => (fromMouse ? true : !o))
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
        className={triggerClassName}
      >
        {children}
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <span
          ref={popRef}
          role="tooltip"
          // `fixed` + PORTALE su <body>. Il solo `fixed` non bastava: un antenato
          // con `filter` — anche `blur(0px)`, lasciato da un'animazione di
          // transizione — crea un containing block, e `fixed` si ancora a QUELLO
          // invece che al viewport. Misurato: il calcolo diceva top 348, il DOM
          // 356 sopra il bordo. Il portale toglie il popover da sotto qualsiasi
          // antenato, quindi ne' un filter ne' un `overflow-hidden` lo toccano.
          // `max-w` invece di `w-44` fisso: su schermi stretti il testo si adatta
          // invece di sporgere. Invisibile finche' non e' misurato, cosi' non si
          // vede un lampo nell'angolo sbagliato.
          style={{
            position: 'fixed',
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            visibility: pos ? 'visible' : 'hidden',
          }}
          className="z-50 w-44 max-w-[calc(100vw-16px)] rounded-lg border border-white/15 bg-[#15121f]/95 px-2 py-1.5 text-left text-[10px] font-normal leading-snug text-white/85 shadow-xl backdrop-blur-sm"
        >
          {content}
        </span>,
        document.body,
      )}
    </span>
  )
}
