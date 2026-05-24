'use client'
import { useEffect, useState } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { Eye, X, Check, Trash2, ExternalLink } from 'lucide-react'

type SeenAlert = {
  id: string
  fanUuid: string
  fanName: string | null
  fanHandle: string | null
  fanLastMsg: string | null
  fanLastMsgAt: string
  createdAt: string
  creator: { name: string; username: string | null }
}

function waitingColor(sentAt: string) {
  const mins = (Date.now() - new Date(sentAt).getTime()) / 60000
  if (mins >= 120) return 'text-red-400'
  if (mins >= 60) return 'text-amber-400'
  return 'text-yellow-400'
}

function AlertCard({
  alert,
  onRemove,
}: {
  alert: SeenAlert
  onRemove: (id: string) => void
}) {
  async function handleAction(action: 'dismiss' | 'resolve') {
    await fetch('/api/seen', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: alert.id, action }),
    })
    onRemove(alert.id)
  }

  const waitMins = Math.round((Date.now() - new Date(alert.fanLastMsgAt).getTime()) / 60000)

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Waiting time */}
        <div className="shrink-0 text-center w-16">
          <div className={`text-xl font-bold tabular-nums ${waitingColor(alert.fanLastMsgAt)}`}>
            {waitMins >= 60
              ? `${Math.floor(waitMins / 60)}h${waitMins % 60 > 0 ? ` ${waitMins % 60}m` : ''}`
              : `${waitMins}m`}
          </div>
          <div className="text-zinc-600 text-xs">čeka</div>
        </div>

        {/* Fan + creator info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-zinc-100 font-semibold text-sm">
              {alert.fanName ?? 'Fan'}
            </span>
            <span className="text-zinc-700 text-xs">→</span>
            <span className="text-zinc-400 text-xs">{alert.creator.name}</span>
            {alert.creator.username && (
              <span className="text-zinc-600 text-xs">@{alert.creator.username}</span>
            )}
          </div>
          {alert.fanLastMsg && (
            <div className="bg-zinc-800/50 rounded px-2.5 py-1.5 text-zinc-400 text-xs leading-relaxed border-l-2 border-zinc-700 truncate max-w-xl">
              {alert.fanLastMsg}
            </div>
          )}
          <div className="text-zinc-700 text-xs mt-1">
            Poslao {format(new Date(alert.fanLastMsgAt), 'dd.MM u HH:mm')}
            {' · '}
            Alert od {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 shrink-0">
          <a
            href={alert.fanHandle
              ? `https://www.fanvue.com/${alert.fanHandle}`
              : `https://www.fanvue.com/messages/${alert.fanUuid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-lg text-xs hover:text-zinc-100 transition-colors"
            title={alert.fanHandle ? `Otvori profil @${alert.fanHandle}` : 'Otvori chat na Fanvue'}
          >
            <ExternalLink size={12} />
            Fanvue
          </a>
          <button
            onClick={() => handleAction('resolve')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/20 text-emerald-400 border border-emerald-800/40 rounded-lg text-xs hover:bg-emerald-900/40 transition-colors"
            title="Odgovoreno"
          >
            <Check size={12} />
          </button>
          <button
            onClick={() => handleAction('dismiss')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 text-zinc-500 border border-zinc-700 rounded-lg text-xs hover:text-zinc-300 transition-colors"
            title="Odbaci"
          >
            <X size={12} />
          </button>
        </div>
      </div>

    </div>
  )
}

export default function SeenPage() {
  const [alerts, setAlerts] = useState<SeenAlert[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/seen')
    setAlerts(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [])

  function removeAlert(id: string) {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  async function handleClearAll() {
    if (!confirm('Obriši sve seen alertove?')) return
    await fetch('/api/seen', { method: 'DELETE' })
    setAlerts([])
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Eye size={22} className="text-purple-400" />
            Seenano
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Fanovi koji čekaju odgovor više od 30 minuta
          </p>
        </div>
        <div className="flex items-center gap-3">
          {alerts.length > 0 && (
            <div className="px-3 py-1.5 bg-purple-900/20 border border-purple-800/40 rounded-lg">
              <span className="text-purple-400 text-sm font-semibold">{alerts.length} čeka</span>
            </div>
          )}
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-3 py-2 bg-red-900/20 text-red-400 border border-red-800/40 rounded-lg text-sm hover:bg-red-900/40 transition-colors"
          >
            <Trash2 size={13} />
            Obriši sve
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-zinc-500 text-sm">Učitavam...</div>
      ) : alerts.length === 0 ? (
        <div className="card text-center py-16">
          <Eye size={32} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium">Nema seenovanih fanova</p>
          <p className="text-zinc-600 text-sm mt-1">
            Pojavljivaće se ovde kad fan čeka odgovor duže od 30 min
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(alert => (
            <AlertCard key={alert.id} alert={alert} onRemove={removeAlert} />
          ))}
        </div>
      )}
    </div>
  )
}
