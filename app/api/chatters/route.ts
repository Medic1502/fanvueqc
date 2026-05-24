import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const chatters = await prisma.chatter.findMany({
    include: {
      messages: {
        include: { flags: true },
        orderBy: { sentAt: 'desc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  const result = chatters.map((c) => {
    const totalMessages = c.messages.length
    const allFlags = c.messages.flatMap((m) => m.flags)
    const totalFlags = allFlags.length
    const criticalFlags = allFlags.filter((f) => f.severity === 'CRITICAL').length
    const warningFlags = allFlags.filter((f) => f.severity === 'WARNING').length
    const unreviewedFlags = allFlags.filter((f) => !f.reviewed && !f.dismissed).length

    const errorRate = totalMessages > 0 ? Math.round((totalFlags / totalMessages) * 100) : 0
    const qcScore = Math.max(
      0,
      100 - criticalFlags * 20 - warningFlags * 8 - Math.round(errorRate * 0.3)
    )

    return {
      id: c.id,
      name: c.name,
      username: c.username,
      totalMessages,
      totalFlags,
      criticalFlags,
      warningFlags,
      unreviewedFlags,
      errorRate,
      qcScore,
      lastMessage: c.messages[0]?.sentAt ?? null,
    }
  })

  return NextResponse.json(result)
}
