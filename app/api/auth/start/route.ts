export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

function base64url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function GET(req: Request) {
  // PKCE: generate verifier + challenge
  const verifier = base64url(crypto.randomBytes(32))
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest())

  const reqUrl = new URL(req.url)
  const proto = req.headers.get('x-forwarded-proto') ?? reqUrl.protocol.replace(':', '')
  const host = req.headers.get('x-forwarded-host') ?? reqUrl.host
  const baseUrl = `${proto}://${host}`

  const params = new URLSearchParams({
    client_id: process.env.FANVUE_CLIENT_ID!,
    redirect_uri: `${baseUrl}/api/auth/callback`,
    response_type: 'code',
    scope: 'openid offline read:agency read:chat read:fan read:self',
    state: crypto.randomBytes(16).toString('hex'),
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'login',
    max_age: '0',
  })

  const authUrl = `https://auth.fanvue.com/oauth2/auth?${params}`

  // Store verifier in a cookie so callback can use it
  const res = NextResponse.redirect(authUrl)
  res.cookies.set('pkce_verifier', verifier, {
    httpOnly: true,
    maxAge: 300, // 5 min
    path: '/',
  })

  return res
}
