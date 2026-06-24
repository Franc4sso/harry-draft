import { describe, it, expect } from 'vitest'
import type { Role } from '@/types'
import { ROLE_INFO, roleTooltip } from '@/lib/roleInfo'

const ROLES: Role[] = ['Attaccante', 'Tank', 'Supporto', 'Controllo']

describe('roleInfo', () => {
  it('has a non-empty blurb for every role', () => {
    for (const r of ROLES) {
      expect(ROLE_INFO[r]).toBeTruthy()
      expect(ROLE_INFO[r].length).toBeGreaterThan(10)
    }
  })

  it('roleTooltip leads with the role name then its blurb', () => {
    for (const r of ROLES) {
      const t = roleTooltip(r)
      expect(t.startsWith(r)).toBe(true)
      expect(t).toContain(ROLE_INFO[r])
    }
  })

  it('describes the key behaviour of each role (not just stats)', () => {
    // Tank = taunt, Attaccante = armor penetration, Controllo = bypass, Supporto = heal.
    expect(roleTooltip('Tank')).toMatch(/per primo/i)
    expect(roleTooltip('Attaccante')).toMatch(/difesa/i)
    expect(roleTooltip('Controllo')).toMatch(/retrovie|scavalca/i)
    expect(roleTooltip('Supporto')).toMatch(/cura/i)
  })
})
