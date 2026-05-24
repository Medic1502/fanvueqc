export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'X-Fanvue-API-Version': '2025-06-26',
})

async function get(token: string, path: string) {
  const res = await fetch(`https://api.fanvue.com${path}`, { headers: HEADERS(token) })
  const text = await res.text()
  try { return { status: res.status, data: JSON.parse(text) } }
  catch { return { status: res.status, data: text.slice(0, 300) } }
}

export async function GET() {
  const creators = await prisma.creator.findMany({
    where: { accessToken: { not: null } },
    select: { id: true, name: true, fanvueId: true, accessToken: true },
  })

  if (creators.length === 0) {
    return NextResponse.json({ error: 'No connected creators' })
  }

  const results = []

  for (const creator of creators) {
    const token = creator.accessToken!

    const chats = await get(token, '/chats?size=10&sortBy=most_recent_messages')
    const chatList = chats.data?.data ?? []

    // Find the most recent chatter message across all recent chats
    let newestChatterMsg: { text: string; sentAt: string; sentByUserId: string | null; chatUser: string } | null = null

    for (const chat of chatList.slice(0, 5)) {
      const fanUuid = chat.user?.uuid
      if (!fanUuid) continue
      const msgs = await get(token, `/chats/${fanUuid}/messages?size=5`)
      for (const m of (msgs.data?.data ?? [])) {
        if (m.sender?.uuid !== creator.fanvueId) continue
        if (!newestChatterMsg || new Date(m.sentAt) > new Date(newestChatterMsg.sentAt)) {
          newestChatterMsg = {
            text: m.text,
            sentAt: m.sentAt,
            sentByUserId: m.sentByUserId,
            chatUser: chat.user?.displayName ?? chat.user?.handle,
          }
        }
      }
    }

    results.push({
      creator: creator.name,
      tokenOk: chats.status === 200,
      mostRecentChats: chatList.slice(0, 3).map((c: { user: { displayName: string; handle: string }; lastMessageAt: string; lastMessage: { sentByUserId: string | null; sentAt: string } }) => ({
        fan: c.user?.displayName ?? c.user?.handle,
        lastMessageAt: c.lastMessageAt,
        lastMsgSentByUserId: c.lastMessage?.sentByUserId,
      })),
      newestChatterMessage: newestChatterMsg,
    })
  }

  return NextResponse.json(results, { status: 200 })
}
