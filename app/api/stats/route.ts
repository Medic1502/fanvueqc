import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [criticalToday, warningToday, unreviewedTotal, messagesToday] = await Promise.all([
    prisma.flag.count({
      where: { severity: 'CRITICAL', dismissed: false, createdAt: { gte: todayStart } },
    }),
    prisma.flag.count({
      where: { severity: 'WARNING', dismissed: false, createdAt: { gte: todayStart } },
    }),
    prisma.flag.count({ where: { reviewed: false, dismissed: false } }),
    prisma.message.count({ where: { sentAt: { gte: todayStart } } }),
  ])

  // Top flagged chatters today
  const topFlagged = await prisma.flag.groupBy({
    by: ['messageId'],
    where: { severity: 'CRITICAL', dismissed: false, createdAt: { gte: todayStart } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 5,
  })

  return NextResponse.json({ criticalToday, warningToday, unreviewedTotal, messagesToday })
}
