import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const { target } = await req.json()

  if (target === 'alerts') {
    const { count } = await prisma.flag.deleteMany({})
    return NextResponse.json({ ok: true, deleted: count, target: 'alerts' })
  }

  if (target === 'messages') {
    await prisma.flag.deleteMany({})
    await prisma.message.deleteMany({})
    await prisma.syncLog.deleteMany({})
    return NextResponse.json({ ok: true, target: 'messages' })
  }

  if (target === 'chatters') {
    // Must delete in order due to foreign keys
    await prisma.flag.deleteMany({})
    await prisma.message.deleteMany({})
    await prisma.chatter.deleteMany({})
    await prisma.syncLog.deleteMany({})
    return NextResponse.json({ ok: true, target: 'chatters' })
  }

  return NextResponse.json({ error: 'Unknown target' }, { status: 400 })
}
