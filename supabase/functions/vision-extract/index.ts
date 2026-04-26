// @ts-nocheck — runs in Deno on Supabase, not Node.
// Supabase Edge Function: vision-extract
// קלט: תמונה ב-base64 + mode ('labs' | 'medications')
// פלט: JSON עם הערכים שזוהו (ללא שמירה ל-DB / Storage)

const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const MAX_OUTPUT_TOKENS = 1024

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const LABS_PROMPT = `אתה מערכת חילוץ ערכים רפואיים מתמונת בדיקת מעבדה או מסמך רפואי.
חלץ ערכים שנמצאים בתמונה. כל ערך = מספר בלבד (ללא יחידות).

מפתחות אפשריים:
- hba1c (%)
- glucose (mg/dL)
- ldl, hdl, total_cholesterol, triglycerides (mg/dL)
- creatinine (mg/dL)
- egfr (mL/min)
- microalbumin (mg/g)
- tsh (mIU/L)
- b12 (pg/mL)
- vitamin_d (ng/mL)
- systolic_bp, diastolic_bp (mmHg)
- pulse (bpm)
- weight (kg)
- height (cm)
- bmi (kg/m²)

החזר JSON תקני בלבד (ללא markdown, ללא טקסט נוסף):
{
  "values": { "hba1c": 7.8, "ldl": 115 },
  "test_date": "YYYY-MM-DD" או null,
  "warnings": ["..." או []]
}

חוקים:
- אם ערך לא נמצא — אל תכלול אותו במפתחות.
- אם תאריך לא ברור — null.
- אסור טקסט מחוץ ל-JSON.`

const MEDS_PROMPT = `אתה מערכת זיהוי תרופות מתמונה (תמונה של חבילות תרופות, מרשם, רשימת תרופות).
זהה את שמות התרופות, **המינון, והתדירות**.

החזר JSON תקני בלבד (ללא markdown, ללא טקסט נוסף):
{
  "medications": ["Metformin 850mg x2/day", "Atorvastatin 40mg HS", ...],
  "warnings": ["..." או []]
}

פורמט מחייב לכל פריט: \`<שם תרופה> <מינון> <תדירות>\`
דוגמאות:
- "Metformin 850mg x2/day" (כפולה ביום)
- "Atorvastatin 40mg HS" (פעם בלילה)
- "Empagliflozin 10mg x1/day"
- "Aspirin 100mg x1/day"
- "Lisinopril 10mg x1/day morning"

חוקים:
- שמות תרופות באנגלית/לטינית כפי שמופיעים בתמונה.
- מינון: 850mg / 40mg / 10mg / וכו'.
- תדירות בקיצורים מקובלים: x1/day, x2/day, x3/day, HS (לפני שינה), QD, BID, TID, PRN, או "morning"/"evening".
- אם תדירות לא מופיעה בתמונה — שים "(תדירות לא צוינה)".
- אם רק שם מסחרי — כלול אותו ("Glucophage 850mg x2/day").
- כל תרופה = פריט אחד במערך.
- אסור טקסט מחוץ ל-JSON.`

const PATIENT_PROMPT = `אתה מערכת חילוץ פרטי מטופל מתמונה רפואית (סיכום ביקור, מסמך מטופל, מרשם, וכו').
חלץ אך ורק את השדות הבאים אם הם נראים בתמונה:
1. ראשי תיבות של המטופל (לא שם מלא — רק אות ראשונה של שם פרטי + אות ראשונה של שם משפחה, לדוגמה "א.כ.")
2. גיל
3. מין
4. מחלות רקע (background conditions)
5. תרופות

החזר JSON תקני בלבד (ללא markdown, ללא טקסט נוסף):
{
  "initials": "א.כ." או null,
  "age": 65 או null,
  "gender": "male" או "female" או null,
  "conditions": ["diabetes", "hypertension", ...] או [],
  "medications": ["Metformin 850mg", "Atorvastatin 40mg", ...] או [],
  "warnings": []
}

ערכי gender אפשריים: "male" / "female" בלבד (אם זכר/גבר/M → "male"; אם נקבה/אישה/F → "female").

ערכי conditions חייבים להיות **מפתחות באנגלית** מהרשימה הסגורה הבאה (כל אחר — אל תכלול):
- diabetes — סוכרת / DM
- hypertension — יתר לחץ דם / יל"ד / HTN
- lipids — דיסליפידמיה / שומנים / היפרליפידמיה
- cad — מחלת לב כלילית / IHD / CAD
- ckd — אי ספיקת כליות / CKD
- copd — COPD / מחלת ריאות חסימתית
- asthma — אסטמה
- thyroid — בלוטת התריס / היפותירואיד / היפרתירואיד

חוקים מחייבים:
- אם שדה לא נראה בתמונה — החזר null (או [] לרשימות).
- שם מלא **אסור**: רק ראשי תיבות.
- conditions חייב להיות מפתחות מהרשימה למעלה בלבד.
- medications: שם תרופה + מינון + תדירות בפורמט "Name 850mg x2/day" / "Name 40mg HS". אם תדירות לא צוינה — "(תדירות לא צוינה)".
- אסור טקסט מחוץ ל-JSON.`

interface ExtractRequest {
  image_base64: string
  media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  mode: 'labs' | 'medications' | 'patient'
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

    const body = (await req.json()) as ExtractRequest
    const { image_base64, media_type, mode } = body

    if (!image_base64) return json({ error: 'חסרה תמונה' }, 400)
    if (mode !== 'labs' && mode !== 'medications' && mode !== 'patient') {
      return json(
        { error: 'mode חייב להיות labs / medications / patient' },
        400,
      )
    }

    const systemPrompt =
      mode === 'labs'
        ? LABS_PROMPT
        : mode === 'patient'
          ? PATIENT_PROMPT
          : MEDS_PROMPT
    const instruction =
      mode === 'labs'
        ? 'חלץ ערכים והחזר JSON.'
        : mode === 'patient'
          ? 'חלץ את פרטי המטופל והחזר JSON.'
          : 'זהה תרופות והחזר JSON.'

    const anthropicRes = await callAnthropicWithRetry({
      apiKey: anthropicKey,
      model: ANTHROPIC_MODEL,
      maxTokens: MAX_OUTPUT_TOKENS,
      system: systemPrompt,
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: media_type ?? 'image/jpeg',
            data: image_base64,
          },
        },
        { type: 'text', text: instruction },
      ],
    })

    const claudeData = await anthropicRes.json()
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
    const rawText = responseBlocks
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('\n')
      .trim()

    const extracted = parseJsonFromResponse(rawText)

    return json({ extracted, raw: rawText, usage: claudeData.usage })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json({ error: message }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'content-type': 'application/json',
    },
  })
}

function parseJsonFromResponse(text: string): unknown {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  // Try direct parse first (handles arrays, objects, nested data)
  try {
    return JSON.parse(stripped)
  } catch {
    // Fallback: substring between first { and last }
    const start = stripped.indexOf('{')
    const end = stripped.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1))
      } catch {
        // ignore
      }
    }
    return { parse_error: true, raw_text: text }
  }
}

async function callAnthropicWithRetry(args: {
  apiKey: string
  model: string
  maxTokens: number
  system: string
  content: unknown[]
}): Promise<Response> {
  const TIMEOUT_MS = 60_000
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
          await new Promise((r) =>
            setTimeout(r, 1000 * 2 ** (attempt - 1)),
          )
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
