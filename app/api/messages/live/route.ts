export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analyzeMessage } from '@/lib/analyzer'

const API_BASE = 'https://api.fanvue.com'
const AUTH_BASE = 'https://auth.fanvue.com'

function apiHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'X-Fanvue-API-Version': '2025-06-26',
  }
}

async function refreshAccessToken(creatorId: string, refreshToken: string): Promise<string | null> {
  const credentials = Buffer.from(
    `${process.env.FANVUE_CLIENT_ID}:${process.env.FANVUE_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(`${AUTH_BASE}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) return null

  const data = await res.json()
  const newAccess = data.access_token
  const newRefresh = data.refresh_token ?? refreshToken

  await prisma.creator.update({
    where: { id: creatorId },
    data: { accessToken: newAccess, refreshToken: newRefresh },
  })

  return newAccess
}

async function apiFetchWithRefresh(
  creatorId: string,
  token: string,
  refreshToken: string | null,
  path: string,
  tokenRef: { current: string }
): Promise<unknown> {
  let res = await fetch(`${API_BASE}${path}`, { headers: apiHeaders(token) })

  if (res.status === 401 && refreshToken) {
    const newToken = await refreshAccessToken(creatorId, refreshToken)
    if (!newToken) throw new Error('Token refresh failed')
    tokenRef.current = newToken
    res = await fetch(`${API_BASE}${path}`, { headers: apiHeaders(newToken) })
  }

  if (!res.ok) throw new Error(`${res.status} ${path}`)
  return res.json()
}

// In-memory cache of chatter names to avoid repeated API calls
const chatterNameCache: Record<string, string> = {}

// Seen alert check runs every 5 minutes, not every 4-second poll
const SEEN_THRESHOLD_MS = 30 * 60 * 1000   // flag after 30 min unanswered
const SEEN_MAX_AGE_MS   = 12 * 60 * 60 * 1000 // ignore if fan wrote >12h ago
const SEEN_CHECK_INTERVAL = 5 * 60 * 1000
let lastSeenCheck = 0

async function runSeenAlertCheck(
  creator: { id: string; fanvueId: string; name: string },
  tokenRef: { current: string },
  refreshToken: string | null
) {
  const now = Date.now()
  let page = 1

  while (page <= 3) {
    let chatsData
    try {
      chatsData = await apiFetchWithRefresh(
        creator.id, tokenRef.current, refreshToken,
        `/chats?page=${page}&size=50&sortBy=most_recent_messages`, tokenRef
      ) as { data?: unknown[]; pagination?: { hasMore?: boolean } }
    } catch { break }

    const chats = (chatsData?.data ?? []) as Array<{
      user?: { uuid?: string; displayName?: string; handle?: string }
      lastMessageAt?: string
      lastMessage?: { sentByUserId?: string | null; senderUuid?: string; text?: string; sentAt?: string }
    }>
    const hasMore = chatsData?.pagination?.hasMore ?? false
    page++

    for (const chat of chats) {
      const fanUuid = chat.user?.uuid
      if (!fanUuid) continue
      const lm = chat.lastMessage
      if (!lm?.sentAt) continue

      const lmAge = now - new Date(lm.sentAt).getTime()

      // Last message is from the FAN (not team member, not creator direct)
      const isFanMsg = lm.sentByUserId === null && lm.senderUuid !== creator.fanvueId

      if (isFanMsg && lmAge >= SEEN_THRESHOLD_MS && lmAge <= SEEN_MAX_AGE_MS) {
        // Fan waiting >30min â€” upsert seen alert (reset if fan wrote again)
        await prisma.seenAlert.upsert({
          where: { fanUuid_creatorId: { fanUuid, creatorId: creator.id } },
          update: {
            fanLastMsg: lm.text ?? null,
            fanLastMsgAt: new Date(lm.sentAt),
            resolvedAt: null,
            dismissed: false,
          },
          create: {
            fanUuid,
            fanName: chat.user?.displayName ?? chat.user?.handle ?? null,
            fanHandle: chat.user?.handle ?? null,
            fanLastMsg: lm.text ?? null,
            fanLastMsgAt: new Date(lm.sentAt),
            creatorId: creator.id,
          },
        })
      } else if (!isFanMsg) {
        // Chatter replied â€” resolve any open seen alert for this chat
        await prisma.seenAlert.updateMany({
          where: { fanUuid, creatorId: creator.id, resolvedAt: null, dismissed: false },
          data: { resolvedAt: new Date() },
        })
      }
    }

    if (!hasMore) break
  }
}

