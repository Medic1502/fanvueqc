export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const severityClass: Record<string, string> = {
  CRITICAL: 'badge-critical',
  WARNING: 'badge-warning',
  INFO: 'badge-info',
}

const typeLabel: Record<string, string> = {
  SPELLING: 'Pravopis',
  GRAMMAR: 'Gramatika',
  TONE: 'Ton',
  TOS: 'TOS krsenje',
  POACHING: 'Poaching',
  DRY: 'Dry texting',
  RULE: 'Pravilo',
}

export default async function ChatterDetailPage({ params }: { params: { id: string } }) {
  const chatter = await prisma.chatter.findUnique({
    where: { id: params.id },
    include: {
      messages: {
        include: {
          flags: { where: { dismissed: false }, orderBy: { severity: 'asc' } },
          creator: true,
        },
        orderBy: { sentAt: 'desc' },
        take: 200,
      },
    },
  })

  if (!chatter) notFound()

  const allFlags = chatter.messages.flatMap((m) => m.flags)
  const criticalFlags = allFlags.filter((f) => f.severity === 'CRITICAL').length
  const warningFlags = allFlags.filter((f) => f.severity === 'WARNING').length
  const qcScore = Math.max(0, 100 - criticalFlags * 20 - warningFlags * 8)

  const flaggedMessages = chatter.messages.filter((m) => m.flags.length > 0)

  const replyTimes = chatter.messages.map((m) => m.replyTimeSeconds).filter((t): t is number => t !== null)
  const avgReplySeconds = replyTimes.length > 0
    ? Math.round(replyTimes.reduce((a, b) => a + b, 0) / replyTimes.length)
    : null

  function formatReply(s: number | null) {
    if (s === null) return '—'
    if (s < 60) return `${s}s`
    if (s < 3600) return `${Math.round(s / 60)}m`
    const h = Math.floor(s / 3600)
    const m = Math.round((s % 3600) / 60)
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }

  const uniqueCreators = Array.from(
    new Map(chatter.messages.map((m) => [m.creator.id, m.creator.name])).values()
  )

  return (
    <div>
      <Link href="/chatters" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 text-sm mb-6 transition-colors">
        <ArrowLeft size={14} />
        Nazad na chattere
      </Link>

      <div className="flex items-start gap-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">{chatter.name}</h1>
          {chatter.username && <div className="text-zinc-500 text-sm">@{chatter.username}</div>}
          {uniqueCreators.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-zinc-600 text-xs">Radi na:</span>
              {uniqueCreators.map((name) => (
                <span key={name} className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-full">{name}</span>
              ))}
            </div>
          )}
        </div>
        <div className={`text-2xl font-bold px-4 py-1.5 rounded-xl ${
          qcScore >= 80 ? 'text-emerald-400 bg-emerald-900/30' :
          qcScore >= 60 ? 'text-amber-400 bg-amber-900/30' :
          'text-red-400 bg-red-900/30'
        }`}>
          QC {qcScore}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Ukupno poruka', value: chatter.messages.length },
          { label: 'Sa greskom', value: flaggedMessages.length },
          { label: 'Kriticnih', value: criticalFlags, red: true },
          { label: 'Upozorenja', value: warningFlags, amber: true },
          { label: 'Avg reply', value: formatReply(avgReplySeconds) },
        ].map((s) => (
          <div key={s.label} className="card text-center">
            <div className={`text-2xl font-bold ${s.red ? 'text-red-400' : s.amber ? 'text-amber-400' : 'text-zinc-100'}`}>
              {s.value}
            </div>
            <div className="text-zinc-500 text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <h2 className="text-zinc-100 font-semibold mb-4">Poruke sa greSkama</h2>

      {flaggedMessages.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-zinc-500">Ovaj chatter nema flagovanih poruka.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {flaggedMessages.map((msg) => (
            <div key={msg.id} className="card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 text-xs">Na modelu:</span>
                  <span className="text-zinc-200 text-xs font-medium">{msg.creator.name}</span>
                </div>
                <span className="text-zinc-600 text-xs">
                  {format(new Date(msg.sentAt), 'dd.MM.yyyy HH:mm')}
                </span>
              </div>

              <div className="bg-zinc-800/60 rounded-lg p-3 mb-3 border-l-2 border-zinc-600">
                <p className="text-zinc-200 text-sm leading-relaxed">{msg.content || <em className="text-zinc-500">Medija poruka (bez teksta)</em>}</p>
              </div>

              <div className="space-y-2">
                {msg.flags.map((flag) => (
                  <div key={flag.id} className="flex items-start gap-3">
                    <span className={severityClass[flag.severity]}>{flag.severity}</span>
                    <span className="text-zinc-500 text-xs font-mono mt-0.5">{typeLabel[flag.type] ?? flag.type}</span>
                    <div className="flex-1">
                      <p className="text-zinc-300 text-xs">{flag.description}</p>
                      {flag.suggestion && (
                        <p className="text-emerald-400 text-xs mt-0.5">
                          <span className="text-zinc-600">Predlog: </span>{flag.suggestion}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
