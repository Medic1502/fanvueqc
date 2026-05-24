import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analyzeMessage } from '@/lib/analyzer'

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Fanvue sends different event types via webhook
  const event = body.event ?? body.type
  if (event !== 'message.created' && event !== 'chat.message') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const msg = body.data ?? body
  if (!msg.isSentByCreator && !msg.sentByCreator) {
    return NextResponse.json({ ok: true, skipped: 'fan_message' })
  }

  const chatterId = msg.sentByTeamMember?.uuid ?? msg.teamMemberId
  if (!chatterId) return NextResponse.json({ ok: true, skipped: 'no_chatter_id' })

  const [chatter, creator] = await Promise.all([
    prisma.chatter.findUnique({ where: { fanvueId: chatterId } }),
    prisma.creator.findUnique({ where: { fanvueId: msg.creatorUuid ?? msg.creatorId } }),
  ])

  if (!chatter || !creator) {
    return NextResponse.json({ ok: false, error: 'chatter or creator not found' }, { status: 400 })
  }

  const existing = await prisma.message.findUnique({ where: { fanvueId: msg.uuid ?? msg.id } })
  if (existing) return NextResponse.json({ ok: true, skipped: 'duplicate' })

  const savedMsg = await prisma.message.create({
    data: {
      fanvueId: msg.uuid ?? msg.id,
      content: msg.text ?? msg.content ?? '',
      sentAt: new Date(msg.createdAt ?? Date.now()),
      chatterId: chatter.id,
      creatorId: creator.id,
      fanUuid: msg.chatUserUuid ?? msg.fanUuid,
      fanName: msg.chatUserName ?? msg.fanName,
    },
  })

  const flags = await analyzeMessage(savedMsg.content)
  for (const flag of flags) {
    await prisma.flag.create({
      data: {
        messageId: savedMsg.id,
        type: flag.type,
        severity: flag.severity,
        description: flag.description,
        suggestion: flag.suggestion,
      },
    })
  }

  await prisma.message.update({ where: { id: savedMsg.id }, data: { analysed: true } })

  return NextResponse.json({ ok: true, flags: flags.length })
}
