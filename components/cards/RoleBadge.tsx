import type { Role } from '@/types'
import { ROLE_ACCENT } from '@/lib/roleInfo'
import { RoleIcon } from './RoleIcon'

/**
 * The poster card's role gem — a clean, tinted icon badge, top-left over the
 * portrait. No text: the role WORD pill was removed from the title block
 * (2026-07-08, user request), so this badge is now the ONLY role indicator on
 * the card. `aria-label` carries the role for a11y since the icon is decorative.
 */
export function RoleBadge({ role, size = 18 }: { role: Role; size?: number }) {
  const color = ROLE_ACCENT[role]
  return (
    <div
      data-testid="role-badge"
      aria-label={role}
      className="grid h-[38px] w-[38px] place-items-center rounded-[11px] backdrop-blur-sm"
      style={{
        background: `${color}52`,
        color,
        boxShadow: '0 4px 14px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.25)',
      }}
    >
      <RoleIcon role={role} size={size} />
    </div>
  )
}
