// @ts-nocheck — runs in Deno on Supabase, not Node. TS errors here are harmless.
// Supabase Edge Function: generate-visit (v4 — structured tool_use)
// קלט: נתוני מטופל + רשימת מזהי הנחיות
// פלט: JSON מובנה לפי VISIT_TEMPLATE_TOOL_SCHEMA. הלקוח מרנדר ל-markdown.
//
// Why tool_use replaced markdown+regex sanitizer:
// The old flow asked Claude to emit a fixed markdown skeleton, then a server
// regex stripped "בדיקה גופנית" sections and inline citations that leaked into
// the body. Tool use makes the structure unforgeable — there is no field for
// physical exam, and `sources` is the only place citations can land.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { callAnthropic, AnthropicTimeoutError } from '../_shared/anthropic.ts'

const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const MAX_OUTPUT_TOKENS = 4096
const MAX_TEXT_PER_GUIDELINE = 400_000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Kept in sync with src/lib/visit-template.ts → VISIT_TEMPLATE_TOOL_SCHEMA.
// Duplicated here because Deno edge functions don't share modules with the
// Vite client bundle.
const VISIT_TEMPLATE_TOOL = {
  name: 'submit_visit_template',
  description:
    'שולח שבלונת ביקור מובנית לרופא. **חובה לקרוא לפונקציה הזו** עם כל השדות הנדרשים.',
  input_schema: {
    type: 'object',
    required: [
      'reason_for_visit',
      'anamnesis',
      'labs',
      'assessment',
      'recommendations',
      'tests_ordered',
      'next_visit',
      'sources',
    ],
    properties: {
      reason_for_visit: { type: 'string' },
      anamnesis: { type: 'string' },
      labs: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'value'],
          properties: {
            name: { type: 'string' },
            value: { type: 'string' },
            flag: { type: 'string', enum: ['high', 'low'] },
          },
        },
      },
      assessment: {
        type: 'array',
        items: {
          type: 'object',
          required: ['body'],
          properties: {
            heading: { type: 'string' },
            body: { type: 'string' },
          },
        },
      },
      recommendations: {
        type: 'array',
        items: {
          type: 'object',
          required: ['items'],
          properties: {
            heading: { type: 'string' },
            items: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      tests_ordered: { type: 'array', items: { type: 'string' } },
      next_visit: { type: 'string' },
      sources: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'topic'],
          properties: {
            name: { type: 'string' },
            section: { type: 'string' },
            topic: { type: 'string' },
            quote: { type: 'string' },
          },
        },
      },
    },
  },
}

function getToneInstruction(tone: 'standard' | 'first_person' | 'educational'): string {
  if (tone === 'first_person') {
    return `**טון הכתיבה**: גוף ראשון — "בדקתי...", "אני ממליץ...", "ראיתי כי...". מקצועי עם טון אישי קליני.`
  }
  if (tone === 'educational') {
    return `**טון הכתיבה**: לימודי — הוסף הסבר קצר על הרציונל הקליני (פתופיזיולוגיה, יעד טיפולי, מנגנון). תמציתי.`
  }
  return `**טון הכתיבה**: מקצועי-קליני סטנדרטי, תמציתי, ניטרלי.`
}

function buildSystemPrompt(tone: 'standard' | 'first_person' | 'educational'): string {
  return `אתה עוזר רפואי לרופא משפחה. אתה מייצר שבלונת ביקור בעברית ומגיש אותה דרך הכלי \`submit_visit_template\`.

${getToneInstruction(tone)}

═══════════════════════════════════════════════════
חוקים מחייבים
═══════════════════════════════════════════════════

🚫 **חובה לקרוא תמיד ל-\`submit_visit_template\`** עם כל השדות הנדרשים. אל תכתוב טקסט חופשי במקום זה.

🚫 **אסור** לכלול שדה "בדיקה גופנית". הסכמה לא מכילה אותו — אל תנסה להכניס אותו ל-anamnesis או assessment.

🚫 **ציטוטים**: שדה \`sources\` הוא **המקום היחיד** למקורות וציטוטים. **אסור** ציטוטים, שמות הנחיות, "Section X", "ADA Standards", שמות מסמכים בתוך \`assessment\` או \`recommendations\` או \`anamnesis\`. אם תכתוב משהו כזה בגוף — הפלט פסול.

🚫 **שפה**: עברית בלבד בגוף. אנגלית מותרת רק ל: שמות תרופות, ערכים+יחידות, קיצורים מקובלים (HbA1c, LDL, eGFR, BMI, ACE-I, ARB, SGLT2).

═══════════════════════════════════════════════════
תוכן השדות
═══════════════════════════════════════════════════

**anamnesis**: פתח חובה במשפט אחד שמסכם את **רקע המטופל** — גיל, מין, מחלות רקע (גם מהשדה הרשמי וגם אלה שזוהו מתמונה/טקסט חופשי), תרופות עיקריות עם מינון.
דוגמה: "מטופל בן 65, סוכרת מסוג 2, יתר לחץ דם, היפרליפידמיה, מטופל ב-Metformin 850mg x2/day, Atorvastatin 40mg HS, Lisinopril 10mg x1/day."
לאחר משפט הרקע — תיאור התלונה הנוכחית והאנמנזה הממוקדת.

**labs**: כל ערך = entry. אם חריג, סמן \`flag\`: "high" או "low". בלי הסברים, בלי קונטקסט.

**assessment**:
- אם 3+ מצבים כרוניים — entry אחד **לכל מערכת/מחלה** עם \`heading\` ("סוכרת", "יתר לחץ דם", "שומנים", "כליות", וכו).
- אחרת — entry אחד עם \`heading\` ריק/לא מוגדר.
- התייחס למינון ולתדירות של כל תרופה רלוונטית, וקבע אם הטיפול הנוכחי מספק.

**recommendations**:
- אם 3+ מצבים כרוניים — קבוצה לכל heading, באותו סדר כמו assessment.
- אחרת — קבוצה אחת עם heading ריק.
- בכל המלצה לשינוי תרופה ציין מינון+תדירות חדשים. דוגמה: "התחלת Empagliflozin 10mg x1/day".

**sources**: שורה לכל מקור. \`name\` = שם ההנחיה, \`section\` = סעיף/עמוד (אופציונלי), \`topic\` = במה זה תומך, \`quote\` = ציטוט קצר (אופציונלי).

זכור: **קרא תמיד לכלי**. אל תחזור עם טקסט בלבד — זה לא קביל.`
}

