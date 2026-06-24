'use client'
import { cn } from '@/lib/cn'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost'
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
        'px-6 py-3 rounded-xl font-display tracking-wide text-sm uppercase transition-all duration-200',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variant === 'primary' &&
          'bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:shadow-[0_0_24px_rgba(255,255,255,0.25)]',
        variant === 'ghost' && 'text-white/70 hover:text-white',
        className,
      )}
    >
      {children}
    </button>
  )
}
