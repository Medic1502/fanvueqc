'use client'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, UserPlus, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

type Creator = { id: string; name: string; username: string | null; connectedAt: Date | null }

export default function SetupClient({ connectedCreators }: { connectedCreators: Creator[] }) {
  const params = useSearchParams()
  const success = params.get('success')
  const error = params.get('error')
  const name = params.get('name')

  return (
    <div className="max-w-xl mx-auto mt-12">
      <h1 className="text-2xl font-bold text-zinc-100 mb-1">Podešavanja</h1>
      <p className="text-zinc-500 text-sm mb-8">
        Svaki kreator (model) mora posebno da se poveže. Loguješ se kao taj kreator i klikneš dugme.
      </p>

      {success === 'creator' && (
        <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-xl p-4 mb-6 flex items-center gap-3 text-emerald-400 text-sm">
          <CheckCircle size={16} />
          <span>Kreator <strong>{decodeURIComponent(name ?? '')}</strong> je uspešno povezan!</span>
        </div>
      )}
      {success === 'admin' && (
        <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-xl p-4 mb-6 flex items-center gap-3 text-emerald-400 text-sm">
          <CheckCircle size={16} />
          Admin token sačuvan. Restartuj server.
        </div>
      )}
      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 mb-6 flex items-start gap-3 text-red-400 text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>Greška: {decodeURIComponent(error)}</span>
        </div>
      )}

      {/* Connected creators */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-zinc-200 font-semibold">Povezani kreatori</h2>
          <span className="text-zinc-500 text-xs">{connectedCreators.length} / 9</span>
        </div>

        {connectedCreators.length === 0 ? (
          <p className="text-zinc-600 text-sm">Nema još nijednog kreatora. Dodaj prvog ispod.</p>
        ) : (
          <div className="space-y-2">
            {connectedCreators.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-2 border-b border-zinc-800 last:border-0">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <div className="flex-1">
                  <span className="text-zinc-200 text-sm font-medium">{c.name}</span>
                  {c.username && <span className="text-zinc-600 text-xs ml-2">@{c.username}</span>}
                </div>
                {c.connectedAt && (
                  <span className="text-zinc-600 text-xs">
                    {format(new Date(c.connectedAt), 'dd.MM.yyyy')}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add creator button */}
      <div className="card">
        <h2 className="text-zinc-200 font-semibold mb-2">Dodaj kreatora</h2>
        <p className="text-zinc-500 text-sm mb-4">
          Otvori Fanvue u <strong className="text-zinc-300">Incognito tabu</strong> (ili se odjavi),
          loguješ se kao kreator čiji nalog hoćeš da poveže, pa klikni dugme ispod.
        </p>
        <button
          onClick={() => {
            const popup = window.open(
              '/api/auth/start',
              'fanvue_login',
              'width=520,height=680,top=100,left=200,resizable=yes,scrollbars=yes'
            )
            const timer = setInterval(() => {
              if (popup?.closed) {
                clearInterval(timer)
                window.location.reload()
              }
            }, 500)
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-xl transition-colors text-sm"
        >
          <UserPlus size={15} />
          Poveži Fanvue nalog
        </button>
      </div>

      <div className="mt-6 p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-xl">
        <p className="text-zinc-500 text-xs leading-relaxed">
          <strong className="text-zinc-400">Kako radi:</strong> Klikneš dugme → Fanvue traži login →
          loguješ se kao željeni kreator → odobriš pristup → kreator se automatski dodaje ovde.
          Ponovi za svaki od 9 kreatora. Preporučujemo Incognito prozor da ne mešaš sesije.
        </p>
      </div>
    </div>
  )
}
