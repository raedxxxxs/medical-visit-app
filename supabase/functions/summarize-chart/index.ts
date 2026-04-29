// @ts-nocheck — runs in Deno on Supabase, not Node.
// Supabase Edge Function: summarize-chart
// קלט: מערך תמונות (base64) של תיק מטופל
// פלט: סיכום מובנה בעברית (Markdown) של תיק המטופל

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { callAnthropic, AnthropicTimeoutError } from '../_shared/anthropic.ts'

// Hospitalization summaries use Opus 4.7 for stronger clinical reasoning
// across many pages of discharge papers; Sonnet for plain chart summaries
// (mostly transcription-shaped work).
//
// Note: extended thinking was tried with Opus + streaming + base64 images
// and consistently 502'd against Anthropic — removed for now. Opus alone
// without thinking is still significantly stronger than Sonnet here.
const MODEL_BY_MODE = {
  chart: 'claude-sonnet-4-6',
  hospitalization: 'claude-opus-4-7',
} as const
const MAX_OUTPUT_TOKENS_BY_MODE = {
  chart: 4096,
  hospitalization: 6144,
} as const
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

// Self-critique system prompt. Used in the second pass on hospitalization
// summaries: re-shows the source images plus the candidate summary, and asks
// Claude to either confirm it's faithful or return a corrected version.
// Returned via tool_use so we get a typed shape (verdict + revised_summary).
const CRITIQUE_PROMPT = `אתה מבקר רפואי. קיבלת תמונות מקור של מסמכי אשפוז ותיוטה ראשונית של סיכום אשפוז שיוצר על ידי מודל אחר.

המשימה שלך:
1. עבור על התמונות בקפידה.
2. השווה את הסיכום הראשוני לתמונות.
3. זהה: עובדות שגויות, פרטים שהומצאו ולא קיימים במקור, פרטים חשובים שנשמטו (במיוחד תרופות חדשות, שינויי מינון, בדיקות מעקב, דגלים אדומים).
4. החזר תוצאה דרך הכלי \`submit_review\`:
   - verdict="ok" אם הסיכום מדויק וכולל את כל המידע החשוב — אז revised_summary לא נדרש.
   - verdict="revised" אם יש בעיות — אז revised_summary חייב להכיל סיכום מתוקן ושלם (באותו מבנה Markdown של הסיכום המקורי), ו-corrections רשימה של הבעיות שמצאת.

חוקים: אל תמציא מידע. אם משהו לא ברור בתמונות, ציין במפורש "לא ברור מהמסמכים". שמור על אותו פורמט markdown של הסיכום המקורי.`

const REVIEW_TOOL = {
  name: 'submit_review',
  description: 'מחזיר את תוצאת בקרת האיכות על הסיכום.',
  input_schema: {
    type: 'object',
    required: ['verdict', 'corrections'],
    properties: {
      verdict: { type: 'string', enum: ['ok', 'revised'] },
      corrections: {
        type: 'array',
        items: { type: 'string' },
        description: 'רשימת בעיות שמצאת. ריק אם verdict=ok.',
      },
      revised_summary: {
        type: 'string',
        description: 'סיכום מתוקן באותו מבנה. נדרש רק כש-verdict=revised.',
      },
    },
  },
}

interface SummarizeRequest {
  images: { base64: string; media_type: string }[]
  mode?: SummaryMode
  /** When set, bypass first-pass summarization and run a critique against this draft instead. */
  critique_draft?: string
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

