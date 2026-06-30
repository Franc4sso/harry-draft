'use client'
import { useState } from 'react'
import { SYNERGIES } from '@/data/synergies'
import { WIZARDS } from '@/data/wizards'
import { synergyBonusText } from '@/lib/glossary'
import type { Synergy } from '@/types/synergy'

export const KIND_COLOR: Record<Synergy['kind'], string> = {
  house: '#7DB7FF', role: '#FFD37D', group: '#C98BFF', origin: '#7CFC9B',
}

function synergyMemberIds(syn: Synergy): string[] {
  const req = syn.requires
  if (req.ids?.length) return req.ids
  return WIZARDS.filter((w) =>
    (req.house ? w.house === req.house : true) &&
    (req.role ? w.role === req.role : true) &&
    (req.tag ? (w.tags ?? []).includes(req.tag) : true),
  ).map((w) => w.id)
}

function requirementText(syn: Synergy): string {
  const req = syn.requires
  if (req.ids?.length) return `Richiede: ${req.ids.length} maghi specifici`
  const n = req.count ?? 3
  if (req.house) return `Richiede: ${n}+ ${req.house}`
  if (req.role) return `Richiede: ${n}+ ${req.role}`
  if (req.tag) return `Richiede: ${n}+ del gruppo`
  return ''
}

const R = 150
const CX = 200
const CY = 200
const nameById = new Map(WIZARDS.map((w) => [w.id, w.name]))

export function SynergyGraph() {
  const [selected, setSelected] = useState<string | null>(null)
  const active = SYNERGIES.find((s) => s.id === selected) ?? null

  return (
    <div className="grid gap-5 md:gap-6 md:grid-cols-[minmax(0,400px)_1fr] items-start">
      <svg
        viewBox="0 0 400 400"
        className="w-full max-w-[420px] mx-auto touch-manipulation"
        role="group"
        aria-label="Grafo delle sinergie"
      >
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.06)" />
        {SYNERGIES.map((s, i) => {
          const angle = (i / SYNERGIES.length) * Math.PI * 2 - Math.PI / 2
          const x = CX + R * Math.cos(angle)
          const y = CY + R * Math.sin(angle)
          const color = KIND_COLOR[s.kind]
          const isActive = s.id === selected
          return (
            <g key={s.id}
              tabIndex={0}
              role="button"
              aria-pressed={isActive}
              aria-label={s.name}
              className="cursor-pointer outline-none focus-visible:opacity-100 motion-safe:transition-opacity"
              onClick={() => setSelected(s.id)}
              onFocus={() => setSelected(s.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(s.id) } }}
              opacity={selected && !isActive ? 0.4 : 1}
            >
              {/* Generous transparent hit area for touch (>=44px target) */}
              <circle cx={x} cy={y} r={22} fill="transparent" />
              <circle cx={x} cy={y} r={isActive ? 12 : 8} fill={color}
                style={{ filter: `drop-shadow(0 0 ${isActive ? 12 : 5}px ${color})` }} />
              <text x={x} y={y - 16} textAnchor="middle" fontSize="12" fontWeight={isActive ? 700 : 400} fill="#e8ecf3">{s.name}</text>
            </g>
          )
        })}
      </svg>

      <div className="glass rounded-2xl p-4 sm:p-5 min-h-[160px] md:min-h-[200px]">
        {active ? (
          <>
            <h3 className="font-display text-xl" style={{ color: KIND_COLOR[active.kind] }}>{active.name}</h3>
            <p className="mt-1 text-sm text-white/60">{requirementText(active)}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {synergyBonusText(active).map((t) => (
                <span key={t} className="px-2.5 py-0.5 rounded-full text-xs border border-white/15 bg-white/5 text-white/85">{t}</span>
              ))}
            </div>
            <p className="mt-4 text-xs uppercase tracking-wider text-white/40">Maghi coinvolti</p>
            <p className="mt-1 text-sm text-white/70">
              {synergyMemberIds(active).map((id) => nameById.get(id)).filter(Boolean).join(' · ')}
            </p>
          </>
        ) : (
          <p className="text-white/55 text-sm">Seleziona una sinergia nel grafo per vederne il bonus e i maghi coinvolti.</p>
        )}
      </div>
    </div>
  )
}
