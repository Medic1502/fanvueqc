'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      router.push('/')
    } else {
      setError('Pogrešna lozinka')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0f0f11] flex items-center justify-center">
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-8 w-full max-w-sm">
        <h1 className="text-white text-xl font-semibold mb-6 text-center">Fanvue QC</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            placeholder="Lozinka"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="bg-[#27272a] text-white rounded-lg px-4 py-2.5 outline-none border border-transparent focus:border-[#6366f1] placeholder:text-zinc-500"
            autoFocus
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-lg py-2.5 font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Prijava...' : 'Prijavi se'}
          </button>
        </form>
      </div>
    </div>
  )
}
