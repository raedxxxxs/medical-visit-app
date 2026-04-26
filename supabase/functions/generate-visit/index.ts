// @ts-nocheck — runs in Deno on Supabase, not Node. TS errors here are harmless.
// Supabase Edge Function: generate-visit (v2 — extracted text)
// קלט: נתוני מטופל + רשימת מזהי הנחיות
// פלט: שבלונה רפואית מובנית בעברית, מבוססת על הטקסט החולץ מההנחיות

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const MAX_OUTPUT_TOKENS = 4096
const MAX_TEXT_PER_GUIDELINE = 400_000 // chars; safe upper bound

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM_PROMPT = `אתה עוזר רפואי לרופא משפחה. אתה מייצר שבלונת ביקור בעברית.

═══════════════════════════════════════════════════
חוקים אסורים מוחלטים — הפרת אחד מהם = פסילת כל הפלט
═══════════════════════════════════════════════════

🚫 חוק 1 — אסור בתכלית האיסור לכלול את הכותרת "בדיקה גופנית" או "Physical Examination" או כל וריאציה שלהן בכל מקום בפלט.
   הסעיף הזה מבוטל לחלוטין. אל תזכיר אותו. אל תרמוז עליו. דלג עליו לגמרי.

🚫 חוק 2 — אסור בתכלית האיסור לכלול ציטוטים מההנחיות בגוף השבלונה.
   זה כולל:
   - אסור ">  ציטוט הנחיה: ..."
   - אסור "*ADA Standards of Care...*"
   - אסור "Section X" / "עמוד X" באמצע טקסט
   - אסור ציטוט באנגלית באמצע פסקה
   - אסור שם של הנחיה (ADA / NICE / etc) בגוף

🚫 חוק 3 — אסור באנגלית בגוף, חוץ מ:
   - שמות תרופות (Metformin, Atorvastatin)
   - ערכים מספריים ויחידות (mg/dL, mmHg, %)
   - קיצורים רפואיים מקובלים (HbA1c, LDL, eGFR, BMI, ACE-I, ARB, SGLT2)

═══════════════════════════════════════════════════
מבנה הפלט המחייב — בדיוק כך, ללא תוספות
═══════════════════════════════════════════════════

## סיבת הגעה
טקסט קצר בעברית.

## אנמנזה ממוקדת
טקסט בעברית בלבד.

## ערכי מעבדה
טבלת ערכים או רשימה של מה שהוזן.

## הערכה
ניתוח קליני בעברית, ללא ציטוטים ובלי שמות הנחיות.
**חשוב**: בעת ניתוח טיפול קיים (במיוחד טיפול גליקמי, אנטי-יל"די, ושומנים) — התייחס במפורש למינון הנוכחי **ולתדירות** של כל תרופה רלוונטית, וקבע אם הם מספקים. לדוגמה: "Metformin 850mg x2/day — מינון תת-מקסימלי, יש מקום להעלאה ל-x3/day לפני הוספת תרופה נוספת".

## המלצות
המלצות ממוספרות בעברית. ניסוח קליני בלבד. ללא ציטוטים. ללא הפניות. ללא "Section". ללא "עמוד". ללא שם הנחיה.
הנמק את ההמלצה במילים קליניות ענייניות, לא בציטוט.
**בכל המלצה לשינוי טיפול** — ציין את המינון והתדירות החדשים בבירור (לדוגמה "העלאה ל-Metformin 1000mg x2/day" או "הוספת Empagliflozin 10mg x1/day").

## בדיקות שהוזמנו
רשימה.

## ביקור הבא
מועד מומלץ + מטרה.

## מחלות רקע
**אם** במידע על המטופל מופיע השדה "מחלות רקע" — רשום כאן את כל המצבים הכרוניים שהמטופל סובל מהם, אחד בשורה (bullet points). זה כולל גם את המחלות הסטנדרטיות (סוכרת, יל"ד וכו') וגם מצבים נוספים שהוזכרו במטופל (דיכאון, פיברומיאלגיה, אוסטאופורוזיס וכו').
אם אין מחלות רקע — כתוב "אין מצבים כרוניים מתועדים".

## מקורות
**רק כאן** מותר לכתוב שמות הנחיות וציטוטים. כל שורה בפורמט:
- [שם ההנחיה, מספר סעיף/עמוד] — נושא קצר: "ציטוט קצר באנגלית או עברית"

═══════════════════════════════════════════════════
סיום קבוע (תמיד בסוף, אחרי "מקורות"):
═══════════════════════════════════════════════════

ההמלצות הן כלי עזר. ההחלטה הקלינית היא של הרופא.

═══════════════════════════════════════════════════
דוגמת ניסוח נכון בסעיף "המלצות":
═══════════════════════════════════════════════════

✅ נכון: "1. התחלת SGLT2 Inhibitor (לדוג' Empagliflozin 10mg) בשל סוכרת + LDL מוגבר + סיכון קרדיווסקולרי."

❌ אסור: "1. התחלת SGLT2... > *ציטוט הנחיה:* '...' — *ADA Standards of Care 2026, Section 9*"

═══════════════════════════════════════════════════

זכור: אם תפר חוק 1 (תוסיף "בדיקה גופנית") או חוק 2 (תוסיף ציטוט בגוף) — הפלט נפסל.
החזר טקסט נקי בלבד, מוכן להעתקה למערכת קליקס.`

