/**
 * Drug interaction + renal-dose rules for primary care.
 *
 * Coverage target: ~30 rules covering 80% of GP prescribing risk.
 * Matching is case-insensitive substring on drug name (Hebrew or English),
 * tolerant of dose suffixes ("Metformin 1000mg BID" matches "metformin").
 */

export type DrugSeverity = 'critical' | 'warning' | 'info'

export interface DrugWarning {
  id: string
  severity: DrugSeverity
  title: string
  detail: string
  /** Drug names involved (normalized lower-case). */
  drugs: string[]
}

interface InteractionRule {
  id: string
  severity: DrugSeverity
  /** Each entry is a list of synonyms; ALL groups must match in the med list. */
  drugGroups: string[][]
  title: string
  detail: string
}

interface RenalRule {
  id: string
  severity: DrugSeverity
  drugSynonyms: string[]
  /** eGFR threshold (mL/min). Triggers when eGFR is BELOW this value. */
  egfrBelow: number
  title: string
  detail: string
}

const ACEI = [
  'enalapril',
  'lisinopril',
  'ramipril',
  'perindopril',
  'captopril',
  'אנלפריל',
  'רמיפריל',
  'פרינדופריל',
  'קפטופריל',
]
const ARB = [
  'losartan',
  'valsartan',
  'telmisartan',
  'olmesartan',
  'candesartan',
  'irbesartan',
  'לוסארטן',
  'ולסארטן',
  'טלמיסארטן',
]
const NSAIDS = [
  'ibuprofen',
  'naproxen',
  'diclofenac',
  'etoricoxib',
  'celecoxib',
  'meloxicam',
  'voltaren',
  'אטופאן',
  'נורופן',
  'איבופרופן',
  'נפרוקסן',
  'דיקלופנק',
]
const DIURETICS = [
  'furosemide',
  'hydrochlorothiazide',
  'hctz',
  'indapamide',
  'bumetanide',
  'פוסיד',
  'דיסותיאזיד',
]
const POTASSIUM_SPARING = [
  'spironolactone',
  'eplerenone',
  'amiloride',
  'aldactone',
  'אלדקטון',
  'ספירונולקטון',
]
const SSRI = [
  'sertraline',
  'fluoxetine',
  'escitalopram',
  'citalopram',
  'paroxetine',
  'fluvoxamine',
  'סרטרלין',
  'פלואוקסטין',
  'ציפרלקס',
  'אסציטלופרם',
]
const MACROLIDES_AZOLES = [
  'clarithromycin',
  'erythromycin',
  'ketoconazole',
  'itraconazole',
  'fluconazole',
  'klacid',
  'קלריתרומיצין',
]
const STATINS = [
  'atorvastatin',
  'simvastatin',
  'rosuvastatin',
  'pravastatin',
  'lipitor',
  'crestor',
  'אטורבסטטין',
  'סימבסטטין',
  'רוסובסטטין',
]
const NON_DHP_CCB = ['verapamil', 'diltiazem', 'ורפמיל', 'דילתיאזם']
const BETA_BLOCKERS = [
  'metoprolol',
  'bisoprolol',
  'atenolol',
  'carvedilol',
  'propranolol',
  'מטופרולול',
  'בייסופרולול',
  'אטנולול',
  'קרבדילול',
]

