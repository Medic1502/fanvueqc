export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'

const severityClass: Record<string, string> = {
  CRITICAL: 'badge-critical',
  WARNING: 'badge-warning',
  INFO: 'badge-info',
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: { chatterId?: string; onlyFlagged?: string }
}) {
  const where = {
    ...(searchParams.chatterId ? { chatterId: searchParams.chatterId } : {}),
    ...(searchParams.onlyFlagged ? { flags: { some: { dismissed: false } } } : {}),
  }

  const [messages, chatters] = await Promise.all([
    prisma.message.findMany({
      where,
      include: {
        chatter: true,
        creator: true,
        flags: { where: { dismissed: false } },
      },
      orderBy: { sentAt: 'desc' },
      take: 150,
    }),
    prisma.chatter.findMany({ orderBy: { name: 'asc' } }),
  ])

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-100 mb-1">Poruke</h1>
      <p className="text-zinc-500 text-sm mb-6">Sve poruke chattera sa analizom</p>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <form className="flex gap-3 flex-wrap">
          <select
            name="chatterId"
            defaultValue={searchParams.chatterId ?? ''}
            className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2"
          >
            <option value="">Svi chatteri</option>
            {chatters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-zinc-400 text-sm">
            <input
              type="checkbox"
              name="onlyFlagged"
              value="1"
              defaultChecked={!!searchParams.onlyFlagged}
              className="accent-brand-500"
            />
            Samo sa greSkama
          </label>
          <button type="submit" className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors">
            Filtriraj
          </button>
        </form>
      </div>

      {messages.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-zinc-500">Nema poruka. Pokreni sinhronizaciju iz sidebar-a.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map((msg) => (
            <div key={msg.id} className={`card ${msg.flags.length > 0 ? 'border-zinc-700' : ''}`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-zinc-300 text-xs font-medium">{msg.chatter.name}</span>
                <span className="text-zinc-700 text-xs">â†’</span>
                <span className="text-zinc-500 text-xs">{msg.creator.name}</span>
                {msg.fanName && (
                  <>
                    <span className="text-zinc-700 text-xs">|</span>
                    <span className="text-zinc-600 text-xs">Fan: {msg.fanName}</span>
                  </>
                )}
                <span className="ml-auto text-zinc-700 text-xs">
                  {format(new Date(msg.sentAt), 'dd.MM.yyyy HH:mm')}
                </span>
              </div>

              <p className="text-zinc-200 text-sm leading-relaxed mb-2">
                {msg.content || <em className="text-zinc-600">Medija bez teksta</em>}
              </p>

              {msg.flags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800">
                  {msg.flags.map((flag) => (
                    <div key={flag.id} className="flex items-center gap-1.5">
                      <span className={severityClass[flag.severity]}>{flag.severity}</span>
                      <span className="text-zinc-400 text-xs">{flag.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