interface GenerateRequest {
  patient_data: Record<string, unknown>
  visit_type: string
  visit_date: string
  guideline_ids: string[]
  patient_summary?: string
}

interface TextBlock {
  type: 'text'
  text: string
  cache_control?: { type: 'ephemeral' }
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
    if (!authHeader) {
      return json({ error: 'Unauthorized: missing Authorization header' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

    if (!anthropicKey) {
      return json({ error: 'ANTHROPIC_API_KEY is not configured' }, 500)
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const body = (await req.json()) as GenerateRequest
    const { patient_data, visit_type, visit_date, guideline_ids } = body

    if (!Array.isArray(guideline_ids) || guideline_ids.length === 0) {
      return json({ error: 'יש לבחור לפחות הנחיה אחת' }, 400)
    }

    const { data: guidelines, error: gErr } = await supabase
      .from('guidelines')
      .select('id, title, file_name, extracted_text')
      .in('id', guideline_ids)

    if (gErr) return json({ error: gErr.message }, 500)
    if (!guidelines || guidelines.length === 0) {
      return json({ error: 'לא נמצאו הנחיות' }, 404)
    }

    const missingText = guidelines.filter((g) => !g.extracted_text)
    if (missingText.length === guidelines.length) {
      return json(
        {
          error:
            'אין טקסט חולץ באף אחת מההנחיות שנבחרו. לחץ על "חלץ טקסט" ליד ההנחיה במאגר.',
          missing: missingText.map((g) => g.title),
        },
        400,
      )
    }

    const blocks: TextBlock[] = []
    for (const g of guidelines) {
      if (!g.extracted_text) continue
      let text = g.extracted_text as string
      if (text.length > MAX_TEXT_PER_GUIDELINE) {
        text =
          text.slice(0, MAX_TEXT_PER_GUIDELINE) +
          '\n\n[... קוצר בגלל אורך — חלק מהטקסט הושמט]'
      }
      blocks.push({
        type: 'text',
        text: `# הנחיה: ${g.title}\n(שם קובץ: ${g.file_name})\n\n${text}`,
        cache_control: { type: 'ephemeral' },
      })
    }

    const userText = buildPatientPrompt({
      patient_data,
      visit_type,
      visit_date,
      patient_summary: body.patient_summary,
    })

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              ...blocks,
              { type: 'text', text: userText },
            ],
          },
        ],
      }),
    })

    const claudeData = await anthropicRes.json()
    if (!anthropicRes.ok) {
      return json(
        { error: 'Claude API error', details: claudeData },
        anthropicRes.status,
      )
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

    const text = sanitizeTemplate(rawText)

    return json({
      template: text,
      usage: claudeData.usage,
      model: claudeData.model,
      guidelines_used: guidelines.map((g) => ({
        id: g.id,
        title: g.title,
        text_chars: (g.extracted_text as string | null)?.length ?? 0,
      })),
      missing_text: missingText.map((g) => g.title),
    })
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

/**
 * Post-processor that enforces the structural rules regardless of model output:
 * 1. Removes "## בדיקה גופנית" section entirely (header + body until next ##).
 * 2. Strips inline citations from body sections (blockquotes with ציטוט/Section/ADA/etc),
 *    keeping them only in the ## מקורות section.
 */
function sanitizeTemplate(input: string): string {
  let text = input

  // 1. Remove "בדיקה גופנית" section (and any English variants), from its header
  // until the next "## " heading or end-of-text.
  const physExamPatterns = [
    /^[ \t]*##[ \t]*בדיקה[ \t]*גופנית[\s\S]*?(?=^[ \t]*##[ \t]|\Z)/gm,
    /^[ \t]*##[ \t]*Physical[ \t]*Examination[\s\S]*?(?=^[ \t]*##[ \t]|\Z)/gim,
    /^[ \t]*##[ \t]*בדיקה[ \t]*קלינית[\s\S]*?(?=^[ \t]*##[ \t]|\Z)/gm,
  ]
  for (const re of physExamPatterns) text = text.replace(re, '')

  // 2. Split into "body" and "מקורות" sections.
  const sourcesIdx = text.search(/^[ \t]*##[ \t]*מקורות/m)
  let body = sourcesIdx >= 0 ? text.slice(0, sourcesIdx) : text
  const sources = sourcesIdx >= 0 ? text.slice(sourcesIdx) : ''

  // 3. From the body only, remove inline citation lines.
  body = body
    .split('\n')
    .filter((line) => {
      const t = line.trim()
      // Markdown blockquote with citation marker
      if (/^>\s*\*{0,2}ציטוט/.test(t)) return false
      // Blockquote that mentions ADA / Standards of Care / Section X
      if (/^>/.test(t) && /(ADA|NICE|Standards of Care|Section\s*\d+)/i.test(t))
        return false
      return true
    })
    .join('\n')

  // 4. Also remove inline reference markers like " — *ADA Standards of Care 2026, Section 8*"
  body = body
    .replace(/[—–-]\s*\*+[^*\n]*?(ADA|NICE|Standards of Care|Section\s*\d+)[^*\n]*?\*+/g, '')
    .replace(/\(\s*(ADA|NICE)[^)]*\)/g, '')
    .replace(/\s*—\s*Section\s*\d+/g, '')

  // 5. Collapse extra blank lines.
  let result = (body + '\n' + sources).replace(/\n{3,}/g, '\n\n').trim()

  // 6. Ensure final disclaimer present.
  if (!/ההחלטה הקלינית היא של הרופא/.test(result)) {
    result += '\n\nההמלצות הן כלי עזר. ההחלטה הקלינית היא של הרופא.'
  }
  return result
}

function buildPatientPrompt(args: {
  patient_data: Record<string, unknown>
  visit_type: string
  visit_date: string
  patient_summary?: string
}): string {
  const { patient_data, visit_type, visit_date, patient_summary } = args
  const parts: string[] = []
  parts.push(`# נתוני הביקור`)
  parts.push(`- סוג ביקור: ${visit_type}`)
  parts.push(`- תאריך: ${visit_date}`)
  if (patient_summary) parts.push(`- מטופל: ${patient_summary}`)

  const labs = (patient_data.labs ?? {}) as Record<string, string>
  const vitals = (patient_data.vitals ?? {}) as Record<string, string>
  const anamnesis = (patient_data.anamnesis ?? {}) as {
    symptoms?: string[]
    free_text?: string
  }

  const vitalEntries = Object.entries(vitals).filter(([, v]) => v)
  if (vitalEntries.length > 0) {
    parts.push(`\n## מדידות`)
    for (const [k, v] of vitalEntries) parts.push(`- ${k}: ${v}`)
  }

  const labEntries = Object.entries(labs).filter(([, v]) => v)
  if (labEntries.length > 0) {
    parts.push(`\n## מעבדה`)
    for (const [k, v] of labEntries) parts.push(`- ${k}: ${v}`)
  }

  if ((anamnesis.symptoms ?? []).length > 0) {
    parts.push(`\n## סימפטומים מדווחים`)
    parts.push((anamnesis.symptoms ?? []).join(', '))
  }
  if (anamnesis.free_text) {
    parts.push(`\n## טקסט חופשי מהאנמנזה`)
    parts.push(anamnesis.free_text)
  }

  parts.push(
    `\nצור שבלונת ביקור מלאה לפי המבנה הנדרש, מבוססת על ההנחיות שצורפו וערכי המטופל לעיל.`,
  )
  return parts.join('\n')
}
