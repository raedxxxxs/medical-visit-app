// @ts-nocheck — runs in Deno on Supabase, not Node.
// Supabase Edge Function: summarize-chart
// קלט: מערך תמונות (base64) של תיק מטופל
// פלט: סיכום מובנה בעברית (Markdown) של תיק המטופל

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const MAX_OUTPUT_TOKENS = 4096
const MAX_IMAGES = 20
// Anthropic vision API caps base64 around 5MB per image. Reject earlier.
const MAX_BASE64_PER_IMAGE = 5_400_000 // ~4MB raw

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const CHART_PROMPT = `אתה עוזר רפואי לרופא משפחה. אתה מקבל תמונות של תיק רפואי של מטופל (סיכומי ביקור, מרשמים, תוצאות בדיקות, מכתבי שחרור וכו') ומפיק סיכום מובנה בעברית.

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

const HOSPITALIZATION_PROMPT = `אתה עוזר רפואי לרופא משפחה. אתה מקבל תמונות של מסמכי אשפוז של מטופל (מכתבי שחרור, סיכומי אשפוז, גליונות סיעוד, תרשימי ניטור, תוצאות בדיקות בזמן אשפוז, פרוטוקולי ניתוח וכו') ומפיק סיכום אשפוז מובנה בעברית — קצר, ממוקד, וברור לקריאה לפני הביקור הראשון של המטופל בקהילה.

חוקים מחייבים:
1. החזר טקסט בעברית בלבד, בפורמט Markdown.
2. אסור להמציא מידע — אם משהו לא ברור או חסר, ציין "לא צוין" / "לא ברור מהמסמכים".
3. שמות מטופלים: רק ראשי תיבות.
4. שמות תרופות באנגלית/לטינית עם מינון + תדירות (\`Metformin 850mg x2/day\`).
5. תאריכי אשפוז ושחרור — חובה אם מופיעים. פורמט \`YYYY-MM-DD\`.
6. הפרד בבירור בין: סיבת אשפוז → מהלך אשפוז → טיפול ניתן → המלצות בשחרור.
7. סיים במשפט: "סיכום זה הוא כלי עזר. ההחלטה הקלינית היא של הרופא."

מבנה הפלט המחייב:

# סיכום אשפוז

## פרטי המטופל
- ראשי תיבות: ...
- גיל / מין: ...
- בית חולים / מחלקה: ...

## פרטי האשפוז
- תאריך אשפוז: ...
- תאריך שחרור: ...
- משך אשפוז: ...
- אבחנה ראשית בשחרור: ...
- אבחנות משניות: ...

## סיבת האשפוז
פסקה קצרה — תלונה עיקרית, נסיבות הגעה (חדר מיון / הפניה / ישירות).

## מהלך האשפוז
תיאור כרונולוגי תמציתי של אירועים משמעותיים: סיבוכים, ניתוחים, פרוצדורות, החמרות, התייעצויות עם מומחים. נקודות-תמצית בלבד, בסדר זמן.

## בדיקות חשובות בזמן האשפוז
- מעבדה: ערכים חריגים בלבד, עם תאריך.
- הדמיה: ממצאים עיקריים בלבד.
- בדיקות נוספות (EKG, אקו, אנדוסקופיה וכו').

## טיפול שניתן באשפוז
תרופות עיקריות שניתנו (במיוחד אנטיביוטיקה, נוגדי קרישה, סטרואידים), פרוצדורות, ניתוחים.

## תרופות בשחרור
רשימה מלאה — שם + מינון + תדירות + משך טיפול אם זמני. **סמן בבירור: חדש / שינוי / המשכי**.

## המלצות בשחרור
- המלצות לטיפול: ...
- בדיקות מעקב מתוזמנות: ...
- הגבלות פעילות: ...
- תזונה / אורח חיים: ...

## דגלים אדומים / מה להזהיר את המטופל
2-4 נקודות שדורשות חזרה דחופה לחדר מיון או הפסקת תרופה.

## מעקב נדרש בקהילה
**זה החלק הכי חשוב לרופא המשפחה.** רשימת פעולות קונקרטיות:
- תרופות שהתחילו באשפוז ודורשות מעקב (טיטרציה, בדיקות מעבדה).
- בדיקות מעקב מתוזמנות (תאריכים אם צוינו).
- הפניות למומחים שטרם בוצעו.
- בעיות פתוחות שלא נפתרו באשפוז.

---

סיכום זה הוא כלי עזר. ההחלטה הקלינית היא של הרופא.`

type SummaryMode = 'chart' | 'hospitalization'

function getSystemPrompt(mode: SummaryMode): string {
  return mode === 'hospitalization' ? HOSPITALIZATION_PROMPT : CHART_PROMPT
}

function getUserInstruction(mode: SummaryMode): string {
  return mode === 'hospitalization'
    ? 'סכם את מסמכי האשפוז לפי המבנה שהוגדר ב-system prompt.'
    : 'סכם את תיק המטופל לפי המבנה שהוגדר ב-system prompt.'
}

interface SummarizeRequest {
  images: { base64: string; media_type: string }[]
  mode?: SummaryMode
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !supabaseAnonKey) {
      return json({ error: 'Server misconfigured' }, 500)
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData?.user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return json({ error: 'ANTHROPIC_API_KEY is not configured' }, 500)
    }

    const body = (await req.json()) as SummarizeRequest
    const { images } = body
    const mode: SummaryMode =
      body.mode === 'hospitalization' ? 'hospitalization' : 'chart'

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
      text: getUserInstruction(mode),
    })

    let anthropicRes: Response
    try {
      anthropicRes = await callAnthropicWithRetry({
        apiKey: anthropicKey,
        model: ANTHROPIC_MODEL,
        maxTokens: MAX_OUTPUT_TOKENS,
        system: getSystemPrompt(mode),
        content,
      })
    } catch (e) {
      const isAbort =
        (e instanceof Error && e.name === 'AbortError') ||
        (e instanceof DOMException && e.name === 'AbortError')
      if (isAbort) {
        console.error('Anthropic call timed out')
        return json(
          { error: 'הסיכום ארך זמן רב מדי. נסה עם פחות תמונות או תמונות קטנות יותר.' },
          504,
        )
      }
      throw e
    }

    let claudeData: any
    try {
      claudeData = await anthropicRes.json()
    } catch (parseErr) {
      console.error('Failed to parse Anthropic response', parseErr)
      return json({ error: 'תגובה לא תקינה מ-Claude' }, 502)
    }
    if (!anthropicRes.ok) {
      console.error('Claude API error', anthropicRes.status, claudeData)
      const status = anthropicRes.status === 429 ? 429 : 502
      const safeMsg =
        anthropicRes.status === 429
          ? 'יותר מדי בקשות, נסה שוב בעוד רגע'
          : 'שגיאה בשירות הסיכום'
      return json({ error: safeMsg }, status)
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
      mode,
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
  const MAX_ATTEMPTS = 2
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
      const isAbort =
        (e instanceof Error && e.name === 'AbortError') ||
        (e instanceof DOMException && e.name === 'AbortError')
      if (isAbort) throw e
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)))
        continue
      }
    }
  }
  throw lastErr ?? new Error('Anthropic call failed')
}
