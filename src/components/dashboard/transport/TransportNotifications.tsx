'use client'
import { useTransportNotifications } from '@/hooks/useTransport'
import { Icons } from '@/components/ui/Icons'

const TYPE_ICON: Record<string, keyof typeof Icons> = {
  accepted: 'check', scheduled: 'calendar', started: 'truck', completed: 'check', review_prompt: 'star',
}

export function TransportNotifications({ userId }: { userId?: string }) {
  const { items, loading, markRead, markAllRead, unread } = useTransportNotifications(userId)

  return (
    <div className="relative">
      <details className="group">
        <summary className="list-none cursor-pointer w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 transition-colors relative" aria-label="Ειδοποιήσεις μεταφορών">
          <Icons.bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{unread}</span>
          )}
        </summary>
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-gray-100 z-50 dropdown-enter">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <span className="font-bold text-gray-900 text-sm">Ειδοποιήσεις</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-[11px] font-semibold text-agro-700 hover:underline">Όλες ως αναγνωσμένες</button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-2 animate-pulse" aria-hidden="true">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
              </div>
            ) : items.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8 px-4">Δεν υπάρχουν ειδοποιήσεις.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {items.map(n => {
                  const iconKey = TYPE_ICON[n.type] ?? 'bell'
                  const Icon = Icons[iconKey]
                  return (
                    <li key={n.id}>
                      <button onClick={() => !n.read && markRead(n.id)}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors ${n.read ? '' : 'bg-agro-50/40'}`}>
                        <span className="w-7 h-7 rounded-lg bg-agro-50 text-agro-700 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                          <Icon className="w-3.5 h-3.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs text-gray-700">{n.message}</span>
                          <span className="block text-[10px] text-gray-400 mt-0.5">{new Date(n.created_at).toLocaleString('el-GR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </span>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-agro-500 flex-shrink-0 mt-1" aria-label="Μη αναγνωσμένη" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </details>
    </div>
  )
}