    // Critique branch: client passes a draft summary, we re-show the source
    // images and ask Claude to either confirm or correct it. Returns JSON
    // (non-streaming) — this is a verification step, not a generation step.
    if (typeof body.critique_draft === 'string' && body.critique_draft.trim()) {
      if (body.critique_draft.length > 50_000) {
        return json({ error: 'טקסט הסיכום ארוך מדי לבקרה' }, 400)
      }
      return await runCritique({
        anthropicKey,
        images,
        draft: body.critique_draft,
      })
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

    // Cache the (long, mode-specific) system prompt so subsequent summaries
    // in the same 5-minute window pay only a fraction of the input tokens.
    const systemBlocks = [
      {
        type: 'text' as const,
        text: getSystemPrompt(mode),
        cache_control: { type: 'ephemeral' as const },
      },
    ]

    let anthropicRes: Response
    try {
      anthropicRes = await callAnthropic({
        apiKey: anthropicKey,
        model: MODEL_BY_MODE[mode],
        maxTokens: MAX_OUTPUT_TOKENS_BY_MODE[mode],
        system: systemBlocks,
        content,
        timeoutMs: 120_000,
        stream: true,
      })
    } catch (e) {
      if (e instanceof AnthropicTimeoutError) {
        console.error('Anthropic call timed out')
        return json(
          { error: 'הסיכום ארך זמן רב מדי. נסה עם פחות תמונות או תמונות קטנות יותר.' },
          504,
        )
      }
      throw e
    }

    if (!anthropicRes.ok) {
      let errBody: any = null
      try {
        errBody = await anthropicRes.json()
      } catch {
        // ignore
      }
      console.error('Claude API error', anthropicRes.status, errBody)
      const status = anthropicRes.status === 429 ? 429 : 502
      // Surface Anthropic's actual error message so the client can show
      // something useful instead of a generic 502. The original message is
      // safe to expose — it's a developer/operational hint, not user data.
      return json(
        {
          error:
            anthropicRes.status === 429
              ? 'יותר מדי בקשות, נסה שוב בעוד רגע'
              : (errBody?.error?.message ?? 'שגיאה בשירות הסיכום'),
          anthropic_status: anthropicRes.status,
        },
        status,
      )
    }

    return new Response(anthropicRes.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        'x-accel-buffering': 'no',
      },
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

async function runCritique(args: {
  anthropicKey: string
  images: { base64: string; media_type: string }[]
  draft: string
}): Promise<Response> {
  const { anthropicKey, images, draft } = args
  const content: any[] = images.map((img) => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: img.media_type ?? 'image/jpeg',
      data: img.base64,
    },
  }))
  // Wrap the candidate summary in XML tags so injected directives can't
  // hijack the critique step (defense-in-depth — the draft was generated
  // from the same images but could have echoed adversarial OCR text).
  content.push({
    type: 'text',
    text: `<candidate_summary>\n${draft}\n</candidate_summary>\n\nבדוק את הסיכום למעלה מול תמונות המקור והחזר תשובה דרך submit_review.`,
  })

  let res: Response
  try {
    res = await callAnthropic({
      apiKey: anthropicKey,
      model: 'claude-opus-4-7',
      maxTokens: 6144,
      system: [
        {
          type: 'text' as const,
          text: CRITIQUE_PROMPT,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      content,
      timeoutMs: 120_000,
      tools: [REVIEW_TOOL],
      tool_choice: { type: 'tool', name: 'submit_review' },
    })
  } catch (e) {
    if (e instanceof AnthropicTimeoutError) {
      return json({ error: 'בקרת האיכות ארכה זמן רב מדי' }, 504)
    }
    throw e
  }

  let data: any
  try {
    data = await res.json()
  } catch {
    return json({ error: 'תגובה לא תקינה מ-Claude' }, 502)
  }
  if (!res.ok) {
    const status = res.status === 429 ? 429 : 502
    return json(
      {
        error:
          res.status === 429
            ? 'יותר מדי בקשות, נסה שוב בעוד רגע'
            : 'שגיאה בבקרת האיכות',
      },
      status,
    )
  }

  const blocks = (data.content ?? []) as Array<{
    type: string
    name?: string
    input?: any
  }>
  const tool = blocks.find(
    (b) => b.type === 'tool_use' && b.name === 'submit_review',
  )
  if (!tool?.input) {
    return json({ error: 'Claude לא החזיר בקרה מובנית' }, 502)
  }

  const verdict = tool.input.verdict === 'revised' ? 'revised' : 'ok'
  const corrections: string[] = Array.isArray(tool.input.corrections)
    ? tool.input.corrections.filter((c: unknown) => typeof c === 'string')
    : []
  const revised: string | null =
    typeof tool.input.revised_summary === 'string' && tool.input.revised_summary.trim()
      ? tool.input.revised_summary
      : null

  return json({
    critique: {
      verdict,
      corrections,
      revised_summary: verdict === 'revised' ? revised : null,
    },
    usage: data.usage,
    model: data.model,
  })
}

