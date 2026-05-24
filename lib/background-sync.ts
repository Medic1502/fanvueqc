import { prisma } from './prisma'
import { analyzeMessage } from './analyzer'

const API_BASE = 'https://api.fanvue.com'
const AUTH_BASE = 'https://auth.fanvue.com'

const chatterNameCache: Record<string, string> = {}
const SEEN_THRESHOLD_MS = 30 * 60 * 1000
const SEEN_MAX_AGE_MS = 12 * 60 * 60 * 1000
const SEEN_CHECK_INTERVAL = 5 * 60 * 1000
let lastSeenCheck = 0
let lastSyncTime = new Date(Date.now() - 60_000)

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
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${credentials}` },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  })
  if (!res.ok) return null
  const data = await res.json()
  const newAccess = data.access_token
  const newRefresh = data.refresh_token ?? refreshToken
  await prisma.creator.update({ where: { id: creatorId }, data: { accessToken: newAccess, refreshToken: newRefresh } })
  return newAccess
}

async function apiFetch(creatorId: string, token: string, refreshToken: string | null, path: string, tokenRef: { current: string }): Promise<unknown> {
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

async function runSeenCheck(creator: { id: string; fanvueId: string; name: string }, tokenRef: { current: string }, refreshToken: string | null) {
  const now = Date.now()
  let page = 1
  while (page <= 3) {
    let data: { data?: unknown[]; pagination?: { hasMore?: boolean } }
    try {
      data = await apiFetch(creator.id, tokenRef.current, refreshToken, `/chats?page=${page}&size=50&sortBy=most_recent_messages`, tokenRef) as typeof data
    } catch { break }
    const chats = (data?.data ?? []) as Array<{ user?: { uuid?: string; displayName?: string; handle?: string }; lastMessage?: { sentByUserId?: string | null; senderUuid?: string; text?: string; sentAt?: string } }>
    page++
    for (const chat of chats) {
      const fanUuid = chat.user?.uuid
      const lm = chat.lastMessage
      if (!fanUuid || !lm?.sentAt) continue
      const lmAge = now - new Date(lm.sentAt).getTime()
      const isFanMsg = lm.sentByUserId === null && lm.senderUuid !== creator.fanvueId
      if (isFanMsg && lmAge >= SEEN_THRESHOLD_MS && lmAge <= SEEN_MAX_AGE_MS) {
        await prisma.seenAlert.upsert({
          where: { fanUuid_creatorId: { fanUuid, creatorId: creator.id } },
          update: { fanLastMsg: lm.text ?? null, fanLastMsgAt: new Date(lm.sentAt), resolvedAt: null, dismissed: false },
          create: { fanUuid, fanName: chat.user?.displayName ?? chat.user?.handle ?? null, fanHandle: chat.user?.handle ?? null, fanLastMsg: lm.text ?? null, fanLastMsgAt: new Date(lm.sentAt), creatorId: creator.id },
        })
      } else if (!isFanMsg) {
        await prisma.seenAlert.updateMany({ where: { fanUuid, creatorId: creator.id, resolvedAt: null, dismissed: false }, data: { resolvedAt: new Date() } })
      }
    }
    if (!(data?.pagination?.hasMore)) break
  }
}

async function syncOnce() {
  const sinceDate = lastSyncTime
  lastSyncTime = new Date()

  const creators = await prisma.creator.findMany({ where: { accessToken: { not: null } } })

  for (const creator of creators) {
    const tokenRef = { current: creator.accessToken! }
    const refreshToken = creator.refreshToken ?? null

    let page = 1
    let hasMore = true
    while (hasMore && page <= 2) {
      let chatsData: { data?: unknown[]; pagination?: { hasMore?: boolean } }
      try {
        chatsData = await apiFetch(creator.id, tokenRef.current, refreshToken, `/chats?page=${page}&size=50&sortBy=most_recent_messages`, tokenRef) as typeof chatsData
      } catch { break }

      type Chat = { lastMessageAt?: string; user?: { uuid?: string; displayName?: string; handle?: string } }
      const chats = (chatsData?.data ?? []) as Chat[]
      hasMore = chatsData?.pagination?.hasMore ?? false
      page++

      for (const chat of chats) {
        if (!chat.lastMessageAt || new Date(chat.lastMessageAt) < sinceDate) continue
        const fanUuid = chat.user?.uuid ?? ''
        if (!fanUuid) continue

        type FanvueMsg = { uuid: string; sender?: { uuid?: string }; sentAt?: string; sentByUserId?: string | null; text?: string; hasMedia?: boolean }
        let msgs: FanvueMsg[]
        try {
          const d = await apiFetch(creator.id, tokenRef.current, refreshToken, `/chats/${fanUuid}/messages?size=20`, tokenRef) as { data?: FanvueMsg[] }
          msgs = d?.data ?? []
        } catch { continue }

        const candidateUuids = msgs.filter(m => m.sender?.uuid === creator.fanvueId && new Date(m.sentAt ?? 0) > sinceDate && m.sentByUserId).map(m => m.uuid)
        if (candidateUuids.length === 0) continue

        const alreadySaved = await prisma.message.findMany({ where: { fanvueId: { in: candidateUuids } }, select: { fanvueId: true } })
        const savedSet = new Set(alreadySaved.map(m => m.fanvueId))

        for (const msg of msgs) {
          if (msg.sender?.uuid !== creator.fanvueId) continue
          if (new Date(msg.sentAt ?? 0) <= sinceDate) continue
          if (!msg.sentByUserId) continue
          if (savedSet.has(msg.uuid)) continue

          const content = msg.text ?? ''
          const chatterFanvueId = msg.sentByUserId
          const msgTime = new Date(msg.sentAt ?? 0).getTime()

          let replyTimeSeconds: number | null = null
          const msgsDesc = [...msgs].sort((a, b) => new Date(b.sentAt ?? 0).getTime() - new Date(a.sentAt ?? 0).getTime())
          for (const prev of msgsDesc) {
            const prevTime = new Date(prev.sentAt ?? 0).getTime()
            if (prevTime >= msgTime || prev.sender?.uuid === creator.fanvueId) continue
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
              const profile = await apiFetch(creator.id, tokenRef.current, refreshToken, `/users/${chatterFanvueId}`, tokenRef) as { displayName?: string; handle?: string }
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
            data: { fanvueId: msg.uuid, content, sentAt: new Date(msg.sentAt ?? Date.now()), chatterId: chatterRecord.id, creatorId: creator.id, fanUuid, fanName: chat.user?.displayName ?? chat.user?.handle ?? 'Fan', analysed: false, replyTimeSeconds },
          })

          const contextMsgs = msgsDesc
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
        }
      }
    }
  }

  if (Date.now() - lastSeenCheck > SEEN_CHECK_INTERVAL) {
    lastSeenCheck = Date.now()
    for (const creator of creators) {
      const tokenRef = { current: creator.accessToken! }
      runSeenCheck(creator, tokenRef, creator.refreshToken ?? null).catch(() => {})
    }
  }
}

export function startBackgroundSync() {
  console.log('[sync] Background sync started')
  const loop = async () => {
    try {
      await syncOnce()
    } catch (e) {
      console.error('[sync] Error:', e)
    }
    setTimeout(loop, 10_000)
  }
  loop()
}
