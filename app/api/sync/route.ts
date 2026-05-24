import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analyzeMessage } from '@/lib/analyzer'

const API_BASE = 'https://api.fanvue.com'

function apiHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'X-Fanvue-API-Version': '2025-06-26',
  }
}

async function apiFetch(token: string, path: string) {
  const res = await fetch(`${API_BASE}${path}`, { headers: apiHeaders(token) })
  if (!res.ok) throw new Error(`${res.status} ${path}`)
  return res.json()
}

export async function POST() {
  const log = await prisma.syncLog.create({ data: {} })
  let totalFetched = 0

  try {
    const creators = await prisma.creator.findMany({
      where: { accessToken: { not: null } },
    })

    if (creators.length === 0) {
      await prisma.syncLog.update({
        where: { id: log.id },
        data: { finishedAt: new Date(), error: 'Nema povezanih kreatora. Dodaj na /setup.' },
      })
      return NextResponse.json({ ok: false, error: 'No connected creators' })
    }

    for (const creator of creators) {
      const token = creator.accessToken!
      let page = 1
      let hasMore = true

      while (hasMore) {
        let chatsData
        try {
          chatsData = await apiFetch(token, `/chats?page=${page}&size=50&sortBy=most_recent_messages`)
        } catch (e) {
          console.error(`Chats fetch failed for ${creator.name}:`, e)
          break
        }

        const chats = chatsData?.data ?? []
        hasMore = chatsData?.pagination?.hasMore ?? false
        page++

        for (const chat of chats) {
          const fanUuid: string = chat.user?.uuid
          if (!fanUuid) continue

          let messagesData
          try {
            messagesData = await apiFetch(token, `/chats/${fanUuid}/messages?size=50`)
          } catch {
            continue
          }

          const messages = messagesData?.data ?? []

          for (const msg of messages) {
            // Only process messages sent by the CREATOR side
            // sender.uuid === creator.fanvueId means the creator (or chatter) sent it
            if (msg.sender?.uuid !== creator.fanvueId) continue

            const existing = await prisma.message.findUnique({ where: { fanvueId: msg.uuid } })
            if (existing) continue

            const content: string = msg.text ?? ''
            if (!content.trim()) continue

            // sentByUserId = chatter UUID (if sent by team member), null = creator sent it directly
            const chatterFanvueId: string = msg.sentByUserId ?? creator.fanvueId
            const isTeamMember = !!msg.sentByUserId

            // Fetch chatter profile if we don't know their name yet
            let chatterName = isTeamMember ? `Chatter ${chatterFanvueId.slice(0, 8)}` : creator.name
            let chatterUsername: string | null = isTeamMember ? null : creator.username

            if (isTeamMember) {
              try {
                const profile = await apiFetch(token, `/users/${chatterFanvueId}`)
                chatterName = profile.displayName ?? profile.handle ?? chatterName
                chatterUsername = profile.handle ?? null
              } catch { /* keep default name */ }
            }

            const chatterRecord = await prisma.chatter.upsert({
              where: { fanvueId: chatterFanvueId },
              update: { name: chatterName, username: chatterUsername },
              create: { fanvueId: chatterFanvueId, name: chatterName, username: chatterUsername },
            })

            const savedMsg = await prisma.message.create({
              data: {
                fanvueId: msg.uuid,
                content,
                sentAt: new Date(msg.sentAt ?? Date.now()),
                chatterId: chatterRecord.id,
                creatorId: creator.id,
                fanUuid,
                fanName: chat.user?.displayName ?? chat.user?.handle,
              },
            })

            totalFetched++

            // Analyze with Claude
            try {
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
            } catch (e) {
              console.error('Analysis failed:', e)
            }
          }
        }
      }
    }

    await prisma.syncLog.update({
      where: { id: log.id },
      data: { finishedAt: new Date(), messagesFetched: totalFetched },
    })

    return NextResponse.json({ ok: true, messagesFetched: totalFetched })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { finishedAt: new Date(), error },
    })
    return NextResponse.json({ ok: false, error }, { status: 500 })
  }
}
