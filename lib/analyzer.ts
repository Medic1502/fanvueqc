import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export type FlagCategory = 'critical' | 'spelling' | 'quality'

export type FlagResult = {
  type: string
  category: FlagCategory
  severity: 'WARNING' | 'CRITICAL'
  description: string
  suggestion?: string
}

export type ContextMessage = {
  role: 'fan' | 'chatter'
  text: string
  sentAt: string
}

export async function analyzeMessage(
  content: string,
  context: ContextMessage[] = [],
  replyTimeSeconds: number | null = null
): Promise<FlagResult[]> {
  if (!content || content.trim().length < 3) return []

  const contextBlock = context.length > 0
    ? `CHAT HISTORY (oldest → newest, before the analyzed message):\n${
        context.map(m => `[${m.role === 'fan' ? 'FAN' : 'CHATTER'}]: ${m.text}`).join('\n')
      }\n\n`
    : ''

  const replyTimeBlock = replyTimeSeconds !== null
    ? `Reply time: chatter took ${replyTimeSeconds < 60
        ? `${replyTimeSeconds} seconds`
        : `${Math.round(replyTimeSeconds / 60)} minutes`} to reply to the fan's last message.\n\n`
    : ''

  const prompt = `You are a QC system for a Fanvue fan engagement agency. Analyze the chatter's message in THREE independent categories. Return ONLY the flags that are genuine issues.

${contextBlock}${replyTimeBlock}CHATTER MESSAGE: "${content}"

---

CATEGORY 1 — CRITICAL ERRORS (severity: CRITICAL)
Flag ONLY these — nothing else qualifies as critical:
- POACHING: explicitly naming another platform to move the fan (Instagram, WhatsApp, Telegram, Snapchat, other sites). Vague "secret" or exclusive language is NOT poaching.
- TOS: requesting payment through external service (PayPal, crypto, bank). Platform sales tactics are NOT TOS violations.
- INSULT: directly insulting, threatening, or degrading the fan (calling names, cursing AT them).

CATEGORY 2 — SPELLING ERRORS (severity: WARNING)
Flag ONLY genuine misspellings where the correct word is obvious:
- SPELLING: word is clearly misspelled (e.g. "expirience"→"experience", "recieve"→"receive", "beutiful"→"beautiful")
- GRAMMAR: broken sentence structure that hurts comprehension (wrong verb tense in a confusing way, severely broken English). NOT: missing capitals, casual tone, slang, abbreviations, repeated letters (heyy, hiii), informal writing.

CATEGORY 3 — CHAT QUALITY (severity: WARNING)
This is the most important category. Evaluate the FULL conversation context, not just the message in isolation.

- DRY: Flag ONLY if the chatter's message is a single filler word/sound with zero substance — exactly things like: "ok", "okay", "mhm", "hmm", "hm", "yeah", "yh", "yep", "lol", "haha", "sure", "k". The message must add nothing at all. CRITICAL: if the message contains a "?" anywhere, it is automatically NOT dry — it has a question. If the message contains more than one word that isn't a filler, it is NOT dry. "Yes, and you?", "hey, what you up to", "sounds good babe", "aww really?" are NOT dry.

- SLOW_REPLY: Only flag if reply time is provided AND it's clearly excessive given context:
  * Over 20 minutes when fan sent a direct engaged message or question
  * Do NOT flag if fan sent a simple one-liner or if the conversation doesn't suggest urgency

Do NOT flag: sexual content, adult themes, flirting, explicit language, encouraging spending, fan financial complaints, casual English, slang, missing punctuation, missing capitals, abbreviations.

---

Respond ONLY with a JSON array. Each item must have:
- type: "POACHING" | "TOS" | "INSULT" | "SPELLING" | "GRAMMAR" | "DRY" | "SLOW_REPLY"
- category: "critical" | "spelling" | "quality"
- severity: "CRITICAL" (only for category critical) | "WARNING" (for spelling and quality)
- description: 1-2 sentences explaining the specific issue
- suggestion: optional improvement

Return [] if no genuine issues.`

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []
    return JSON.parse(jsonMatch[0]) as FlagResult[]
  } catch {
    return []
  }
}
