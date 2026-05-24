export const dynamic = 'force-dynamic'
'use client'
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ShieldAlert, AlertTriangle, MessageCircle, CheckCheck, X, ChevronDown, ChevronRight } from 'lucide-react'

type Flag = {
  id: string
  type: string
  category: string
  severity: string
  description: string
  suggestion?: string
  message: {
    content: string
    sentAt: string
    fanName?: string
    replyTimeSeconds?: number | null
    chatter: { id: string; name: string }
    creator: { name: string }
  }
}

type Chatter = { id: string; name: string }

const TYPE_LABEL: Record<string, string> = {
  POACHING:   'Poaching',
  TOS:        'TOS',
  INSULT:     'Uvreda',
  SPELLING:   'Pravopis',
  GRAMMAR:    'Gramatika',
  DRY:        'Dry text',
  ENGAGEMENT: 'Ignorisanje',
  SALES:      'Sales push',
  SLOW_REPLY: 'Spor odgovor',
  // legacy
  TONE: 'Ton',
  RULE: 'Pravilo',
}

function categoryOf(flag: Flag): 'critical' | 'spelling' | 'quality' {
  if (flag.category === 'critical' || flag.severity === 'CRITICAL') return 'critical'
  if (flag.category === 'spelling' || flag.type === 'SPELLING' || flag.type === 'GRAMMAR') return 'spelling'
  return 'quality'
}

