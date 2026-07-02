'use client'
import { cn } from '@/lib/cn'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger'
  className?: string
  disabled?: boolean
}

export function Button({ children, onClick, variant = 'primary', className, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'btn-sheen-host relative overflow-hidden px-6 py-3 rounded-xl font-display tracking-[0.14em] text-sm uppercase transition-all duration-200',
        'active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f3e6a0] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
        variant === 'primary' && 'elev-gold font-bold text-[#1a1206] hover:-translate-y-0.5 hover:brightness-105',
        variant === 'ghost' &&
          'border border-white/15 bg-white/[0.04] text-white/75 hover:border-gold/40 hover:bg-white/[0.08] hover:text-white',
        variant === 'danger' &&
          'border border-red-400/30 bg-gradient-to-b from-red-900/50 to-red-950/60 text-red-100 hover:border-red-300/50 hover:brightness-115 shadow-[0_10px_28px_-10px_rgba(150,30,30,0.5)]',
        className,
      )}
      style={
        variant === 'primary'
          ? { backgroundImage: 'linear-gradient(180deg, #f3e0a0 0%, #caa24a 55%, #b0853a 100%)' }
          : undefined
      }
    >
      {variant === 'primary' && !disabled && <span aria-hidden className="btn-sheen" />}
      <span className="relative">{children}</span>
    </button>
  )
}
