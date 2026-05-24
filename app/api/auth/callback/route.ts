export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function popupResult(success: boolean, message: string) {
  const color = success ? '#34d399' : '#f87171'
  const icon = success ? 'âœ…' : 'âŒ'
  const sub = success ? 'Ovaj prozor se zatvara...' : 'Zatvori prozor i pokuÅ¡aj ponovo.'
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:sans-serif;background:#0f0f11;color:#f1f1f3;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:12px;text-align:center;padding:24px}
.icon{font-size:48px}.msg{color:${color};font-size:15px}.sub{color:#71717a;font-size:13px}</style></head>
<body>
<div class="icon">${icon}</div>
<div class="msg">${message}</div>
<div class="sub">${sub}</div>
<script>if(window.opener){window.opener.location.reload();}${success ? 'setTimeout(()=>window.close(),1500);' : ''}</script>
</body></html>`
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return popupResult(false, `GreÅ¡ka: ${error ?? 'no_code'}`)
  }

  const verifier = req.cookies.get('pkce_verifier')?.value
  if (!verifier) {
    return popupResult(false, 'GreÅ¡ka: PKCE verifier nije pronaÄ‘en. PokuÅ¡aj ponovo.')
  }

  const credentials = Buffer.from(
    `${process.env.FANVUE_CLIENT_ID}:${process.env.FANVUE_CLIENT_SECRET}`
  ).toString('base64')

  const tokenRes = await fetch('https://auth.fanvue.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: (() => {
        const u = new URL(req.url)
        const proto = req.headers.get('x-forwarded-proto') ?? u.protocol.replace(':', '')
        const host = req.headers.get('x-forwarded-host') ?? u.host
        return `${proto}://${host}/api/auth/callback`
      })(),
      code_verifier: verifier,
    }),
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    return popupResult(false, `Token greÅ¡ka: ${tokenRes.status}. ${text.slice(0, 120)}`)
  }

  const tokenData = await tokenRes.json()
  const accessToken = tokenData.access_token
  const refreshToken = tokenData.refresh_token ?? null

  // Fetch profile of whoever just logged in
  const profileRes = await fetch('https://api.fanvue.com/users/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Fanvue-API-Version': '2025-06-26',
    },
  })

  if (!profileRes.ok) {
    return popupResult(false, 'Nije moguÄ‡e uÄitati profil. PokuÅ¡aj ponovo.')
  }

  const profile = await profileRes.json()
  const displayName = profile.displayName ?? profile.handle ?? 'Nepoznat'

  if (profile.isCreator) {
    await prisma.creator.upsert({
      where: { fanvueId: profile.uuid },
      update: { name: displayName, username: profile.handle, accessToken, refreshToken, connectedAt: new Date() },
      create: { fanvueId: profile.uuid, name: displayName, username: profile.handle, accessToken, refreshToken, connectedAt: new Date() },
    })
    return popupResult(true, `${displayName} je uspešno povezan!`)
  }

  // Not a creator account
  return popupResult(false, `"${displayName}" nije kreator nalog. Odjavi se sa Fanvue-a i prijavi se kao kreator čiji nalog hoćeš da dodaš.`)
  writeFileSync(envPath, envContent)

  return popupResult(true, `Admin nalog (${displayName}) je saÄuvan.`)
}
