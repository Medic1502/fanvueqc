export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const updated = await prisma.chatter.update({
    where: { id: params.id },
    data: { name: name.trim() },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  // Delete in order: flags → messages → chatter
  const messages = await prisma.message.findMany({
    where: { chatterId: params.id },
    select: { id: true },
  })
  const messageIds = messages.map(m => m.id)
  await prisma.flag.deleteMany({ where: { messageId: { in: messageIds } } })
  await prisma.message.deleteMany({ where: { chatterId: params.id } })
  await prisma.chatter.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