export async function GET(req: NextRequest) {
  const since = req.nextUrl.searchParams.get('since')
  let sinceDate = since ? new Date(since) : new Date(Date.now() - 60_000)
  const maxLookback = new Date(Date.now() - 3 * 60 * 1000)
  if (sinceDate < maxLookback) sinceDate = maxLookback

  const creators = await prisma.creator.findMany({
    where: { accessToken: { not: null } },
  })

  type NewMessage = {
    id: string; messageUuid: string; model: string; modelUsername: string | null
    chatter: string; chatterUsername: string | null; fan: string; content: string
    sentAt: string; hasMedia: boolean; replyTimeSeconds: number | null
  }
  type FanvueMsg = { uuid: string; sender?: { uuid?: string }; sentAt?: string; sentByUserId?: string | null; text?: string; hasMedia?: boolean }

  const perCreator = await Promise.all(creators.map(async (creator) => {
    const msgs: NewMessage[] = []
    const tokenRef = { current: creator.accessToken! }
    const refreshToken = creator.refreshToken ?? null

    let page = 1
    let hasMore = true
    while (hasMore && page <= 2) {
      let chatsData
      try {
        chatsData = await apiFetchWithRefresh(creator.id, tokenRef.current, refreshToken, `/chats?page=${page}&size=50&sortBy=most_recent_messages`, tokenRef)
      } catch { break }

      const chats = (chatsData as { data?: unknown[]; pagination?: { hasMore?: boolean } })?.data ?? []
      hasMore = (chatsData as { pagination?: { hasMore?: boolean } })?.pagination?.hasMore ?? false
      page++

      const activeChats = (chats as Array<{ lastMessageAt?: string; user?: { uuid?: string; displayName?: string; handle?: string } }>)
        .filter(c => c.lastMessageAt && new Date(c.lastMessageAt) >= sinceDate)

      await Promise.all(activeChats.map(async (chat) => {
        const fanUuid: string = chat.user?.uuid ?? ''
        if (!fanUuid) return

        let messagesData
        try {
          messagesData = await apiFetchWithRefresh(creator.id, tokenRef.current, refreshToken, `/chats/${fanUuid}/messages?size=20`, tokenRef)
        } catch { return }

        const messages = ((messagesData as { data?: FanvueMsg[] })?.data ?? []) as FanvueMsg[]

        for (const msg of messages) {
          if (msg.sender?.uuid !== creator.fanvueId) continue
          if (new Date(msg.sentAt ?? 0) <= sinceDate) continue
          if (!msg.sentByUserId) continue

          const existing = await prisma.message.findUnique({ where: { fanvueId: msg.uuid } })
          if (existing) continue

          const content: string = msg.text ?? ''
          const chatterFanvueId: string = msg.sentByUserId
          const msgTime = new Date(msg.sentAt ?? 0).getTime()

          let replyTimeSeconds: number | null = null
          for (const prev of messages) {
            const prevTime = new Date(prev.sentAt ?? 0).getTime()
            if (prevTime >= msgTime) continue
            if (prev.sender?.uuid === creator.fanvueId) continue
            replyTimeSeconds = Math.round((msgTime - prevTime) / 1000)
            break
          }

          let chatterName = `Chatter ${chatterFanvueId.slice(0, 8)}`
          let chatterUsername: string | null = null
          const existingChatter = await prisma.chatter.findUnique({ where: { fanvueId: chatterFanvueId } })
          if (existingChatter) {
            chatterName = existingChatter.name
            chatterUsername = existingChatter.username
          } else if (chatterNameCache[chatterFanvueId]) {
            chatterName = chatterNameCache[chatterFanvueId]
          } else {
            try {
              const profile = await apiFetchWithRefresh(creator.id, tokenRef.current, refreshToken, `/users/${chatterFanvueId}`, tokenRef) as { displayName?: string; handle?: string }
              chatterName = profile.displayName ?? profile.handle ?? chatterName
              chatterUsername = profile.handle ?? null
              chatterNameCache[chatterFanvueId] = chatterName
            } catch { /* keep default */ }
          }

          const chatterRecord = await prisma.chatter.upsert({
            where: { fanvueId: chatterFanvueId },
            update: { username: chatterUsername },
            create: { fanvueId: chatterFanvueId, name: chatterName, username: chatterUsername },
          })

          const savedMsg = await prisma.message.create({
            data: {
              fanvueId: msg.uuid, content,
              sentAt: new Date(msg.sentAt ?? Date.now()),
              chatterId: chatterRecord.id, creatorId: creator.id,
              fanUuid, fanName: chat.user?.displayName ?? chat.user?.handle ?? 'Fan',
              analysed: false, replyTimeSeconds,
            },
          })

          const contextMsgs = messages
            .filter(m => new Date(m.sentAt ?? 0).getTime() < msgTime)
            .slice(0, 8).reverse()
            .map(m => ({ role: (m.sender?.uuid === creator.fanvueId ? 'chatter' : 'fan') as 'chatter' | 'fan', text: m.text ?? '', sentAt: m.sentAt ?? '' }))
            .filter(m => m.text.trim().length > 0)

          analyzeMessage(content, contextMsgs, replyTimeSeconds).then(async (flags) => {
            for (const flag of flags) {
              await prisma.flag.create({ data: { messageId: savedMsg.id, type: flag.type, category: flag.category ?? 'spelling', severity: flag.severity, description: flag.description, suggestion: flag.suggestion } })
            }
            await prisma.message.update({ where: { id: savedMsg.id }, data: { analysed: true } })
          }).catch(() => {})

          msgs.push({
            id: savedMsg.id, messageUuid: msg.uuid,
            model: creator.name, modelUsername: creator.username,
            chatter: chatterName, chatterUsername,
            fan: chat.user?.displayName ?? chat.user?.handle ?? 'Fan',
            content, sentAt: msg.sentAt ?? new Date().toISOString(),
            hasMedia: msg.hasMedia ?? false, replyTimeSeconds,
          })
        }
      }))
    }
    return msgs
  }))

  const newMessages = perCreator.flat()

  // Run seen alert check every 5 minutes (fire-and-forget)
  if (Date.now() - lastSeenCheck > SEEN_CHECK_INTERVAL) {
    lastSeenCheck = Date.now()
    for (const creator of creators) {
      const tokenRef = { current: creator.accessToken! }
      runSeenAlertCheck(creator, tokenRef, creator.refreshToken ?? null).catch(() => {})
    }
  }

  return NextResponse.json({
    messages: newMessages,
    checkedAt: new Date().toISOString(),
    count: newMessages.length,
  })
}
