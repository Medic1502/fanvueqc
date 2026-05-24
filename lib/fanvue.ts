const FANVUE_BASE = 'https://api.fanvue.com'

export function fanvueHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'X-Fanvue-API-Version': '2025-06-26',
    'Content-Type': 'application/json',
  }
}

export async function fanvueFetch(token: string, path: string, options: RequestInit = {}) {
  const res = await fetch(`${FANVUE_BASE}${path}`, {
    ...options,
    headers: { ...fanvueHeaders(token), ...options.headers },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Fanvue API ${res.status}: ${text}`)
  }
  return res.json()
}

export async function getChats(token: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString()
  return fanvueFetch(token, `/chats${query ? `?${query}` : ''}`)
}

export async function getChatMessages(token: string, fanUuid: string, params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString()
  return fanvueFetch(token, `/chats/${fanUuid}/messages${query ? `?${query}` : ''}`)
}

export async function getMe(token: string) {
  return fanvueFetch(token, '/users/me')
}
