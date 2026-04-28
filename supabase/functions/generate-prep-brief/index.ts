// @ts-nocheck — runs in Deno on Supabase, not Node.
// Supabase Edge Function: generate-prep-brief
// Input: patient_id (+ optional reason)
// Output: structured pre-visit briefing JSON for the physician.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const MAX_OUTPUT_TOKENS = 2048

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PrepRequest {
  patient_id: string
  reason?: string
  visit_date?: string
}

interface PrepBriefData {
  why_visit: string
  story_so_far: string
  what_changed: string[]
  action_items: { text: string; category: 'lab' | 'screening' | 'med' | 'followup' | 'other' }[]
  discussion_points: string[]
  red_flags: string[]
}

const SYSTEM_PROMPT = `אתה עוזר רפואי לרופא משפחה. אתה כותב **תדריך הכנה** קצר לפני ביקור עם מטופל.

מטרת התדריך: לאפשר לרופא לסרוק 90 שניות לפני שהמטופל נכנס ולדעת:
- מי המטופל בקצרה
- מה השתנה מאז הביקור הקודם
- מה כדאי להעלות / לבדוק / לשאול בביקור הזה

═══════════════════════════════════════════════════
חוקים מוחלטים
═══════════════════════════════════════════════════

🚫 פלט תקף = JSON בלבד התואם לסכמה למטה. אסור טקסט לפני/אחרי. אסור Markdown code fences. אסור הסבר.

🚫 בעברית בלבד. שמות תרופות באנגלית כשרלוונטי. קיצורים מקובלים (HbA1c, LDL, eGFR, BMI, BP) באנגלית.

🚫 תמציתי. כל סעיף קצר. אסור פסקאות ארוכות. אם אין מספיק מידע — כתוב "אין נתונים מספקים" במפורש.

🚫 אסור להמציא נתונים שלא קיימים בקלט.

═══════════════════════════════════════════════════
סכמת JSON
═══════════════════════════════════════════════════

{
  "why_visit": "משפט אחד — סיבת הביקור הצפויה. אם המשתמש סיפק reason — השתמש בו. אחרת השלם מההיסטוריה.",
  "story_so_far": "פסקה של 2-3 משפטים — מי המטופל, מחלות עיקריות, תרופות עיקריות, מצב בקווים גדולים מהביקור האחרון.",
  "what_changed": [
    "נקודה קצרה אחת לכל שינוי משמעותי מאז הביקור הקודם.",
    "דוגמאות: מגמה ב-HbA1c, שינוי במשקל, תרופה שנוספה/הופסקה, מחלה חדשה, ערך מעבדה חורג חדש.",
    "אם זה הביקור הראשון — מערך אחד: 'ביקור ראשון במערכת'."
  ],
  "action_items": [
    { "text": "פעולה קצרה ומדויקת", "category": "lab|screening|med|followup|other" }
  ],
  "discussion_points": [
    "3-5 נקודות קצרות שכדאי להעלות בביקור.",
    "כל נקודה ניסוח של דבר אחד שהרופא רוצה לחקור או להציע.",
    "דוגמאות: 'לבדוק היענות ל-Metformin', 'לדון בהוספת SGLT2', 'לשאול על תופעות לוואי של סטטין'."
  ],
  "red_flags": [
    "0-3 דברים שמחייבים תשומת לב מיוחדת. ריק אם אין.",
    "דוגמאות: 'BP במגמת עלייה ברורה — שקול הידוק טיפול', 'eGFR ירד מ-65 ל-52 ב-9 חודשים'."
  ]
}

═══════════════════════════════════════════════════
כללי תוכן
═══════════════════════════════════════════════════

- action_items הם דברים קונקרטיים שאפשר לסמן ✓ אחריהם. דוגמאות:
  - "להזמין HbA1c חדש (אחרון מלפני 5 חודשים)"
  - "לבדוק לחץ דם בישיבה ובעמידה"
  - "להזכיר חיסון שפעת"
  - "להעלות מינון Atorvastatin ל-40mg"
  - "לתאם זימון למיקרואלבומין"
- categories:
  - "lab" = הזמנת/בדיקת מעבדה
  - "screening" = סקירה/בדיקה תקופתית (קולונוסקופיה, ממוגרפיה, EKG)
  - "med" = שינוי טיפול תרופתי
  - "followup" = מעקב על נושא ספציפי
  - "other" = אחר
- discussion_points הם דברים שהרופא יזכיר בשיחה (לא בהכרח פעולות).
- אל תכתוב המלצות סטנדרטיות גנריות אם אין סיבה ספציפית — רק דברים שעולים מהמידע של המטופל הזה.`

