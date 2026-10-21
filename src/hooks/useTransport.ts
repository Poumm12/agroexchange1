'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getSupabaseClient } from '@/lib/supabase-client'
import type { TransportListing, RouteRequest, Transporter, TransportStatusEvent, TransportReview, TransportNotification, TransportStatus } from '@/types'

const PROFILE_SELECT = 'user:profiles(id,full_name,avatar_url,trust_score,rating,rating_count,verified,verified_transporter)'

/** Transport listings (services offered by transporters). */
export function useTransportListings(filters?: { from?: string; to?: string }) {
  const supabase = useRef(getSupabaseClient()).current
  const [listings, setListings] = useState<TransportListing[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('transport_listings')
      .select(`*, ${PROFILE_SELECT}`)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (filters?.from) q = q.ilike('from_location', `%${filters.from}%`)
    if (filters?.to)   q = q.ilike('to_location', `%${filters.to}%`)
    const { data } = await q
    setListings((data ?? []) as TransportListing[])
    setLoading(false)
  }, [supabase, filters?.from, filters?.to])

  useEffect(() => { load() }, [load])

  async function createListing(payload: Partial<TransportListing>) {
    const { data, error } = await supabase
      .from('transport_listings')
      .insert(payload)
      .select(`*, ${PROFILE_SELECT}`)
      .single()
    if (!error && data) setListings(prev => [data as TransportListing, ...prev])
    return { data, error }
  }

  return { listings, loading, reload: load, createListing }
}

/** Route requests (transport demand). */
export function useRouteRequests(filters?: { from?: string; to?: string }) {
  const supabase = useRef(getSupabaseClient()).current
  const [requests, setRequests] = useState<RouteRequest[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('route_requests')
      .select('*, user:profiles(id,full_name,avatar_url)')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
    if (filters?.from) q = q.ilike('from_location', `%${filters.from}%`)
    if (filters?.to)   q = q.ilike('to_location', `%${filters.to}%`)
    const { data } = await q
    setRequests((data ?? []) as RouteRequest[])
    setLoading(false)
  }, [supabase, filters?.from, filters?.to])

  useEffect(() => { load() }, [load])

  async function createRequest(payload: Partial<RouteRequest>) {
    const { data, error } = await supabase
      .from('route_requests')
      .insert(payload)
      .select('*, user:profiles(id,full_name,avatar_url)')
      .single()
    if (!error && data) setRequests(prev => [data as RouteRequest, ...prev])
    return { data, error }
  }

  return { requests, loading, reload: load, createRequest }
}

