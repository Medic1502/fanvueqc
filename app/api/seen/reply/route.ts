import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

const AUTH_BASE = 'https://auth.fanvue.com'
const TRPC_URL = 'https://www.fanvue.com/trpc/chat.sendSingleChatMessage'

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
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  })

  if (!res.ok) return null
  const data = await res.json()
  await prisma.creator.update({
    where: { id: creatorId },
    data: { accessToken: data.access_token, refreshToken: data.refresh_token ?? refreshToken },
  })
  return data.access_token
}

// tRPC SuperJSON payload — matches exactly what Fanvue web app sends
function buildTrpcPayload(recipientUuid: string, text: string) {
  return {
    json: {
      clientSentAt: new Date().toISOString(),
      clonedFromTemplateMessageUuid: null,
      mediaPreviewUuid: null,
      mediaUuids: null,
      price: null,
      recipientUuid,
      replyToMessageUuid: null,
      sendingMessageUuid: randomUUID(),
      text,
      textGenerationDiagnostic: null,
      meta: {
        values: {
          clientSentAt: ['Date'],
          clonedFromTemplateMessageUuid: ['undefined'],
          mediaPreviewUuid: ['undefined'],
          mediaUuids: ['undefined'],
          price: ['undefined'],
          replyToMessageUuid: ['undefined'],
          textGenerationDiagnostic: ['undefined'],
        },
      },
    },
  }
}

export async function POST(req: NextRequest) {
  const { alertId, message } = await req.json()

  if (!alertId || !message?.trim()) {
    return NextResponse.json({ error: 'Missing alertId or message' }, { status: 400 })
  }

  const alert = await prisma.seenAlert.findUnique({
    where: { id: alertId },
    include: { creator: true },
  })

  if (!alert) return NextResponse.json({ error: 'Alert nije pronađen u bazi' }, { status: 404 })

  const creator = alert.creator
  if (!creator.accessToken) return NextResponse.json({ error: 'Creator nema access token' }, { status: 400 })

  let token = creator.accessToken
  const text = message.trim()
  const payload = buildTrpcPayload(alert.fanUuid, text)

  const doSend = (t: string) => fetch(TRPC_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
      'X-Fanvue-API-Version': '2025-06-26',
    },
    body: JSON.stringify(payload),
  })

  let res = await doSend(token)

  // Token expired — refresh and retry
  if (res.status === 401 && creator.refreshToken) {
    const newToken = await refreshAccessToken(creator.id, creator.refreshToken)
    if (!newToken) return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 })
    token = newToken
    res = await doSend(newToken)
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    return NextResponse.json(
      { error: `Fanvue ${res.status}: ${errBody.slice(0, 300)}` },
      { status: res.status }
    )
  }

  // Message sent — resolve the seen alert
  await prisma.seenAlert.update({
    where: { id: alertId },
    data: { resolvedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
