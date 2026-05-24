import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'Fanvue Chatter QC',
  description: 'Quality control dashboard for Fanvue chatter agencies',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-56 p-8 max-w-7xl">
          {children}
        </main>
      </body>
    </html>
  )
}