interface GenerateRequest {
  patient_data: Record<string, unknown>
  visit_type: string
  visit_date: string
  guideline_ids: string[]
  patient_summary?: string
  tone?: 'standard' | 'first_person' | 'educational'
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
    if (patient_data && JSON.stringify(patient_data).length > 50_000) {
      return json({ error: 'נתוני מטופל גדולים מדי' }, 400)
    }
    if (body.patient_summary && body.patient_summary.length > 5_000) {
      return json({ error: 'תקציר מטופל ארוך מדי' }, 400)
    }

    const { data: guidelines, error: gErr } = await supabase
      .from('guidelines')
      .select('id, title, file_name, extracted_text')
      .eq('user_id', user.id)
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
    let totalChars = 0
    const TOTAL_BUDGET = 800_000
    for (const g of guidelines) {
      if (!g.extracted_text) continue
      let text = g.extracted_text as string
      if (text.length > MAX_TEXT_PER_GUIDELINE) {
        text =
          text.slice(0, MAX_TEXT_PER_GUIDELINE) +
          '\n\n[... קוצר בגלל אורך — חלק מהטקסט הושמט]'
      }
      const remaining = TOTAL_BUDGET - totalChars
      if (remaining <= 0) break
      if (text.length > remaining) {
        text =
          text.slice(0, remaining) +
          '\n\n[... קוצר עקב חריגה מתקציב הקלט הכולל]'
      }
      totalChars += text.length
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

    const tone = body.tone === 'first_person' || body.tone === 'educational'
      ? body.tone
      : 'standard'

    const systemBlocks = [
      {
        type: 'text' as const,
        text: buildSystemPrompt(tone),
        cache_control: { type: 'ephemeral' as const },
      },
    ]

    let anthropicRes: Response
    try {
      anthropicRes = await callAnthropic({
        apiKey: anthropicKey,
        model: ANTHROPIC_MODEL,
        maxTokens: MAX_OUTPUT_TOKENS,
        system: systemBlocks,
        content: [...blocks, { type: 'text', text: userText }],
        timeoutMs: 120_000,
        tools: [VISIT_TEMPLATE_TOOL],
        tool_choice: { type: 'tool', name: 'submit_visit_template' },
      })
    } catch (e) {
      if (e instanceof AnthropicTimeoutError) {
        console.error('Anthropic call timed out')
        return json(
          { error: 'יצירת השבלונה ארכה זמן רב מדי. נסה עם פחות הנחיות או הנחיות קצרות יותר.' },
          504,
        )
      }
      throw e
    }

    let claudeData: any
    try {
      claudeData = await anthropicRes.json()
    } catch (parseErr) {
      console.error('Failed to parse Anthropic response as JSON', parseErr)
      return json({ error: 'תגובה לא תקינה מ-Claude' }, 502)
    }
    if (!anthropicRes.ok) {
      console.error('Claude API error', anthropicRes.status, claudeData)
      const status = anthropicRes.status === 429 ? 429 : 502
      const safeMsg =
        anthropicRes.status === 429
          ? 'יותר מדי בקשות, נסה שוב בעוד רגע'
          : 'שגיאה בשירות יצירת הביקור'
      return json({ error: safeMsg }, status)
    }

    const responseBlocks = (claudeData.content ?? []) as Array<{
      type: string
      name?: string
      input?: unknown
    }>
    const toolBlock = responseBlocks.find(
      (b) => b.type === 'tool_use' && b.name === 'submit_visit_template',
    )
    if (!toolBlock || !toolBlock.input) {
      console.error('Claude did not call submit_visit_template', claudeData)
      return json(
        { error: 'Claude לא החזיר תגובה מובנית. נסה שוב.', stop_reason: claudeData.stop_reason },
        502,
      )
    }

    return json({
      template: toolBlock.input,
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
  if (patient_summary) {
    parts.push(`- מטופל: <patient_summary>${patient_summary}</patient_summary>`)
  }

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
    parts.push(`<free_text>${anamnesis.free_text}</free_text>`)
  }

  parts.push(
    `\nקרא ל-\`submit_visit_template\` עם השבלונה המלאה לפי הסכמה.`,
  )
  return parts.join('\n')
}
