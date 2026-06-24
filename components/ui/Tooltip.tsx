'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
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

  useEffect(() => {
    if (!open) return
    const onDocPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointer)
    return () => document.removeEventListener('pointerdown', onDocPointer)
  }, [open])

  return (
    <span ref={ref} className={cn('relative inline-flex', className)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
        className={triggerClassName}
      >
        {children}
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-0 z-50 mb-1.5 w-44 rounded-lg border border-white/15 bg-[#15121f]/95 px-2 py-1.5 text-left text-[10px] font-normal leading-snug text-white/85 shadow-xl backdrop-blur-sm"
        >
          {content}
        </span>
      )}
    </span>
  )
}
