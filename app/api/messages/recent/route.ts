import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const messages = await prisma.message.findMany({
    orderBy: { sentAt: 'desc' },
    take: 200,
    include: {
      chatter: true,
      creator: true,
    },
  })

  const result = messages.map(m => ({
    id: m.id,
    model: m.creator.name,
    modelUsername: m.creator.username,
    chatter: m.chatter.name,
    chatterUsername: m.chatter.username,
    fan: m.fanName ?? 'Fan',
    content: m.content,
    sentAt: m.sentAt.toISOString(),
    hasMedia: !m.content && m.analysed,
    replyTimeSeconds: m.replyTimeSeconds,
  }))

  return NextResponse.json(result)
}
