'use client'
import { useState, useEffect, useRef } from 'react'
import { Navbar }            from '@/components/layout/Navbar'
import { Hero }              from '@/components/landing/Hero'
import { TickerBar }         from '@/components/landing/TickerBar'
import { FeaturedListings }  from '@/components/landing/FeaturedListings'
import { Features }          from '@/components/landing/Features'
import { HowItWorks }        from '@/components/landing/HowItWorks'
import { TransportSection }  from '@/components/landing/TransportSection'
import { Stats }             from '@/components/landing/Stats'
import { Footer }            from '@/components/landing/Footer'
import { DashboardNav }      from '@/components/dashboard/DashboardNav'
import { HomeTab }           from '@/components/dashboard/tabs/HomeTab'
import { ListingsTab }       from '@/components/dashboard/tabs/ListingsTab'
import { MarketTab }         from '@/components/dashboard/tabs/MarketTab'
import { WeatherTab }        from '@/components/dashboard/tabs/WeatherTab'
import { TransportTab }      from '@/components/dashboard/tabs/TransportTab'
import { OffersTab }         from '@/components/dashboard/tabs/OffersTab'
import { NotificationsTab }  from '@/components/dashboard/tabs/NotificationsTab'
import { NewsTab }           from '@/components/dashboard/tabs/NewsTab'
import { RankingTab }        from '@/components/dashboard/tabs/RankingTab'
import { ProfileTab }        from '@/components/dashboard/tabs/ProfileTab'
import { InsuranceTab }      from '@/components/dashboard/tabs/InsuranceTab'
import { MessagesTab }       from '@/components/dashboard/tabs/MessagesTab'
import { MapTab }            from '@/components/dashboard/tabs/MapTab'
import { useListings }       from '@/hooks/useListings'
import { useAuth }           from '@/hooks/useAuth'
import type { MarketPrice }  from '@/types'

type View = 'landing' | 'dashboard'

export default function Page() {
  const [view, setView]     = useState<View>('landing')
  const [tab, setTab]       = useState('home')
  const [prices, setPrices] = useState<MarketPrice[]>([])
  const [priceHistory, setPriceHistory] = useState<Record<string, any[]>>({})
  const [marketLoading, setMarketLoading] = useState(true)
  const [initialConvId, setInitialConvId] = useState<string | undefined>(undefined)

  const { listings, loading: listingsLoading } = useListings({ status: 'active' })
  const { user, loading: authLoading }         = useAuth()

  // Deep-link: /?view=messages&c=<conversationId> (from profile "Αποστολή Μηνύματος")
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('view') === 'messages') {
      const c = params.get('c') ?? undefined
      setInitialConvId(c)
      setView('dashboard')
      setTab('messages')
      // Clean the URL without reloading
      window.history.replaceState({}, '', '/')
    }
  }, [])

  // On refresh (F5/reload) the app always opens on the Landing Page, even when
  // the user has a persisted session. They enter the dashboard via the
  // "Στο Dashboard" CTA. (The messages deep-link above is the only exception.)
  // No auto-redirect to dashboard on mount.

  // Logout → back to landing
  const prevUser = useRef<typeof user>(null)
  useEffect(() => {
    if (prevUser.current !== null && user === null) setView('landing')
    prevUser.current = user
  }, [user])

  // Market prices — load real data from /api/market (EU source, Supabase-cached)
  useEffect(() => {
    const load = () =>
      fetch('/api/market').then(r => r.json()).then(d => {
        if (d.data) setPrices(d.data)
        if (d.history) setPriceHistory(d.history)
      }).catch(() => {}).finally(() => setMarketLoading(false))
    load()
    // Auto-refresh real prices every 45 minutes (no per-refresh upstream calls).
    const id = setInterval(load, 45 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  function navigateTo(targetTab: string) {
    setView('dashboard')
    setTab(targetTab)
  }

  function handleCta() {
    if (user) navigateTo('home')
    else window.dispatchEvent(new CustomEvent('open-auth'))
  }

  // LANDING
  if (view === 'landing') {
    return (
      <div className="min-h-screen">
		<Navbar view="landing" setView={(v: string) => setView(v as View)} navigateTo={navigateTo} />
        <Hero onCta={handleCta} isLoggedIn={!!user} prices={prices} />
        {prices.length > 0 && <TickerBar prices={prices} />}
        {/* Reordered: Recent Listings → Transport → Why AgroExchange → How It Works → Ecosystem → Footer */}
        <FeaturedListings listings={listings} loading={listingsLoading} onCta={handleCta} />
        <TransportSection onCta={handleCta} />
        <Features />
        <HowItWorks />
        <Stats />
        <Footer navigateTo={navigateTo} onCta={handleCta} isLoggedIn={!!user} />
      </div>
    )
  }

  // DASHBOARD — protected
  if (!authLoading && !user) {
    setView('landing')
    return null
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F6F7F8' }}>
      <Navbar view="landing" setView={(v: string) => setView(v as View)} navigateTo={navigateTo} />
      <div className="pt-16">
        <DashboardNav tab={tab} setTab={setTab} />
      </div>
      <main className="flex-1 max-w-screen-xl w-full mx-auto px-4 sm:px-6 py-6">
        {tab === 'home'      && <HomeTab      setTab={setTab} prices={prices} />}
        {tab === 'listings'  && <ListingsTab  />}
        {tab === 'market'    && <MarketTab    prices={prices} history={priceHistory} loading={marketLoading} />}
        {tab === 'weather'   && <WeatherTab   />}
        {tab === 'transport' && <TransportTab />}
        {tab === 'map'       && <MapTab />}
        {tab === 'insurance' && <InsuranceTab />}
        {tab === 'messages'  && <MessagesTab initialConversationId={initialConvId} />}
        {tab === 'offers'    && <OffersTab    />}
        {tab === 'notifs'    && <NotificationsTab />}
        {tab === 'news'      && <NewsTab      />}
        {tab === 'ranking'   && <RankingTab   />}
        {tab === 'profile'   && <ProfileTab   />}
      </main>
    </div>
  )
}