Deno.serve(async (req: Request) => {
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

    const body = (await req.json()) as PrepRequest
    const { patient_id, reason, visit_date } = body
    if (!patient_id) return json({ error: 'patient_id is required' }, 400)

    const { data: patient, error: pErr } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patient_id)
      .eq('user_id', user.id)
      .single()
    if (pErr || !patient) return json({ error: 'Patient not found' }, 404)

    const { data: visitsRaw, error: vErr } = await supabase
      .from('visits')
      .select('id, visit_type, visit_date, patient_data, generated_template, created_at')
      .eq('patient_id', patient_id)
      .eq('user_id', user.id)
      .order('visit_date', { ascending: false })
      .limit(5)
    if (vErr) return json({ error: vErr.message }, 500)
    const visits = visitsRaw ?? []

    // Build a compact patient + history payload
    const patientLines: string[] = []
    patientLines.push(`קוד: ${patient.patient_code}`)
    if (patient.full_name) patientLines.push(`שם מלא: ${patient.full_name}`)
    if (patient.initials) patientLines.push(`ראשי תיבות: ${patient.initials}`)
    if (patient.age != null) patientLines.push(`גיל: ${patient.age}`)
    if (patient.gender) patientLines.push(`מין: ${patient.gender === 'male' ? 'זכר' : 'נקבה'}`)
    if (patient.conditions?.length)
      patientLines.push(`מחלות רקע: ${patient.conditions.join(', ')}`)
    if (patient.medications?.length)
      patientLines.push(`תרופות: ${patient.medications.join(', ')}`)
    if (patient.notes) patientLines.push(`הערות כלליות: ${patient.notes}`)

    const historyLines: string[] = []
    if (visits.length === 0) {
      historyLines.push('אין ביקורים קודמים במערכת.')
    } else {
      historyLines.push(`היסטוריית ${visits.length} ביקורים אחרונים:`)
      for (const v of visits) {
        const data = (v.patient_data as Record<string, unknown> | null) ?? null
        const labs = (data?.labs as Record<string, string> | undefined) ?? {}
        const vitals = (data?.vitals as Record<string, string> | undefined) ?? {}
        const labStr = Object.entries(labs)
          .filter(([, val]) => val)
          .map(([k, val]) => `${k}=${val}`)
          .join(', ')
        const vitalStr = Object.entries(vitals)
          .filter(([, val]) => val)
          .map(([k, val]) => `${k}=${val}`)
          .join(', ')
        historyLines.push(`---`)
        historyLines.push(`תאריך: ${v.visit_date} · סוג: ${v.visit_type}`)
        if (vitalStr) historyLines.push(`מדידות: ${vitalStr}`)
        if (labStr) historyLines.push(`מעבדה: ${labStr}`)
        const symptoms = (data?.anamnesis as { symptoms?: string[] } | undefined)
          ?.symptoms
        if (symptoms?.length) historyLines.push(`סימפטומים: ${symptoms.join(', ')}`)
        const freeText = (data?.anamnesis as { free_text?: string } | undefined)
          ?.free_text
        if (freeText) historyLines.push(`טקסט חופשי: ${freeText.slice(0, 500)}`)
        if (v.generated_template) {
          const planMatch = v.generated_template.match(/##\s*המלצות[\s\S]+?(?=##|$)/)
          if (planMatch)
            historyLines.push(
              `המלצות מהביקור: ${planMatch[0].replace(/##\s*המלצות/, '').trim().slice(0, 600)}`,
            )
        }
      }
    }

    const userPrompt = `# פרטי מטופל
${patientLines.join('\n')}

${reason ? `# סיבת הביקור הצפוי\n${reason}\n` : ''}
${visit_date ? `# תאריך הביקור הצפוי\n${visit_date}\n` : ''}
# היסטוריה
${historyLines.join('\n')}

החזר JSON תקף לפי הסכמה — בלבד.`

    const anthropicRes = await callAnthropicWithRetry({
      apiKey: anthropicKey,
      model: ANTHROPIC_MODEL,
      maxTokens: MAX_OUTPUT_TOKENS,
      system: SYSTEM_PROMPT,
      content: [{ type: 'text', text: userPrompt }],
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
      const status = anthropicRes.status === 429 ? 429 : 502
      const msg =
        anthropicRes.status === 429
          ? 'יותר מדי בקשות, נסה שוב בעוד רגע'
          : 'שגיאה בשירות יצירת התדריך'
      return json({ error: msg }, status)
    }

    const blocks = (claudeData.content ?? []) as Array<{ type: string; text?: string }>
    const rawText = blocks
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('\n')
      .trim()

    // Try to extract JSON — Claude sometimes wraps in fences despite instructions.
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return json({ error: 'לא התקבל JSON תקף מ-Claude', raw: rawText }, 502)
    }

    let parsed: PrepBriefData
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch (e) {
      console.error('JSON parse fail', e, jsonMatch[0])
      return json({ error: 'JSON לא תקין מ-Claude', raw: rawText }, 502)
    }

    // Defensive defaults
    const out: PrepBriefData = {
      why_visit: parsed.why_visit ?? '',
      story_so_far: parsed.story_so_far ?? '',
      what_changed: Array.isArray(parsed.what_changed) ? parsed.what_changed : [],
      action_items: Array.isArray(parsed.action_items)
        ? parsed.action_items.map((a) => ({
            text: a?.text ?? '',
            category: ['lab', 'screening', 'med', 'followup', 'other'].includes(a?.category)
              ? a.category
              : 'other',
          })).filter((a) => a.text)
        : [],
      discussion_points: Array.isArray(parsed.discussion_points)
        ? parsed.discussion_points.filter((s) => typeof s === 'string')
        : [],
      red_flags: Array.isArray(parsed.red_flags)
        ? parsed.red_flags.filter((s) => typeof s === 'string')
        : [],
    }

    return json({
      brief: out,
      usage: claudeData.usage,
      model: claudeData.model,
      visits_considered: visits.length,
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
  const TIMEOUT_MS = 30_000
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
          await new Promise((r) => setTimeout(r, 800 * attempt))
          continue
        }
      }
      return res
    } catch (err) {
      clearTimeout(timer)
      lastErr = err
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 800 * attempt))
        continue
      }
    }
  }
  throw lastErr ?? new Error('Anthropic call failed')
}
