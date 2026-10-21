'use client'
import { useState, useMemo } from 'react'
import type { Transporter } from '@/types'
import { useTransporters } from '@/hooks/useTransport'
import { Card, Badge, Button } from '@/components/ui'
import { Icons } from '@/components/ui/Icons'
import { TransportSkeleton, EmptyState, Stars } from './shared'
import { TransporterProfile } from './TransporterProfile'

export function TransportersList({ search }: { search: string }) {
  const { transporters, loading } = useTransporters()
  const [profileId, setProfileId] = useState<string | null>(null)

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return transporters
    return transporters.filter(t =>
      (t.company_name ?? '').toLowerCase().includes(q) ||
      (t.user?.full_name ?? '').toLowerCase().includes(q) ||
      (t.service_areas ?? []).some(a => a.toLowerCase().includes(q)) ||
      t.from_location.toLowerCase().includes(q) ||
      t.to_location.toLowerCase().includes(q)
    )
  }, [transporters, search])

  if (loading) return <TransportSkeleton />

  if (!visible.length) {
    return (
      <EmptyState
        icon={<Icons.truck className="w-6 h-6" />}
        title="Δεν υπάρχουν διαθέσιμοι μεταφορείς"
        message="Μόλις εγγραφούν μεταφορικές εταιρείες, θα εμφανιστούν εδώ με τα στοιχεία, τον στόλο και τις αξιολογήσεις τους."
      />
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map(t => (
          <TransporterCard key={t.id} t={t} onOpen={() => setProfileId(t.id)} />
        ))}
      </div>
      {profileId && (
        <TransporterProfile
          transporter={visible.find(t => t.id === profileId)!}
          onClose={() => setProfileId(null)}
        />
      )}
    </>
  )
}

function TransporterCard({ t, onOpen }: { t: Transporter; onOpen: () => void }) {
  const name = t.company_name || t.user?.full_name || 'Μεταφορέας'
  const initial = name.charAt(0).toUpperCase()
  return (
    <Card className="p-4 flex flex-col transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-3">
        {/* Logo / avatar */}
        {t.logo_url ? (
          <img src={t.logo_url} alt="" className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-11 h-11 rounded-xl bg-agro-50 text-agro-700 font-display font-black flex items-center justify-center flex-shrink-0" aria-hidden="true">
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-gray-900 text-sm truncate">{name}</span>
            {t.verified && <Icons.check className="w-3.5 h-3.5 text-agro-600 flex-shrink-0" aria-label="Πιστοποιημένος" />}
          </div>
          {t.company_name && t.user?.full_name && (
            <div className="text-[11px] text-gray-400 truncate">{t.user.full_name}</div>
          )}
          <div className="flex items-center gap-1.5 mt-0.5">
            <Stars value={t.rating} size="xs" />
            <span className="text-[11px] text-gray-400">{t.rating.toFixed(1)} · {t.total_trips} μεταφορές</span>
          </div>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {t.available
          ? <Badge variant="success">Διαθέσιμος</Badge>
          : <Badge variant="default">Μη διαθέσιμος</Badge>}
        {t.insured && <Badge variant="info">Ασφαλισμένη μεταφορά</Badge>}
        {t.adr_certified && <Badge variant="warning">ADR</Badge>}
      </div>

      {/* Meta */}
      <dl className="mt-3 space-y-1 text-[11px] text-gray-500 flex-1">
        {!!(t.service_areas?.length) && (
          <div className="flex gap-1"><dt className="text-gray-400">Περιοχές:</dt><dd className="truncate">{t.service_areas.join(', ')}</dd></div>
        )}
        {!!(t.cargo_types?.length) && (
          <div className="flex gap-1"><dt className="text-gray-400">Φορτία:</dt><dd className="truncate">{t.cargo_types.join(', ')}</dd></div>
        )}
        {!!(t.vehicles?.length) && (
          <div className="flex gap-1"><dt className="text-gray-400">Οχήματα:</dt><dd className="truncate">{t.vehicles.join(', ')}</dd></div>
        )}
        <div className="flex gap-3">
          <span><span className="text-gray-400">Χωρητικότητα:</span> {t.capacity_tons} τ.</span>
          {!!t.years_experience && <span><span className="text-gray-400">Εμπειρία:</span> {t.years_experience} έτη</span>}
        </div>
      </dl>

      <div className="mt-3">
        <Button variant="secondary" onClick={onOpen} icon={<Icons.eye className="w-4 h-4" />}>Προβολή προφίλ</Button>
      </div>
    </Card>
  )
}