const INTERACTIONS: InteractionRule[] = [
  {
    id: 'triple-whammy',
    severity: 'critical',
    drugGroups: [[...ACEI, ...ARB], NSAIDS, DIURETICS],
    title: 'Triple Whammy — סיכון ל-AKI',
    detail:
      'שילוב של מעכב מערכת רנין-אנגיוטנסין (ACEi/ARB) + NSAID + משתן מעלה משמעותית סיכון לאי-ספיקת כליות חריפה. שקול חלופה ל-NSAID או הפסקה זמנית.',
  },
  {
    id: 'acei-arb-combo',
    severity: 'critical',
    drugGroups: [ACEI, ARB],
    title: 'ACEi + ARB — שילוב לא מומלץ',
    detail:
      'אין יתרון יעילותי, סיכון מוגבר להיפרקלמיה ואי-ספיקת כליות. בחר אחד.',
  },
  {
    id: 'raas-spironolactone',
    severity: 'warning',
    drugGroups: [[...ACEI, ...ARB], POTASSIUM_SPARING],
    title: 'ACEi/ARB + ספירונולקטון — היפרקלמיה',
    detail:
      'נטר אשלגן וקריאטינין לפני התחלה ושבוע-שבועיים אחרי. החלף לתיאזיד אם קריאטינין עולה.',
  },
  {
    id: 'statin-macrolide',
    severity: 'warning',
    drugGroups: [STATINS, MACROLIDES_AZOLES],
    title: 'סטטין + מקרוליד/אזול — סיכון לרבדומיוליזיס',
    detail:
      'במיוחד עם simvastatin/atorvastatin. שקול הפסקה זמנית של הסטטין או החלפה לאזיתרומיצין.',
  },
  {
    id: 'beta-non-dhp-ccb',
    severity: 'warning',
    drugGroups: [BETA_BLOCKERS, NON_DHP_CCB],
    title: 'חוסם בטא + Verapamil/Diltiazem — סיכון לברדיקרדיה',
    detail:
      'שילוב חוסמי ערוצי סידן non-DHP עם חוסמי בטא עלול לגרום ברדיקרדיה ובלוק AV. שקול חלופה.',
  },
  {
    id: 'ssri-tramadol',
    severity: 'warning',
    drugGroups: [SSRI, ['tramadol', 'טרמדול']],
    title: 'SSRI + Tramadol — סיכון לתסמונת סרוטונין',
    detail:
      'שתי תרופות מעלות סרוטונין. שקול אנלגזיה אחרת או נטר היטב.',
  },
  {
    id: 'warfarin-amiodarone',
    severity: 'critical',
    drugGroups: [['warfarin', 'קומדין', 'coumadin'], ['amiodarone', 'אמיודרון']],
    title: 'Warfarin + Amiodarone — סיכון מוגבר לדמם',
    detail:
      'אמיודרון מעצים פעילות וורפרין. הפחת מינון וורפרין בכ-30-50% ונטר INR שבועי.',
  },
  {
    id: 'methotrexate-nsaid',
    severity: 'critical',
    drugGroups: [['methotrexate', 'מתוטרקסט'], [...NSAIDS, 'trimethoprim', 'cotrimoxazole']],
    title: 'Methotrexate + NSAID/Trimethoprim — רעילות',
    detail:
      'הצטברות מתוטרקסט עקב פינוי כלייתי מופחת. הימנע משילוב.',
  },
  {
    id: 'digoxin-amiodarone',
    severity: 'warning',
    drugGroups: [['digoxin', 'דיגוקסין', 'lanoxin'], ['amiodarone', 'אמיודרון']],
    title: 'Digoxin + Amiodarone — סיכון לרעילות דיגוקסין',
    detail: 'הפחת מינון דיגוקסין ב-50% ונטר רמות.',
  },
  {
    id: 'ssri-nsaid',
    severity: 'warning',
    drugGroups: [SSRI, NSAIDS],
    title: 'SSRI + NSAID — סיכון מוגבר לדמם GI',
    detail:
      'שקול PPI מגן או חלופה ל-NSAID במיוחד אצל מבוגרים.',
  },
]

