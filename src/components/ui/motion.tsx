import { motion, type HTMLMotionProps, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * Reusable motion primitives for the app. Centralized so we have one set of
 * timings/easings instead of ad-hoc values scattered across pages.
 *
 * All animations respect `prefers-reduced-motion` automatically — Framer Motion
 * disables transforms when the OS setting is on (combined with our global
 * `@media (prefers-reduced-motion: reduce)` rule in index.css).
 */

const EASE_OUT_SOFT = [0.22, 1, 0.36, 1] as const

/**
 * Page-transition wrapper. Renders children with a fade + 6px slide on mount.
 * Use as the root of each route's content, or wrap <Outlet /> once in Layout.
 */
export function PageTransition({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22, ease: EASE_OUT_SOFT }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * Container that staggers its motion-child children on mount.
 *
 *   <Stagger>
 *     {items.map(i => <StaggerItem key={i.id}>...</StaggerItem>)}
 *   </Stagger>
 *
 * Each item appears 30ms after the previous, with a fade + 8px slide.
 */
const containerVariants: Variants = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.03, delayChildren: 0.04 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT_SOFT } },
}

export function Stagger({
  children,
  className,
  ...props
}: HTMLMotionProps<'div'> & { children: ReactNode }) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
  ...props
}: HTMLMotionProps<'div'> & { children: ReactNode }) {
  return (
    <motion.div variants={itemVariants} className={className} {...props}>
      {children}
    </motion.div>
  )
}
