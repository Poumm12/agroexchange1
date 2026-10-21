'use client'
import type { ReactNode } from 'react'
import { Card } from '@/components/ui'
import { Icons } from '@/components/ui/Icons'

// ── Skeleton (matches Market Prices loading style) ──
export function TransportSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-pulse" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-44 bg-gray-100 rounded-2xl" />
      ))}
    </div>
  )
}

// ── Professional empty state with optional CTA ──
export function EmptyState({
  icon, title, message, ctaLabel, onCta,
}: {
  icon?: ReactNode
  title: string
  message: string
  ctaLabel?: string
  onCta?: () => void
}) {
  return (
    <Card className="p-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3" aria-hidden="true">
        {icon ?? <Icons.truck className="w-6 h-6" />}
      </div>
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto leading-relaxed">{message}</p>
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="mt-4 inline-flex items-center gap-2 bg-agro-800 hover:bg-agro-900 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[.98]"
        >
          {ctaLabel}
        </button>
      )}
    </Card>
  )
}

// ── Dashboard stat card ──
export function StatCard({
  label, value, hint, icon, accent = 'agro',
}: {
  label: string
  value: string | number
  hint?: string
  icon: ReactNode
  accent?: 'agro' | 'blue' | 'amber' | 'green' | 'purple' | 'gray'
}) {
  const accents: Record<string, string> = {
    agro: 'bg-agro-50 text-agro-700',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    gray: 'bg-gray-100 text-gray-500',
  }
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${accents[accent]}`} aria-hidden="true">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide truncate">{label}</div>
        <div className="font-display font-black text-gray-900 text-xl leading-tight">{value}</div>
        {hint && <div className="text-[11px] text-gray-400">{hint}</div>}
      </div>
    </Card>
  )
}

// ── Read-only star display ──
export function Stars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'xs' }) {
  const cls = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Βαθμολογία ${value.toFixed(1)} στα 5`}>
      {[1, 2, 3, 4, 5].map(i => (
        i <= Math.round(value)
          ? <Icons.star key={i} className={`${cls} text-amber-400`} />
          : <Icons.starEmpty key={i} className={`${cls} text-gray-300`} />
      ))}
    </span>
  )
}
