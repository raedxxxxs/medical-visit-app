// @ts-nocheck — runs in Deno on Supabase, not Node.
// Supabase Edge Function: summarize-chart
// קלט: מערך תמונות (base64) של תיק מטופל
// פלט: סיכום מובנה בעברית (Markdown) של תיק המטופל

const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const MAX_OUTPUT_TOKENS = 4096
const MAX_IMAGES = 20
const MAX_BASE64_PER_IMAGE = 14_000_000 // ~10MB raw

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM_PROMPT = `אתה עוזר רפואי לרופא משפחה. אתה מקבל תמונות של תיק רפואי של מטופל (סיכומי ביקור, מרשמים, תוצאות בדיקות, מכתבי שחרור וכו') ומפיק סיכום מובנה בעברית.

חוקים מחייבים:
1. החזר טקסט בעברית בלבד, בפורמט Markdown.
2. אסור להמציא מידע — אם משהו לא ברור או חסר, ציין "לא צוין" / "לא ברור מהמסמכים".
3. שמות מטופלים: רק ראשי תיבות (לדוגמה "א.כ.").
4. שמות תרופות באנגלית/לטינית כפי שמופיעים, עם מינון ותדירות בפורמט: \`Metformin 850mg x2/day\`, \`Atorvastatin 40mg HS\`.
5. בדיקות מעבדה: שורה אחת לכל בדיקה, פורמט \`שם: ערך [תאריך]\`. אם חריג, חץ ↑/↓ בסוף.
6. סדר לפי החשיבות הקלינית — דברים פעילים/חמורים קודם, רקע אחר כך.
7. סיים במשפט: "סיכום זה הוא כלי עזר. ההחלטה הקלינית היא של הרופא."

מבנה הפלט המחייב:

# סיכום תיק מטופל

## פרטים דמוגרפיים
- ראשי תיבות: ...
- גיל: ...
- מין: ...
- קופ"ח / רופא ראשי (אם צוין): ...

## אבחנות פעילות
רשימה ממוספרת של מחלות/מצבים כרוניים פעילים, בסדר חשיבות קלינית. ציין שנת אבחון אם ידוע.

## תרופות נוכחיות
רשימה: שם + מינון + תדירות. סדר לפי קטגוריה אם רלוונטי (אנטי-יל"ד, היפוגליקמיים, סטטינים, וכו').

## אלרגיות / רגישויות
רשימה. אם לא צוין — "לא צוין".

## בדיקות אחרונות (מעבדה / הדמיה)
רק ערכים בולטים, בסדר תאריכים יורד. כותרת לכל תאריך, ערכים מתחת.

## אשפוזים / ניתוחים
רשימה כרונולוגית, רק אירועים משמעותיים.

## הפניות / בדיקות בהמתנה
רשימה.

## נקודות חשובות לטיפול
2-5 נקודות מהותיות שרופא טיפול ראשוני צריך להיות מודע אליהן: בעיות פתוחות, צרכים לא מטופלים, סימני אזהרה, יעדים שלא הושגו.

---

ההמלצות הן כלי עזר. ההחלטה הקלינית היא של הרופא.`

interface SummarizeRequest {
  images: { base64: string; media_type: string }[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return json({ error: 'ANTHROPIC_API_KEY is not configured' }, 500)
    }

    const body = (await req.json()) as SummarizeRequest
    const { images } = body

    if (!Array.isArray(images) || images.length === 0) {
      return json({ error: 'יש לצרף לפחות תמונה אחת' }, 400)
    }
    if (images.length > MAX_IMAGES) {
      return json({ error: `מקסימום ${MAX_IMAGES} תמונות בבקשה אחת` }, 400)
    }
    for (const img of images) {
      if (!img?.base64) return json({ error: 'תמונה לא תקינה' }, 400)
      if (img.base64.length > MAX_BASE64_PER_IMAGE) {
        return json({ error: 'אחת התמונות גדולה מדי' }, 413)
      }
    }

    const content: any[] = images.map((img) => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.media_type ?? 'image/jpeg',
        data: img.base64,
      },
    }))
    content.push({
      type: 'text',
      text: 'סכם את תיק המטופל לפי המבנה שהוגדר ב-system prompt.',
    })

    const anthropicRes = await callAnthropicWithRetry({
      apiKey: anthropicKey,
      model: ANTHROPIC_MODEL,
      maxTokens: MAX_OUTPUT_TOKENS,
      system: SYSTEM_PROMPT,
      content,
    })

    let claudeData: any
    try {
      claudeData = await anthropicRes.json()
    } catch (parseErr) {
      console.error('Failed to parse Anthropic response', parseErr)
      return json({ error: 'תגובה לא תקינה מ-Claude' }, 502)
    }
    if (!anthropicRes.ok) {
      console.error('Claude API error', anthropicRes.status, claudeData)
      const safeMsg =
        (claudeData?.error?.message as string | undefined) ?? 'Claude API error'
      return json({ error: safeMsg }, anthropicRes.status)
    }

    const responseBlocks = (claudeData.content ?? []) as Array<{
      type: string
      text?: string
    }>
    const summary = responseBlocks
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('\n')
      .trim()

    return json({
      summary,
      usage: claudeData.usage,
      model: claudeData.model,
      images_processed: images.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json({ error: message }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

async function callAnthropicWithRetry(args: {
  apiKey: string
  model: string
  maxTokens: number
  system: string
  content: unknown[]
}): Promise<Response> {
  const TIMEOUT_MS = 90_000
  const MAX_ATTEMPTS = 3
  let lastErr: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'x-api-key': args.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: args.model,
          max_tokens: args.maxTokens,
          system: args.system,
          messages: [{ role: 'user', content: args.content }],
        }),
      })
      clearTimeout(timer)
      if (res.status === 429 || res.status >= 500) {
        if (attempt < MAX_ATTEMPTS) {
          const baseDelay = 1000 * 2 ** (attempt - 1)
          const retryAfterHeader = res.headers.get('retry-after')
          const retryAfterMs = retryAfterHeader
            ? parseInt(retryAfterHeader, 10) * 1000
            : 0
          const delay = Math.max(baseDelay, retryAfterMs || 0)
          await new Promise((r) => setTimeout(r, delay))
          continue
        }
      }
      return res
    } catch (e) {
      clearTimeout(timer)
      lastErr = e
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)))
        continue
      }
    }
  }
  throw lastErr ?? new Error('Anthropic call failed')
}
