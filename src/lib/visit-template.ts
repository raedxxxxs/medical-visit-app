/**
 * Structured visit-template shape returned by the generate-visit edge function.
 *
 * Why structured: the previous text-only output relied on the model to follow a
 * markdown skeleton, which led to leaks (citations in body, "בדיקה גופנית"
 * sections appearing). With a JSON tool-use schema the structure is enforced
 * by the API — no field, no rendered section.
 */

export interface VisitLab {
  name: string
  value: string
  /** "high" → ↑, "low" → ↓, otherwise omitted. */
  flag?: 'high' | 'low' | null
}

export interface VisitSection {
  /** Empty/undefined heading = unified section (no sub-headers). */
  heading?: string | null
  body: string
}

export interface VisitRecommendationGroup {
  heading?: string | null
  items: string[]
}

export interface VisitSource {
  /** Guideline title or document name. */
  name: string
  section?: string
  topic: string
  quote?: string
}

export interface VisitTemplate {
  reason_for_visit: string
  anamnesis: string
  labs: VisitLab[]
  /** One entry = unified prose. Multiple = by-system breakdown (3+ chronic conditions). */
  assessment: VisitSection[]
  /** One group with no heading = unified list. Multiple groups = by-system. */
  recommendations: VisitRecommendationGroup[]
  tests_ordered: string[]
  next_visit: string
  sources: VisitSource[]
}

/** Used by the edge function's tool_use schema (kept in sync with this type). */
export const VISIT_TEMPLATE_TOOL_SCHEMA = {
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
    reason_for_visit: {
      type: 'string',
      description: 'משפט קצר — סיבת הביקור.',
    },
    anamnesis: {
      type: 'string',
      description:
        'פסקה ממוקדת בעברית. **חובה לפתוח במשפט סיכום של רקע המטופל** (גיל, מין, מחלות רקע, תרופות עיקריות עם מינון). לאחר מכן תיאור התלונה הנוכחית והאנמנזה. אסור לכלול בדיקה גופנית.',
    },
    labs: {
      type: 'array',
      description:
        'רשימת ערכי מעבדה במבנה מינימלי. אם הערך חריג ציין flag=high או flag=low.',
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
      description:
        'הערכה קלינית. אם המטופל סובל מ-3+ מצבים כרוניים — entry אחד לכל מערכת/מחלה עם heading (סוכרת, יתר לחץ דם, שומנים, וכו). אחרת — entry אחד עם heading ריק. אסור ציטוטים, אסור שמות הנחיות.',
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
      description:
        'המלצות ממוספרות. אם 3+ מצבים כרוניים — קבץ לפי heading זהה ל-assessment. אחרת — קבוצה אחת ללא heading. בכל המלצה לשינוי תרופה — ציין מינון+תדירות חדשים. אסור ציטוטים, אסור שמות הנחיות.',
      items: {
        type: 'object',
        required: ['items'],
        properties: {
          heading: { type: 'string' },
          items: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    tests_ordered: {
      type: 'array',
      description: 'בדיקות שהוזמנו בביקור.',
      items: { type: 'string' },
    },
    next_visit: {
      type: 'string',
      description: 'מועד ומטרת ביקור הבא, במשפט אחד.',
    },
    sources: {
      type: 'array',
      description:
        'מקורות ההמלצות — **רק כאן** מותר ציטוטים. שדה quote אופציונלי.',
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
} as const

/**
 * Render the structured template back to the markdown shape Step3Review and the
 * persisted `generated_template` string expect. This replaces the old regex
 * sanitizer entirely — there's no body-text to scrub because the schema has no
 * field for "physical exam" and citations only live in `sources`.
 */
export function renderVisitTemplate(t: VisitTemplate): string {
  const lines: string[] = []

  lines.push('## סיבת הגעה')
  lines.push(t.reason_for_visit?.trim() || '—')
  lines.push('')

  lines.push('## אנמנזה ממוקדת')
  lines.push(t.anamnesis?.trim() || '—')
  lines.push('')

  lines.push('## ערכי מעבדה')
  if (t.labs?.length) {
    for (const l of t.labs) {
      const arrow = l.flag === 'high' ? ' ↑' : l.flag === 'low' ? ' ↓' : ''
      lines.push(`${l.name}: ${l.value}${arrow}`)
    }
  } else {
    lines.push('—')
  }
  lines.push('')

  lines.push('## הערכה')
  for (const sec of t.assessment ?? []) {
    if (sec.heading?.trim()) lines.push(`### ${sec.heading.trim()}`)
    if (sec.body?.trim()) lines.push(sec.body.trim())
    lines.push('')
  }

  lines.push('## המלצות')
  let counter = 1
  for (const grp of t.recommendations ?? []) {
    if (grp.heading?.trim()) {
      lines.push(`### ${grp.heading.trim()}`)
      counter = 1
    }
    for (const item of grp.items ?? []) {
      const txt = item.trim()
      if (!txt) continue
      lines.push(`${counter}. ${txt}`)
      counter++
    }
    lines.push('')
  }

  if (t.tests_ordered?.length) {
    lines.push('## בדיקות שהוזמנו')
    for (const test of t.tests_ordered) {
      const trimmed = test.trim()
      if (trimmed) lines.push(`- ${trimmed}`)
    }
    lines.push('')
  }

  lines.push('## ביקור הבא')
  lines.push(t.next_visit?.trim() || '—')
  lines.push('')

  if (t.sources?.length) {
    lines.push('## מקורות')
    for (const s of t.sources) {
      const head = s.section ? `[${s.name}, ${s.section}]` : `[${s.name}]`
      const quote = s.quote ? ` — "${s.quote}"` : ''
      lines.push(`- ${head} — ${s.topic}${quote}`)
    }
    lines.push('')
  }

  lines.push('ההמלצות הן כלי עזר. ההחלטה הקלינית היא של הרופא.')

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
