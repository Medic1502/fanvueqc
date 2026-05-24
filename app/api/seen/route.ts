export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const alerts = await prisma.seenAlert.findMany({
    where: { resolvedAt: null, dismissed: false },
    include: { creator: { select: { name: true, username: true } } },
    orderBy: { fanLastMsgAt: 'asc' },
  })
  return NextResponse.json(alerts)
}

export async function PATCH(req: NextRequest) {
  const { id, action } = await req.json()
  if (action === 'dismiss') {
    await prisma.seenAlert.update({ where: { id }, data: { dismissed: true } })
  } else if (action === 'resolve') {
    await prisma.seenAlert.update({ where: { id }, data: { resolvedAt: new Date() } })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  await prisma.seenAlert.deleteMany({ where: { resolvedAt: null, dismissed: false } })
  return NextResponse.json({ ok: true })
}
