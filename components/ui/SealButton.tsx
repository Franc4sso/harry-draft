'use client'
import { cn } from '@/lib/cn'

export function SealButton({
  children, onClick, disabled, className, ...rest
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'seal btn-sheen-host relative overflow-hidden rounded-2xl px-12 py-4 font-display text-base font-bold uppercase tracking-[0.22em] text-[#241206] emboss',
        'transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.97]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f6e6a8] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:opacity-45 disabled:cursor-not-allowed disabled:active:scale-100',
        className,
      )}
    >
      {!disabled && <span aria-hidden className="btn-sheen" />}
      <span className="relative">{children}</span>
    </button>
  )
}