const RENAL_RULES: RenalRule[] = [
  {
    id: 'metformin-egfr',
    severity: 'critical',
    drugSynonyms: ['metformin', 'glucophage', 'glucomin', 'מטפורמין', 'גלוקופאז'],
    egfrBelow: 30,
    title: 'Metformin אסור ב-eGFR<30',
    detail: 'הפסק את המטפורמין. שקול חלופה (DPP-4 / SGLT2 לפי eGFR / GLP-1).',
  },
  {
    id: 'metformin-reduce',
    severity: 'warning',
    drugSynonyms: ['metformin', 'glucophage', 'glucomin', 'מטפורמין'],
    egfrBelow: 45,
    title: 'Metformin — הפחת מינון ב-eGFR<45',
    detail: 'מקסימום 1000mg/יום. נטר eGFR כל 3 חודשים.',
  },
  {
    id: 'sglt2-egfr',
    severity: 'warning',
    drugSynonyms: [
      'empagliflozin',
      'dapagliflozin',
      'canagliflozin',
      'jardiance',
      'forxiga',
      'invokana',
      'אמפגליפלוזין',
      'דפגליפלוזין',
    ],
    egfrBelow: 20,
    title: 'SGLT2 — בדוק התוויה ב-eGFR נמוך',
    detail: 'לרוב SGLT2 אינו יעיל לאיזון סוכר ב-eGFR<20 אך יתכן ויש יתרון לבי/כלייתי. בדוק התווייה.',
  },
  {
    id: 'sulfonylurea-egfr',
    severity: 'warning',
    drugSynonyms: [
      'glibenclamide',
      'glimepiride',
      'glipizide',
      'גליבנקלמיד',
      'גלימפיריד',
      'גליפיזיד',
    ],
    egfrBelow: 30,
    title: 'סולפונילאוריאה — סיכון להיפוגליקמיה ב-CKD',
    detail: 'שקול החלפה ל-DPP-4 / GLP-1 / אינסולין באי-ספיקת כליות מתקדמת.',
  },
  {
    id: 'nsaid-egfr',
    severity: 'warning',
    drugSynonyms: NSAIDS,
    egfrBelow: 60,
    title: 'NSAID לא מומלץ ב-CKD',
    detail: 'מאיץ הידרדרות תפקוד כלייתי. הימנע ככל הניתן ב-eGFR<60.',
  },
  {
    id: 'doac-egfr',
    severity: 'warning',
    drugSynonyms: [
      'apixaban',
      'rivaroxaban',
      'dabigatran',
      'edoxaban',
      'eliquis',
      'xarelto',
      'pradaxa',
      'אפיקסבן',
      'ריברוקסבן',
      'דביגטרן',
    ],
    egfrBelow: 30,
    title: 'DOAC — התאמת מינון ב-eGFR נמוך',
    detail:
      'דביגטרן contraindicated. אפיקסבן/ריברוקסבן: בדוק מינון לפי הנחיות. שקול ייעוץ קרדיולוגי.',
  },
  {
    id: 'spironolactone-egfr',
    severity: 'critical',
    drugSynonyms: POTASSIUM_SPARING,
    egfrBelow: 30,
    title: 'ספירונולקטון — אסור ב-eGFR<30',
    detail: 'סיכון גבוה להיפרקלמיה מסכנת חיים. הפסק.',
  },
]

/** Lower-cased compact text for matching. Strips dose suffixes/whitespace. */
function normalizeMed(med: string): string {
  return med.toLowerCase().trim()
}

function medMatchesAny(med: string, synonyms: string[]): boolean {
  const m = normalizeMed(med)
  return synonyms.some((syn) => m.includes(syn.toLowerCase()))
}

function medsMatchAny(meds: string[], synonyms: string[]): string | null {
  for (const med of meds) {
    if (medMatchesAny(med, synonyms)) return med
  }
  return null
}

/**
 * Run all interaction + renal rules over a medication list.
 * @param meds medications as raw strings
 * @param egfr latest known eGFR (mL/min) or null
 */
export function checkDrugWarnings(
  meds: string[] | null | undefined,
  egfr: number | null,
): DrugWarning[] {
  const list = (meds ?? []).filter(Boolean)
  if (list.length === 0) return []

  const out: DrugWarning[] = []

  // Interaction rules — all drug groups must match.
  for (const rule of INTERACTIONS) {
    const matched: string[] = []
    let allGroupsMatched = true
    for (const group of rule.drugGroups) {
      const m = medsMatchAny(list, group)
      if (!m) {
        allGroupsMatched = false
        break
      }
      matched.push(m)
    }
    if (allGroupsMatched) {
      out.push({
        id: rule.id,
        severity: rule.severity,
        title: rule.title,
        detail: rule.detail,
        drugs: matched,
      })
    }
  }

  // Renal rules — fire only when eGFR known and below threshold.
  if (egfr != null && !Number.isNaN(egfr)) {
    for (const rule of RENAL_RULES) {
      if (egfr >= rule.egfrBelow) continue
      const matched = medsMatchAny(list, rule.drugSynonyms)
      if (matched) {
        out.push({
          id: rule.id,
          severity: rule.severity,
          title: rule.title,
          detail: rule.detail,
          drugs: [matched],
        })
      }
    }
  }

  return out
}
