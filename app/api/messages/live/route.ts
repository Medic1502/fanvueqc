export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const since = req.nextUrl.searchParams.get('since')
  const sinceDate = since ? new Date(since) : new Date(Date.now() - 60_000)

  const messages = await prisma.message.findMany({
    where: { fetchedAt: { gt: sinceDate } },
    orderBy: { fetchedAt: 'asc' },
    take: 100,
    include: { chatter: true, creator: true },
  })

  return NextResponse.json({
    messages: messages.map(m => ({
      id: m.id,
      messageUuid: m.fanvueId,
      model: m.creator.name,
      modelUsername: m.creator.username,
      chatter: m.chatter.name,
      chatterUsername: m.chatter.username,
      fan: m.fanName ?? 'Fan',
      content: m.content,
      sentAt: m.sentAt.toISOString(),
      hasMedia: !m.content && m.analysed,
      replyTimeSeconds: m.replyTimeSeconds,
    })),
    checkedAt: new Date().toISOString(),
  })
}
