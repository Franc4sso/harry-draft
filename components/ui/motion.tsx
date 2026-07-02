'use client'
/**
 * Shared motion primitives for the premium UI pass. Every primitive degrades
 * to a static render under prefers-reduced-motion.
 */
import type { ReactNode } from 'react'
import { useRef } from 'react'
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type HTMLMotionProps,
  type Variants,
} from 'framer-motion'

/** Signature ease of the whole UI — fast attack, long settle. */
export const EASE_CINEMATIC = [0.22, 1, 0.36, 1] as const

/**
 * Full-screen transition variants for the run loop's AnimatePresence.
 * Blur-in gives the "camera refocus" feel; exit is quicker than entrance.
 */
export const screenVariants: Variants = {
  initial: { opacity: 0, y: 18, scale: 0.985, filter: 'blur(6px)' },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.5, ease: EASE_CINEMATIC },
  },
  exit: {
    opacity: 0,
    y: -12,
    scale: 0.99,
    filter: 'blur(4px)',
    transition: { duration: 0.22, ease: 'easeIn' },
  },
}

const staggerContainer = (delay: number): Variants => ({
  initial: {},
  animate: { transition: { staggerChildren: 0.07, delayChildren: delay } },
})

const staggerItem: Variants = {
  initial: { opacity: 0, y: 16, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: EASE_CINEMATIC } },
}

/** Cascading entrance container — wrap a grid/row of StaggerItem. */
export function Stagger({
  children,
  delay = 0,
  className,
  as = 'div',
  ...rest
}: {
  children: ReactNode
  delay?: number
  className?: string
  /** Rendered element — lets layout-semantic containers (e.g. <section>) stagger directly. */
  as?: 'div' | 'section'
} & Omit<HTMLMotionProps<'div'>, 'variants' | 'children'>) {
  const reduce = useReducedMotion()
  // Both tags share HTMLElement-level props; typing via motion.div keeps the rest-spread sound.
  const Tag = (as === 'section' ? motion.section : motion.div) as typeof motion.div
  return (
    <Tag
      className={className}
      variants={reduce ? undefined : staggerContainer(delay)}
      initial={reduce ? false : 'initial'}
      animate="animate"
      {...rest}
    >
      {children}
    </Tag>
  )
}

export function StaggerItem({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & Omit<HTMLMotionProps<'div'>, 'variants' | 'children'>) {
  const reduce = useReducedMotion()
  return (
    <motion.div className={className} variants={reduce ? undefined : staggerItem} {...rest}>
      {children}
    </motion.div>
  )
}

/** Dramatic reveal: scale + blur resolve into focus, with a soft gold flash. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.92, filter: 'blur(10px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.7, delay, ease: EASE_CINEMATIC }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Pointer-tracking 3D tilt with a moving specular highlight. Wrap a
 * free-standing card (NOT a roster row — rows must never transform on hover,
 * see globals.css). Inert under reduced motion.
 */
export function TiltCard({ children, max = 6, className }: { children: ReactNode; max?: number; className?: string }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 220, damping: 22 })
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 220, damping: 22 })
  const glareX = useTransform(px, [0, 1], ['20%', '80%'])
  const glareY = useTransform(py, [0, 1], ['15%', '75%'])

  if (reduce) return <div className={className}>{children}</div>

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect()
        if (!r || r.width === 0 || r.height === 0) return
        px.set((e.clientX - r.left) / r.width)
        py.set((e.clientY - r.top) / r.height)
      }}
      onPointerLeave={() => {
        px.set(0.5)
        py.set(0.5)
      }}
    >
      {children}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background: useTransform(
            [glareX, glareY],
            ([x, y]) => `radial-gradient(280px circle at ${x} ${y}, rgba(255,255,255,0.08), transparent 65%)`,
          ),
        }}
      />
    </motion.div>
  )
}

export function FoilText({
  children, as = 'span', className,
}: { children: ReactNode; as?: 'h1' | 'h2' | 'span'; className?: string }) {
  const reduce = useReducedMotion()
  const Tag = motion[as]
  return (
    <Tag
      className={className}
      style={{
        backgroundImage: 'linear-gradient(100deg, #8a6420 0%, #caa24a 30%, #f6e6a8 50%, #caa24a 70%, #8a6420 100%)',
        backgroundSize: '220% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        filter: 'drop-shadow(0 3px 18px rgba(202,162,74,0.35))',
      }}
      initial={reduce ? false : { backgroundPosition: '-180% 0' }}
      animate={{ backgroundPosition: reduce ? '50% 0' : '280% 0' }}
      transition={reduce ? { duration: 0 } : { duration: 1.4, ease: EASE_CINEMATIC }}
    >
      {children}
    </Tag>
  )
}

export function DrawDivider({ className, widthClass = 'w-56' }: { className?: string; widthClass?: string }) {
  const reduce = useReducedMotion()
  return (
    <div aria-hidden className={`relative mx-auto h-px ${widthClass} ${className ?? ''}`}>
      <motion.div
        className="absolute inset-0 origin-center"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(202,162,74,0.9), transparent)' }}
        initial={reduce ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={reduce ? { duration: 0 } : { duration: 0.7, ease: EASE_CINEMATIC, delay: 0.15 }}
      />
      {!reduce && (
        <motion.span
          className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
          style={{ background: '#f6e6a8', boxShadow: '0 0 10px #f6e6a8' }}
          initial={{ left: '8%', opacity: 0 }}
          animate={{ left: ['8%', '92%'], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 0.9, ease: EASE_CINEMATIC, delay: 0.2 }}
        />
      )}
    </div>
  )
}
