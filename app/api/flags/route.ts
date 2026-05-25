export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const chatterId = searchParams.get('chatterId')
  const severity = searchParams.get('severity')
  const type = searchParams.get('type')
  const reviewed = searchParams.get('reviewed')

  const flags = await prisma.flag.findMany({
    where: {
      dismissed: false,
      ...(severity ? { severity } : {}),
      ...(type ? { type } : {}),
      ...(reviewed !== null ? { reviewed: reviewed === 'true' } : {}),
      message: {
        ...(chatterId ? { chatterId } : {}),
      },
    },
    include: {
      message: {
        select: {
          content: true,
          sentAt: true,
          fanName: true,
          replyTimeSeconds: true,
          chatter: { select: { id: true, name: true } },
          creator: { select: { name: true } },
        },
      },
    },
    orderBy: [{ message: { sentAt: 'desc' } }],
    take: 100,
  })

  return NextResponse.json(flags)
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, action, chatterId } = body

  if (action === 'reviewAll') {
    const result = await prisma.flag.updateMany({
      where: {
        reviewed: false,
        dismissed: false,
        ...(chatterId ? { message: { chatterId } } : {}),
      },
      data: { reviewed: true },
    })
    return NextResponse.json({ ok: true, count: result.count })
  }

  if (!id || !action) return NextResponse.json({ error: 'missing id or action' }, { status: 400 })

  if (action === 'delete') {
    await prisma.flag.delete({ where: { id } })
  } else {
    await prisma.flag.update({
      where: { id },
      data:
        action === 'dismiss'
          ? { dismissed: true }
          : action === 'review'
          ? { reviewed: true }
          : {},
    })
  }

  return NextResponse.json({ ok: true })
}
