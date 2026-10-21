'use client'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Icons } from '@/components/ui/Icons'
import { TransportDashboard } from '@/components/dashboard/transport/TransportDashboard'
import { TransportSearch } from '@/components/dashboard/transport/TransportSearch'
import { MyRequests } from '@/components/dashboard/transport/MyRequests'
import { TransportersList } from '@/components/dashboard/transport/TransportersList'
import { TransportTracking } from '@/components/dashboard/transport/TransportTracking'
import { TransportHistory } from '@/components/dashboard/transport/TransportHistory'
import { TransportReviews } from '@/components/dashboard/transport/TransportReviews'
import { TransportNotifications } from '@/components/dashboard/transport/TransportNotifications'

type Section = 'dashboard' | 'search' | 'requests' | 'transporters' | 'tracking' | 'history' | 'reviews'

const NAV: { id: Section; label: string; icon: keyof typeof Icons }[] = [
  { id: 'dashboard',    label: 'Dashboard',       icon: 'home' },
  { id: 'search',       label: 'Αναζήτηση',       icon: 'search' },
  { id: 'requests',     label: 'Τα Αιτήματά μου', icon: 'package' },
  { id: 'transporters', label: 'Μεταφορείς',      icon: 'truck' },
  { id: 'tracking',     label: 'Παρακολούθηση',   icon: 'pin' },
  { id: 'history',      label: 'Ιστορικό',        icon: 'list' },
  { id: 'reviews',      label: 'Αξιολογήσεις',    icon: 'star' },
]

export function TransportTab() {
  const { user } = useAuth()
  const userId = user?.id
  const [section, setSection] = useState<Section>('dashboard')
  const [transporterSearch, setTransporterSearch] = useState('')

  function renderSection() {
    switch (section) {
      case 'search':       return <TransportSearch onRequest={() => setSection('requests')} />
      case 'requests':     return <MyRequests userId={userId} />
      case 'transporters': return <TransportersList search={transporterSearch} />
      case 'tracking':     return <TransportTracking userId={userId} />
      case 'history':      return <TransportHistory userId={userId} />
      case 'reviews':      return <TransportReviews userId={userId} />
      default:             return <TransportDashboard userId={userId} />
    }
  }

  const activeLabel = NAV.find(n => n.id === section)?.label ?? 'Dashboard'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display font-extrabold text-gray-900 text-xl tracking-tight flex items-center gap-2">
          <Icons.truck className="w-6 h-6 text-agro-700" /> Μεταφορές
        </h2>
        <TransportNotifications userId={userId} />
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Desktop sidebar */}
        <nav className="hidden lg:block w-56 flex-shrink-0" aria-label="Πλοήγηση Μεταφορών">
          <ul className="space-y-1 sticky top-4">
            {NAV.map(item => {
              const Icon = Icons[item.icon]
              const active = section === item.id
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setSection(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      active ? 'bg-agro-800 text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {item.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Mobile: horizontal scrollable nav (accordion-free, keeps all functionality) */}
        <nav className="lg:hidden -mx-1 px-1 overflow-x-auto table-scroll" aria-label="Πλοήγηση Μεταφορών">
          <ul className="flex gap-2 min-w-max pb-1">
            {NAV.map(item => {
              const Icon = Icons[item.icon]
              const active = section === item.id
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setSection(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                      active ? 'bg-agro-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    {item.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Transporters search bar (only on transporters section) */}
          {section === 'transporters' && (
            <div className="relative mb-4">
              <Icons.search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <input
                type="search"
                value={transporterSearch}
                onChange={e => setTransporterSearch(e.target.value)}
                placeholder="Αναζήτηση μεταφορέα, εταιρείας ή περιοχής…"
                aria-label="Αναζήτηση μεταφορέα"
                className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm outline-none transition-all focus:border-agro-500 focus:ring-2 focus:ring-agro-100"
              />
            </div>
          )}
          <h3 className="sr-only">{activeLabel}</h3>
          {renderSection()}
        </div>
      </div>
    </div>
  )
}