function formatReply(s?: number | null) {
  if (!s) return null
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

function FlagCard({ flag, onAction }: {
  flag: Flag
  onAction: (id: string, action: 'review' | 'dismiss') => void
}) {
  const cat = categoryOf(flag)
  return (
    <div className={`px-4 py-3 border-b border-zinc-800/50 last:border-0 ${
      cat === 'critical' ? 'bg-red-950/10' : ''
    }`}>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {cat === 'critical' ? (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-900/20 text-red-400 border border-red-800/40">
                <ShieldAlert size={10} /> CRITICAL
              </span>
            ) : cat === 'spelling' ? (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-blue-900/20 text-blue-400 border border-blue-800/40">
                <AlertTriangle size={10} /> PRAVOPIS
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-purple-900/20 text-purple-400 border border-purple-800/40">
                <MessageCircle size={10} /> KVALITET
              </span>
            )}
            <span className="text-zinc-500 text-xs font-mono">{TYPE_LABEL[flag.type] ?? flag.type}</span>
            <span className="text-zinc-400 text-xs font-medium">{flag.message.chatter.name}</span>
            <span className="text-zinc-700 text-xs">â†’ {flag.message.creator.name}</span>
            {flag.message.fanName && (
              <span className="text-zinc-700 text-xs">| {flag.message.fanName}</span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {formatReply(flag.message.replyTimeSeconds) && (
                <span className="text-blue-400 text-xs">â± {formatReply(flag.message.replyTimeSeconds)}</span>
              )}
              <span className="text-zinc-600 text-xs">{format(new Date(flag.message.sentAt), 'dd.MM HH:mm')}</span>
            </div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg px-3 py-2 mb-2 border-l-2 border-zinc-600 text-sm text-zinc-200">
            {flag.message.content || <em className="text-zinc-500">Media poruka</em>}
          </div>
          <p className="text-zinc-400 text-xs">{flag.description}</p>
          {flag.suggestion && (
            <p className="text-emerald-400 text-xs mt-0.5">
              <span className="text-zinc-600">Predlog: </span>{flag.suggestion}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={() => onAction(flag.id, 'review')}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-brand-600/20 text-brand-400 border border-brand-700/50 rounded-lg text-xs hover:bg-brand-600/40 transition-colors"
          >
            <CheckCheck size={11} /> Ok
          </button>
          <button
            onClick={() => onAction(flag.id, 'dismiss')}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-800 text-zinc-500 border border-zinc-700 rounded-lg text-xs hover:text-zinc-300 transition-colors"
          >
            <X size={11} /> Skip
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, icon, count, color, flags, onAction, defaultOpen = false }: {
  title: string
  icon: React.ReactNode
  count: number
  color: string
  flags: Flag[]
  onAction: (id: string, action: 'review' | 'dismiss') => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen || count > 0)

  return (
    <div className={`card p-0 overflow-hidden ${count === 0 ? 'opacity-60' : ''}`}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/30 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className={`p-1.5 rounded-lg ${color}`}>{icon}</div>
        <span className="font-semibold text-zinc-100 text-sm">{title}</span>
        <span className={`ml-1 text-xs px-2 py-0.5 rounded-full font-medium ${
          count > 0 ? `${color} bg-opacity-20` : 'bg-zinc-800 text-zinc-500'
        }`}>{count}</span>
        <div className="ml-auto text-zinc-600">
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </div>
      </button>
      {open && (
        count === 0
          ? <div className="px-4 py-4 text-zinc-600 text-sm text-center border-t border-zinc-800">Nema greÅ¡aka u ovoj kategoriji</div>
          : <div className="border-t border-zinc-800">
              {flags.map(f => <FlagCard key={f.id} flag={f} onAction={onAction} />)}
            </div>
      )}
    </div>
  )
}

export default function AlertsPage() {
  const [flags, setFlags] = useState<Flag[]>([])
  const [chatters, setChatters] = useState<Chatter[]>([])
  const [loading, setLoading] = useState(true)
  const [chatterId, setChatterId] = useState('all')

  async function load() {
    setLoading(true)
    const params = new URLSearchParams({ reviewed: 'false' })
    if (chatterId !== 'all') params.set('chatterId', chatterId)
    const [fr, cr] = await Promise.all([
      fetch(`/api/flags?${params}`),
      fetch('/api/chatters'),
    ])
    const [flagsData, chattersData] = await Promise.all([fr.json(), cr.json()])
    setFlags(flagsData)
    setChatters(chattersData.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
    setLoading(false)
  }

  useEffect(() => { load() }, [chatterId])

  async function handleAction(id: string, action: 'review' | 'dismiss') {
    await fetch('/api/flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    setFlags(prev => prev.filter(f => f.id !== id))
  }

  async function handleReset() {
    if (!confirm('ObriÅ¡i sve alertove? Ovo se ne moÅ¾e poniÅ¡titi.')) return
    await fetch('/api/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'alerts' }),
    })
    setFlags([])
  }

  const critical = flags.filter(f => categoryOf(f) === 'critical')
  const spelling  = flags.filter(f => categoryOf(f) === 'spelling')
  const quality   = flags.filter(f => categoryOf(f) === 'quality')

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Alerta</h1>
          <p className="text-zinc-500 text-sm mt-1">Nepregledane greÅ¡ke po kategorijama</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Chatter filter */}
          <select
            value={chatterId}
            onChange={e => setChatterId(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded-lg px-3 py-2 outline-none hover:border-zinc-600 transition-colors"
          >
            <option value="all">Svi chatteri</option>
            {chatters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            onClick={handleReset}
            className="px-3 py-2 bg-red-900/20 text-red-400 border border-red-800/40 rounded-lg text-xs hover:bg-red-900/40 transition-colors"
          >
            Resetuj sve
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-zinc-500 text-sm">UÄitavam...</div>
      ) : (
        <div className="space-y-3">
          <Section
            title="Critical Errors"
            icon={<ShieldAlert size={14} className="text-red-400" />}
            color="text-red-400 bg-red-900/30"
            count={critical.length}
            flags={critical}
            onAction={handleAction}
            defaultOpen
          />
          <Section
            title="Pravopisne greÅ¡ke"
            icon={<AlertTriangle size={14} className="text-blue-400" />}
            color="text-blue-400 bg-blue-900/30"
            count={spelling.length}
            flags={spelling}
            onAction={handleAction}
            defaultOpen
          />
          <Section
            title="Kvalitet chattovanja"
            icon={<MessageCircle size={14} className="text-purple-400" />}
            color="text-purple-400 bg-purple-900/30"
            count={quality.length}
            flags={quality}
            onAction={handleAction}
            defaultOpen
          />
        </div>
      )}
    </div>
  )
}
