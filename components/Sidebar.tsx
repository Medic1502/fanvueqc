'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Flag, Settings, Eye } from 'lucide-react'

const links = [
  { href: '/', label: 'Messages', icon: LayoutDashboard },
  { href: '/alerts', label: 'Alerta', icon: Flag },
  { href: '/seen', label: 'Seenano', icon: Eye },
  { href: '/chatters', label: 'Chatteri', icon: Users },
  { href: '/setup', label: 'Creators', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-zinc-950 border-r border-zinc-800 flex flex-col py-6 px-4">
      <div className="mb-8">
        <div className="text-brand-500 font-bold text-lg">Fanvue QC</div>
        <div className="text-zinc-500 text-xs mt-0.5">Chatter Quality Control</div>
      </div>

      <nav className="flex-1 space-y-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand-600/20 text-brand-400'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

    </aside>
  )
}
