import { prisma } from '@/lib/prisma'
import ChattersList from './ChattersList'

async function getChatters() {
  const chatters = await prisma.chatter.findMany({
    include: {
      messages: {
        include: { flags: true },
        orderBy: { sentAt: 'desc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  return chatters.map((c) => {
    const allFlags = c.messages.flatMap((m) => m.flags).filter((f) => !f.dismissed)
    const criticalErrors = allFlags.filter((f) => f.category === 'critical' || f.severity === 'CRITICAL').length
    const spellingErrors = allFlags.filter((f) =>
      f.category === 'spelling' || (f.category !== 'critical' && (f.type === 'SPELLING' || f.type === 'GRAMMAR'))
    ).length
    const qualityErrors = allFlags.filter((f) =>
      f.category === 'quality' && f.severity !== 'CRITICAL' && f.type !== 'SPELLING' && f.type !== 'GRAMMAR'
    ).length

    const total = c.messages.length
    const weight = criticalErrors * 5 + qualityErrors * 2 + spellingErrors * 1
    const rate = total > 0 ? weight / total : 0
    const score = Math.max(0, Math.min(10, Math.round((1 - Math.min(rate, 1)) * 100) / 10))

    return {
      id: c.id,
      name: c.name,
      totalMessages: total,
      spellingErrors,
      qualityErrors,
      criticalErrors,
      score,
    }
  })
}

export default async function ChattersPage() {
  const chatters = await getChatters()
  return <ChattersList chatters={chatters} />
}
