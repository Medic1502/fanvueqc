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

- DRY: The chatter's overall engagement in this conversation window is low-effort. Flag ONLY if:
  * The message is extremely short AND adds nothing (e.g. "ok", "lol", "yeah") when the fan sent a substantive message
  * AND there's no sign of active engagement in the recent history
  * Do NOT flag if the chatter has been actively engaging and this is just a short reply in a back-and-forth

- ENGAGEMENT: ONLY flag if fan asked a CLEAR, SPECIFIC question (e.g. "Are you talking about X?", "What do you mean?", "Did you mean Y?") AND the chatter's response completely ignores that question with zero acknowledgment. Do NOT flag: open-ended chatter responses, casual redirects, different conversational direction, short or informal replies, chatter not addressing every point the fan made.

- SALES: ONLY flag if fan used an explicit refusal word — "no", "not interested", "I don't want", "stop", "leave me alone", "I already said no" — AND the chatter's VERY NEXT message pushes the same sale again. Do NOT flag: hesitation ("I don't know", "maybe", "I'll think about it", "not sure"), uncertainty, reluctance, fan asking questions about the offer, chatter continuing to engage or persuade after hesitation, any single sales mention, PPV mentions regardless of timing.

- SLOW_REPLY: Only flag if reply time is provided AND it's clearly excessive given context:
  * Over 20 minutes when fan sent a direct engaged message or question
  * Do NOT flag if fan sent a simple one-liner or if the conversation doesn't suggest urgency

Do NOT flag: sexual content, adult themes, flirting, explicit language, encouraging spending, fan financial complaints, casual English, slang, missing punctuation, missing capitals, abbreviations.

---

Respond ONLY with a JSON array. Each item must have:
- type: "POACHING" | "TOS" | "INSULT" | "SPELLING" | "GRAMMAR" | "DRY" | "ENGAGEMENT" | "SALES" | "SLOW_REPLY"
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
