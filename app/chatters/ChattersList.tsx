'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ChevronDown, ChevronRight, Pencil, Check, X, Trash2, AlertTriangle, ShieldAlert, MessageCircle } from 'lucide-react'

type Chatter = {
  id: string
  name: string
  totalMessages: number
  spellingErrors: number
  qualityErrors: number
  criticalErrors: number
  score: number
}

function scoreColor(s: number) {
  if (s >= 9) return 'text-emerald-400'
  if (s >= 7) return 'text-amber-400'
  if (s >= 5) return 'text-orange-400'
  return 'text-red-400'
}

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
    creator: { name: string }
  }
}

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

const ALL_TYPES = ['POACHING', 'TOS', 'INSULT', 'SPELLING', 'GRAMMAR', 'DRY', 'ENGAGEMENT', 'SALES', 'SLOW_REPLY', 'TONE', 'RULE']

function categoryOf(flag: Flag): 'critical' | 'spelling' | 'quality' {
  if (flag.category === 'critical' || flag.severity === 'CRITICAL') return 'critical'
  if (flag.category === 'spelling' || flag.type === 'SPELLING' || flag.type === 'GRAMMAR') return 'spelling'
  return 'quality'
}

function ChatterRow({ chatter, onDeleted }: { chatter: Chatter; onDeleted: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [flags, setFlags] = useState<Flag[] | null>(null)
  const [loadingFlags, setLoadingFlags] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(chatter.name)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [typeFilter, setTypeFilter] = useState<string>('all')

  async function handleRowClick() {
    if (editing) return
    if (!expanded && flags === null) {
      setLoadingFlags(true)
      const res = await fetch(`/api/flags?chatterId=${chatter.id}`)
      setFlags(await res.json())
      setLoadingFlags(false)
    }
    setExpanded(v => !v)
  }

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setEditing(true)
  }

  async function saveName(e?: React.MouseEvent) {
    e?.stopPropagation()
    const trimmed = name.trim()
    if (!trimmed || trimmed === chatter.name) { setEditing(false); return }
    setSaving(true)
    await fetch(`/api/chatters/${chatter.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    setSaving(false)
    setEditing(false)
  }

  function cancelEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setEditing(false)
    setName(chatter.name)
  }

  async function deleteChatter(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Obriši chattera "${name}" i sve njegove poruke i greške?\n\nOvo se ne može poništiti.`)) return
    setDeleting(true)
    await fetch(`/api/chatters/${chatter.id}`, { method: 'DELETE' })
    onDeleted()
  }

  async function deleteFlag(flagId: string) {
    await fetch('/api/flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: flagId, action: 'delete' }),
    })
    setFlags(prev => prev?.filter(f => f.id !== flagId) ?? null)
  }

  const visibleFlags = flags
    ? typeFilter === 'all' ? flags : flags.filter(f => categoryOf(f) === typeFilter)
    : []

  const presentTypes = flags ? ALL_TYPES.filter(t => flags.some(f => f.type === t)) : []

  const criticalFlags = flags?.filter(f => categoryOf(f) === 'critical') ?? []
  const spellingFlags = flags?.filter(f => categoryOf(f) === 'spelling') ?? []
  const qualityFlags  = flags?.filter(f => categoryOf(f) === 'quality') ?? []

  return (
    <div className="card p-0 overflow-hidden">
      {/* Main row — entire row is clickable except edit input and delete button */}
      <div
        className="flex items-center gap-4 px-4 py-3 cursor-pointer select-none hover:bg-zinc-800/30 transition-colors"
        onClick={handleRowClick}
      >
        {/* Chevron */}
        <div className="text-zinc-600 shrink-0 pointer-events-none">
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </div>

        {/* Name — editing stops propagation, plain name does not */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveName()
                  if (e.key === 'Escape') { setEditing(false); setName(chatter.name) }
                }}
                className="bg-zinc-800 border border-brand-600 text-zinc-100 text-sm rounded-lg px-2 py-1 outline-none w-40"
              />
              <button onClick={saveName} disabled={saving} className="text-emerald-400 hover:text-emerald-300 p-0.5">
                <Check size={14} />
              </button>
              <button onClick={cancelEdit} className="text-zinc-500 hover:text-zinc-300 p-0.5">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <span className="text-zinc-100 font-semibold text-sm">{name}</span>
              <button
                onClick={startEdit}
                className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-brand-400 transition-all"
              >
                <Pencil size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-8 text-center shrink-0 pointer-events-none">
          <div>
            <div className="text-zinc-100 font-semibold text-sm">{chatter.totalMessages}</div>
            <div className="text-zinc-500 text-xs">Poruka</div>
          </div>
          <div>
            <div className={`font-semibold text-sm ${chatter.spellingErrors > 0 ? 'text-blue-400' : 'text-zinc-100'}`}>
              {chatter.spellingErrors}
            </div>
            <div className="text-zinc-500 text-xs">Pravopis</div>
          </div>
          <div>
            <div className={`font-semibold text-sm ${chatter.qualityErrors > 0 ? 'text-purple-400' : 'text-zinc-100'}`}>
              {chatter.qualityErrors}
            </div>
            <div className="text-zinc-500 text-xs">Kvalitet</div>
          </div>
          <div>
            <div className={`font-semibold text-sm ${chatter.criticalErrors > 0 ? 'text-red-400' : 'text-zinc-100'}`}>
              {chatter.criticalErrors}
            </div>
            <div className="text-zinc-500 text-xs">Kritičnih</div>
          </div>
          <div>
            <div className={`font-bold text-sm ${scoreColor(chatter.score)}`}>
              {chatter.score.toFixed(1)}
            </div>
            <div className="text-zinc-500 text-xs">Ocena</div>
          </div>
        </div>

        {/* Delete chatter button */}
        <button
          onClick={deleteChatter}
          disabled={deleting}
          className="shrink-0 p-1.5 text-zinc-700 hover:text-red-400 transition-colors disabled:opacity-40"
          title="Ukloni chattera"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-zinc-800 bg-zinc-900/50">
          {loadingFlags ? (
            <div className="px-4 py-6 text-zinc-500 text-sm text-center">Učitavam greške...</div>
          ) : !flags || flags.length === 0 ? (
            <div className="px-4 py-6 text-zinc-600 text-sm text-center">Nema evidentiranih grešaka.</div>
          ) : (
            <>
              {/* Category filter */}
              <div className="flex gap-1 px-4 py-2.5 border-b border-zinc-800/50 flex-wrap">
                <button
                  onClick={() => setTypeFilter('all')}
                  className={`px-2.5 py-0.5 rounded text-xs transition-colors ${
                    typeFilter === 'all' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Sve ({flags.length})
                </button>
                {criticalFlags.length > 0 && (
                  <button
                    onClick={() => setTypeFilter('critical')}
                    className={`px-2.5 py-0.5 rounded text-xs transition-colors ${
                      typeFilter === 'critical' ? 'bg-red-900/40 text-red-300' : 'text-red-500 hover:text-red-300'
                    }`}
                  >
                    Critical ({criticalFlags.length})
                  </button>
                )}
                {spellingFlags.length > 0 && (
                  <button
                    onClick={() => setTypeFilter('spelling')}
                    className={`px-2.5 py-0.5 rounded text-xs transition-colors ${
                      typeFilter === 'spelling' ? 'bg-blue-900/40 text-blue-300' : 'text-blue-500 hover:text-blue-300'
                    }`}
                  >
                    Pravopis ({spellingFlags.length})
                  </button>
                )}
                {qualityFlags.length > 0 && (
                  <button
                    onClick={() => setTypeFilter('quality')}
                    className={`px-2.5 py-0.5 rounded text-xs transition-colors ${
                      typeFilter === 'quality' ? 'bg-purple-900/40 text-purple-300' : 'text-purple-500 hover:text-purple-300'
                    }`}
                  >
                    Kvalitet ({qualityFlags.length})
                  </button>
                )}
              </div>

              {visibleFlags.length === 0 ? (
                <div className="px-4 py-5 text-zinc-600 text-sm text-center">Nema grešaka za ovaj filter.</div>
              ) : (
                <div className="divide-y divide-zinc-800/50">
                  {visibleFlags.map(flag => (
                    <div key={flag.id} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Badge row */}
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {categoryOf(flag) === 'critical' ? (
                              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-900/20 text-red-400 border border-red-800/40">
                                <ShieldAlert size={10} /> CRITICAL
                              </span>
                            ) : categoryOf(flag) === 'spelling' ? (
                              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-blue-900/20 text-blue-400 border border-blue-800/40">
                                <AlertTriangle size={10} /> PRAVOPIS
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-purple-900/20 text-purple-400 border border-purple-800/40">
                                <MessageCircle size={10} /> KVALITET
                              </span>
                            )}
                            <span className="text-zinc-500 text-xs font-mono">
                              {TYPE_LABEL[flag.type] ?? flag.type}
                            </span>
                            <span className="text-zinc-600 text-xs">→ {flag.message.creator.name}</span>
                            {flag.message.fanName && (
                              <span className="text-zinc-700 text-xs">| Fan: {flag.message.fanName}</span>
                            )}
                            <span className="ml-auto text-zinc-700 text-xs">
                              {format(new Date(flag.message.sentAt), 'dd.MM HH:mm')}
                            </span>
                          </div>

                          {/* Message */}
                          <div className="bg-zinc-800/60 rounded-lg px-3 py-2 mb-2 border-l-2 border-zinc-700 text-sm text-zinc-300">
                            {flag.message.content || <em className="text-zinc-600">Media poruka</em>}
                          </div>

                          {/* Description */}
                          <p className="text-zinc-400 text-xs">{flag.description}</p>
                          {flag.suggestion && (
                            <p className="text-emerald-400 text-xs mt-0.5">
                              <span className="text-zinc-600">Predlog: </span>{flag.suggestion}
                            </p>
                          )}
                        </div>

                        {/* X delete button */}
                        <button
                          onClick={() => deleteFlag(flag.id)}
                          className="shrink-0 mt-0.5 p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                          title="Obriši grešku"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function ChattersList({ chatters: initial }: { chatters: Chatter[] }) {
  const router = useRouter()
  const [chatters, setChatters] = useState(initial)
  const [resetting, setResetting] = useState(false)

  function removeChatter(id: string) {
    setChatters(prev => prev.filter(c => c.id !== id))
  }

  async function handleReset() {
    if (!confirm('Obriši sve chattere, poruke i alertove?\n\nNovi chatteri se dodaju automatski čim pošalju poruku.\n\nOvo se ne može poništiti.')) return
    setResetting(true)
    await fetch('/api/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'chatters' }),
    })
    setResetting(false)
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Chatteri</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Klikni na red za greške · Hover na ime za preimenovanje
          </p>
        </div>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="flex items-center gap-2 px-3 py-2 bg-red-900/20 text-red-400 border border-red-800/40 rounded-lg text-sm hover:bg-red-900/40 transition-colors disabled:opacity-50"
        >
          <Trash2 size={14} />
          {resetting ? 'Brišem...' : 'Resetuj sve'}
        </button>
      </div>

      {chatters.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-zinc-400 font-medium">Nema chattera</p>
          <p className="text-zinc-600 text-sm mt-1">Chatteri se pojavljuju čim pošalju prvu poruku.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {chatters.map(c => (
            <ChatterRow key={c.id} chatter={c} onDeleted={() => removeChatter(c.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
