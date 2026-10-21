'use client'
import { useTransportStats } from '@/hooks/useTransport'
import { Icons } from '@/components/ui/Icons'
import { StatCard } from './shared'

function formatEuro(n: number | null): string {
  return n == null ? '—' : `${n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

export function TransportDashboard({ userId }: { userId?: string }) {
  const { stats, loading } = useTransportStats(userId)

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 animate-pulse" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      <StatCard label="Ενεργές μεταφορές" value={stats.active} icon={<Icons.truck className="w-5 h-5" />} accent="agro" />
      <StatCard label="Νέα αιτήματα" value={stats.pendingRequests} icon={<Icons.package className="w-5 h-5" />} accent="amber" />
      <StatCard label="Διαθέσιμοι μεταφορείς" value={stats.availableTransporters} icon={<Icons.user className="w-5 h-5" />} accent="blue" />
      <StatCard label="Ολοκληρωμένες" value={stats.completed} icon={<Icons.check className="w-5 h-5" />} accent="green" />
      <StatCard label="Μέσο κόστος" value={formatEuro(stats.avgCost)} icon={<Icons.euro className="w-5 h-5" />} accent="purple" />
      <StatCard label="Μέσος χρόνος παράδοσης" value={stats.avgDeliveryDays == null ? '—' : `${stats.avgDeliveryDays} ημ.`} icon={<Icons.calendar className="w-5 h-5" />} accent="gray" />
    </div>
  )
}
