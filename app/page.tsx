'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useRef, useState } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { Wifi, WifiOff, AlertTriangle, ShieldAlert, MessageSquare, Bell } from 'lucide-react'
import Link from 'next/link'

type LiveMessage = {
  id: string
  model: string
  modelUsername: string | null
  chatter: string
  chatterId: string
  chatterUsername: string | null
  fan: string
  content: string
  sentAt: string
  hasMedia: boolean
  replyTimeSeconds: number | null
}

type Chatter = { id: string; name: string }

function formatReply(s: number | null): string | null {
  if (s === null) return null
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

type Stats = {
  criticalToday: number
  warningToday: number
  unreviewedTotal: number
  messagesToday: number
}

const POLL_INTERVAL = 10_000

export default function DashboardPage() {
  const [messages, setMessages] = useState<LiveMessage[]>([])
  const [chatters, setChatters] = useState<Chatter[]>([])
  const [chatterId, setChatterId] = useState('all')
  const [status, setStatus] = useState<'connecting' | 'live' | 'error'>('connecting')
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  const [newCount, setNewCount] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const sinceRef = useRef<string>(new Date().toISOString())
  const newCountRef = useRef(0)

  async function fetchStats() {
    try {
      const res = await fetch('/api/stats')
      if (res.ok) setStats(await res.json())
    } catch { /* silent */ }
  }

  async function poll() {
    try {
      const res = await fetch(`/api/messages/live?since=${sinceRef.current}`)
      if (!res.ok) throw new Error('API error')
      const data = await res.json()

      if (data.messages?.length > 0) {
        setMessages(prev => [...data.messages.reverse(), ...prev].slice(0, 300))
        newCountRef.current += data.messages.length
        setNewCount(newCountRef.current)
        fetchStats()
      }

      sinceRef.current = data.checkedAt
      setLastChecked(data.checkedAt)
      setStatus('live')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    // Load last 200 messages from DB first, then start live polling
    async function init() {
      fetchStats()
      try {
        const res = await fetch('/api/messages/recent')
        if (res.ok) {
          const existing: LiveMessage[] = await res.json()
          setMessages(existing)
          // Set since to the most recent message time so we only poll for newer ones
          if (existing.length > 0) {
            sinceRef.current = existing[0].sentAt
          }
        }
      } catch { /* silent */ }
      poll()
    }
    fetch('/api/chatters').then(r => r.json()).then((data: Chatter[]) => setChatters(data)).catch(() => {})
    init()
    const interval = setInterval(poll, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  const filtered = chatterId === 'all' ? messages : messages.filter(m => m.chatterId === chatterId)

  return (
    <div>
      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <Link href="/alerts" className="card flex items-center gap-3 hover:border-zinc-600 transition-colors">
            <div className="p-2 bg-red-900/30 rounded-lg shrink-0">
              <ShieldAlert size={16} className="text-red-400" />
            </div>
            <div>
              <div className={`text-2xl font-bold ${stats.criticalToday > 0 ? 'text-red-400' : 'text-zinc-100'}`}>
                {stats.criticalToday}
              </div>
              <div className="text-zinc-500 text-xs">KritiÄnih danas</div>
            </div>
          </Link>

          <Link href="/alerts" className="card flex items-center gap-3 hover:border-zinc-600 transition-colors">
            <div className="p-2 bg-amber-900/30 rounded-lg shrink-0">
              <AlertTriangle size={16} className="text-amber-400" />
            </div>
            <div>
              <div className={`text-2xl font-bold ${stats.warningToday > 0 ? 'text-amber-400' : 'text-zinc-100'}`}>
                {stats.warningToday}
              </div>
              <div className="text-zinc-500 text-xs">Upozorenja danas</div>
            </div>
          </Link>

          <Link href="/alerts" className="card flex items-center gap-3 hover:border-zinc-600 transition-colors">
            <div className="p-2 bg-purple-900/30 rounded-lg shrink-0">
              <Bell size={16} className="text-purple-400" />
            </div>
            <div>
              <div className={`text-2xl font-bold ${stats.unreviewedTotal > 0 ? 'text-purple-400' : 'text-zinc-100'}`}>
                {stats.unreviewedTotal}
              </div>
              <div className="text-zinc-500 text-xs">Nepregl. alerta</div>
            </div>
          </Link>

          <div className="card flex items-center gap-3">
            <div className="p-2 bg-blue-900/30 rounded-lg shrink-0">
              <MessageSquare size={16} className="text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-zinc-100">{stats.messagesToday}</div>
              <div className="text-zinc-500 text-xs">Poruka danas</div>
            </div>
          </div>
        </div>
      )}

      {/* Live monitor header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-zinc-100">Live Monitor</h2>
          {newCount > 0 && (
            <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">
              +{newCount} novih
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {chatters.length > 0 && (
            <select
              value={chatterId}
              onChange={e => setChatterId(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded-lg px-3 py-1.5 outline-none hover:border-zinc-600 transition-colors"
            >
              <option value="all">Svi chatteri</option>
              {chatters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {lastChecked && (
            <span className="text-zinc-600 text-xs">
              {format(new Date(lastChecked), 'HH:mm:ss')}
            </span>
          )}
          <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
            status === 'live' ? 'bg-emerald-900/30 text-emerald-400' :
            status === 'error' ? 'bg-red-900/30 text-red-400' :
            'bg-zinc-800 text-zinc-500'
          }`}>
            {status === 'live'
              ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />LIVE</>
              : status === 'error'
              ? <><WifiOff size={11} />GreÅ¡ka</>
              : <><span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" />ÄŒekam...</>
            }
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[170px_140px_1fr_120px_110px] border-b border-zinc-800 px-4 py-2.5 bg-zinc-900/80">
          <div className="text-zinc-500 text-xs font-medium uppercase tracking-wide">Model</div>
          <div className="text-zinc-500 text-xs font-medium uppercase tracking-wide">Chatter</div>
          <div className="text-zinc-500 text-xs font-medium uppercase tracking-wide">Poruka</div>
          <div className="text-zinc-500 text-xs font-medium uppercase tracking-wide">Fan</div>
          <div className="text-zinc-500 text-xs font-medium uppercase tracking-wide text-right">Vreme</div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mb-4 block" />
            <p className="text-zinc-400 text-sm font-medium">{chatterId === 'all' ? 'ÄŒekam poruke...' : 'Nema poruka za ovog chattera'}</p>
            <p className="text-zinc-600 text-xs mt-1">UÄitavam iz baze i proveravam za nove svakih 10s.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {filtered.map((msg, i) => (
              <MessageRow key={msg.id} msg={msg} isNew={i < 3 && newCount > 0} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MessageRow({ msg, isNew }: { msg: LiveMessage; isNew: boolean }) {
  const [fresh, setFresh] = useState(isNew)
  useEffect(() => {
    if (!fresh) return
    const t = setTimeout(() => setFresh(false), 3000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className={`grid grid-cols-[170px_140px_1fr_120px_110px] px-4 py-3 items-center transition-colors duration-1000 ${
      fresh ? 'bg-emerald-950/40' : 'hover:bg-zinc-800/30'
    }`}>
      <div className="min-w-0 pr-2">
        <div className="text-zinc-100 text-sm font-medium truncate">{msg.model}</div>
        {msg.modelUsername && <div className="text-zinc-600 text-xs truncate">@{msg.modelUsername}</div>}
      </div>

      <div className="min-w-0 pr-2">
        <div className="text-zinc-300 text-sm truncate">{msg.chatter}</div>
        {msg.chatterUsername && <div className="text-zinc-600 text-xs truncate">@{msg.chatterUsername}</div>}
      </div>

      <div className="min-w-0 px-2">
        {msg.hasMedia && !msg.content
          ? <span className="text-zinc-500 text-sm italic">ðŸ“Ž Media</span>
          : <span className="text-zinc-300 text-sm leading-relaxed line-clamp-2">{msg.content}</span>
        }
      </div>

      <div className="min-w-0 pr-2">
        <div className="text-zinc-400 text-sm truncate">{msg.fan}</div>
      </div>

      <div className="text-right shrink-0">
        <div className="text-zinc-300 text-xs font-mono">{format(new Date(msg.sentAt), 'HH:mm:ss')}</div>
        <div className="text-zinc-600 text-xs">{formatDistanceToNow(new Date(msg.sentAt), { addSuffix: true })}</div>
        {formatReply(msg.replyTimeSeconds) && (
          <div className="text-blue-400 text-xs mt-0.5">â± {formatReply(msg.replyTimeSeconds)}</div>
        )}
      </div>
    </div>
  )
}