// ─────────────────────────────────────────────────────────────
// Transporters directory + profile
// ─────────────────────────────────────────────────────────────
export function useTransporters() {
  const supabase = useRef(getSupabaseClient()).current
  const [transporters, setTransporters] = useState<Transporter[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('transporters')
      .select(`*, ${PROFILE_SELECT}`)
      .order('rating', { ascending: false })
    setTransporters((data ?? []) as Transporter[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])
  return { transporters, loading, reload: load }
}

/** Reviews for a single transporter (4-criteria transport reviews). */
export function useTransporterReviews(transporterId?: string) {
  const supabase = useRef(getSupabaseClient()).current
  const [reviews, setReviews] = useState<TransportReview[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!transporterId) { setReviews([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('transport_reviews')
      .select('*')
      .eq('transporter_id', transporterId)
      .order('created_at', { ascending: false })
    setReviews((data ?? []) as TransportReview[])
    setLoading(false)
  }, [supabase, transporterId])

  useEffect(() => { load() }, [load])
  return { reviews, loading, reload: load }
}

// ─────────────────────────────────────────────────────────────
// "My requests" — full CRUD for the logged-in user
// ─────────────────────────────────────────────────────────────
export function useMyRequests(userId?: string) {
  const supabase = useRef(getSupabaseClient()).current
  const [requests, setRequests] = useState<RouteRequest[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) { setRequests([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('route_requests')
      .select('*, transporter:transporters(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setRequests((data ?? []) as RouteRequest[])
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => { load() }, [load])

  async function createRequest(payload: Partial<RouteRequest>) {
    const { data, error } = await supabase
      .from('route_requests').insert(payload).select('*').single()
    if (!error && data) {
      setRequests(prev => [data as RouteRequest, ...prev])
      await supabase.from('transport_status_events').insert({ request_id: (data as RouteRequest).id, status: 'pending', note: 'Αίτημα δημιουργήθηκε' })
    }
    return { data, error }
  }

  async function updateRequest(id: string, updates: Partial<RouteRequest>) {
    const { error } = await supabase
      .from('route_requests').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
    if (!error) setRequests(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))
    return error
  }

  async function cancelRequest(id: string) {
    const error = await updateRequest(id, { status: 'cancelled' })
    if (!error) await supabase.from('transport_status_events').insert({ request_id: id, status: 'cancelled', note: 'Το αίτημα ακυρώθηκε' })
    return error
  }

  async function deleteRequest(id: string) {
    const { error } = await supabase.from('route_requests').delete().eq('id', id)
    if (!error) setRequests(prev => prev.filter(r => r.id !== id))
    return error
  }

  return { requests, loading, reload: load, createRequest, updateRequest, cancelRequest, deleteRequest }
}

// ─────────────────────────────────────────────────────────────
// Status timeline (tracking)
// ─────────────────────────────────────────────────────────────
export function useTransportEvents(requestId?: string) {
  const supabase = useRef(getSupabaseClient()).current
  const [events, setEvents] = useState<TransportStatusEvent[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!requestId) { setEvents([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('transport_status_events')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })
    setEvents((data ?? []) as TransportStatusEvent[])
    setLoading(false)
  }, [supabase, requestId])

  useEffect(() => { load() }, [load])
  return { events, loading, reload: load }
}

/** Active (in-progress) requests for the logged-in user — for the Tracking view. */
export function useActiveRequests(userId?: string) {
  const supabase = useRef(getSupabaseClient()).current
  const [requests, setRequests] = useState<RouteRequest[]>([])
  const [loading, setLoading] = useState(true)
  const ACTIVE: TransportStatus[] = ['pending', 'accepted', 'scheduled', 'picked_up', 'in_transit']

  const load = useCallback(async () => {
    if (!userId) { setRequests([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('route_requests')
      .select('*, transporter:transporters(*)')
      .eq('user_id', userId)
      .in('status', ACTIVE)
      .order('updated_at', { ascending: false })
    setRequests((data ?? []) as RouteRequest[])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, userId])

  useEffect(() => { load() }, [load])
  return { requests, loading, reload: load }
}

// ─────────────────────────────────────────────────────────────
// Submit a 4-criteria transport review
// ─────────────────────────────────────────────────────────────
export async function submitTransportReview(payload: {
  request_id: string; transporter_id: string; reviewer_id: string
  reliability: number; speed: number; communication: number; cargo_condition: number; comment?: string
}) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('transport_reviews')
    .upsert(payload, { onConflict: 'request_id,reviewer_id' })
    .select('*').single()
  return { data, error }
}

// ─────────────────────────────────────────────────────────────
// Transport notifications
// ─────────────────────────────────────────────────────────────
export function useTransportNotifications(userId?: string) {
  const supabase = useRef(getSupabaseClient()).current
  const [items, setItems] = useState<TransportNotification[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) { setItems([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('transport_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    setItems((data ?? []) as TransportNotification[])
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => { load() }, [load])

  async function markRead(id: string) {
    const { error } = await supabase.from('transport_notifications').update({ read: true }).eq('id', id)
    if (!error) setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }
  async function markAllRead() {
    if (!userId) return
    const { error } = await supabase.from('transport_notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
    if (!error) setItems(prev => prev.map(n => ({ ...n, read: true })))
  }

  return { items, loading, reload: load, markRead, markAllRead, unread: items.filter(n => !n.read).length }
}

// ─────────────────────────────────────────────────────────────
// Dashboard stats (all real, from the DB)
// ─────────────────────────────────────────────────────────────
export interface TransportStats {
  active: number
  pendingRequests: number
  availableTransporters: number
  completed: number
  avgCost: number | null
  avgDeliveryDays: number | null
}

export function useTransportStats(userId?: string) {
  const supabase = useRef(getSupabaseClient()).current
  const [stats, setStats] = useState<TransportStats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const ACTIVE = ['pending', 'accepted', 'scheduled', 'picked_up', 'in_transit']
    const [reqRes, transRes] = await Promise.all([
      supabase.from('route_requests').select('status, agreed_cost, created_at, completed_at, user_id'),
      supabase.from('transporters').select('available'),
    ])
    const reqs = (reqRes.data ?? []) as RouteRequest[]
    const trans = (transRes.data ?? []) as { available: boolean }[]
    const mine = userId ? reqs.filter(r => r.user_id === userId) : reqs

    const active = mine.filter(r => ACTIVE.includes(r.status as string)).length
    const pendingRequests = mine.filter(r => r.status === 'pending').length
    const completedReqs = mine.filter(r => r.status === 'delivered')
    const completed = completedReqs.length
    const availableTransporters = trans.filter(t => t.available).length

    const costs = completedReqs.map(r => r.agreed_cost).filter((c): c is number => typeof c === 'number' && c > 0)
    const avgCost = costs.length ? +(costs.reduce((a, b) => a + b, 0) / costs.length).toFixed(2) : null

    const durations = completedReqs
      .filter(r => r.completed_at && r.created_at)
      .map(r => (new Date(r.completed_at as string).getTime() - new Date(r.created_at).getTime()) / 86400000)
      .filter(d => d >= 0)
    const avgDeliveryDays = durations.length ? +(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1) : null

    setStats({ active, pendingRequests, availableTransporters, completed, avgCost, avgDeliveryDays })
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => { load() }, [load])
  return { stats, loading, reload: load }
}

// Status lifecycle helpers (shared by tracking/timeline UIs).
export const TRANSPORT_FLOW: { status: TransportStatus; label: string; progress: number }[] = [
  { status: 'pending',    label: 'Αίτημα δημιουργήθηκε',  progress: 0 },
  { status: 'accepted',   label: 'Μεταφορέας αποδέχθηκε',  progress: 20 },
  { status: 'scheduled',  label: 'Προγραμματισμένη παραλαβή', progress: 40 },
  { status: 'picked_up',  label: 'Παραλήφθηκε',            progress: 60 },
  { status: 'in_transit', label: "Καθ' οδόν",              progress: 80 },
  { status: 'delivered',  label: 'Παραδόθηκε',             progress: 100 },
]

export function progressForStatus(status: string): number {
  return TRANSPORT_FLOW.find(s => s.status === status)?.progress ?? 0
}
