import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  const expected = (process.env.APP_PASSWORD ?? '').trim()
  if (!expected) {
    return NextResponse.json({ error: 'APP_PASSWORD nije postavljen na serveru' }, { status: 500 })
  }
  if (password.trim() !== expected) {
    return NextResponse.json({ error: 'Pogrešna lozinka' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('app_auth', password, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
  })
  return res
}
