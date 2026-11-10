'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/form-components';
import { AlertCircle, CheckCircle2, ClipboardList, Activity, Info, X, Pencil, User } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// SYMPTOM DEFINITIONS — shown when the user taps the ⓘ icon
// ─────────────────────────────────────────────────────────────────────────────
const SYMPTOM_DEFINITIONS: Record<string, { what: string; example: string }> = {
  // CVSQ Q1 — Visual complaints
  'Blurred vision': {
    what: 'Images or text appear out of focus or unclear, even when looking directly at them.',
    example: 'Words on your screen look fuzzy and sharpening your focus doesn\'t help.',
  },
  'Eye strain / fatigue': {
    what: 'A tired, sore, or aching feeling in or around the eyes after prolonged visual tasks.',
    example: 'Your eyes feel exhausted and heavy after a long study session.',
  },
  'Double vision / diplopia': {
    what: 'Seeing two overlapping images of the same object instead of one clear image.',
    example: 'A single word on the screen appears to split into two side-by-side copies.',
  },
  'Difficulty refocusing eyes': {
    what: 'Trouble quickly shifting focus between a nearby screen and a distant object (or vice versa).',
    example: 'After staring at your laptop, glancing across the room takes several seconds to come into focus.',
  },
  'Near vision discomfort / difficulty': {
    what: 'Discomfort or difficulty seeing clearly at close distances, such as reading on a screen.',
    example: 'Text at normal reading distance looks unclear or causes eye discomfort.',
  },
  'Unclear objects post-screen use': {
    what: 'Objects look temporarily blurry or hazy right after you stop looking at a screen.',
    example: 'After closing your laptop, distant objects look foggy for a few minutes.',
  },
  'Glare / seeing halos of light': {
    what: 'Bright rings or star-burst patterns appear around light sources.',
    example: 'Street lights or the screen backlight appear surrounded by a glowing halo.',
  },
  'Feeling of diminished vision': {
    what: 'A subjective sense that your eyesight is temporarily not as sharp as usual.',
    example: 'Everything looks slightly dim or less detailed than normal after screen use.',
  },
  'Increased sensitivity to light': {
    what: 'Normal indoor or outdoor light feels uncomfortably bright or causes squinting.',
    example: 'Walking outside after studying feels painfully bright even on a cloudy day.',
  },
  // CVSQ Q2 — Ocular surface complaints
  'Dry eyes': {
    what: 'A gritty, scratchy, or burning sensation caused by insufficient tear production or rapid tear evaporation.',
    example: 'Your eyes feel like sand is in them, especially after staring at a screen for hours.',
  },
  'Eye redness': {
    what: 'The white part of the eye appears pink or red due to irritated or dilated blood vessels.',
    example: 'Friends comment your eyes look red even though you feel fine.',
  },
  'Eye irritation / discomfort': {
    what: 'A general uncomfortable or bothersome feeling in the eye that is hard to pinpoint.',
    example: 'Your eyes just feel "off" — not painful, but persistently uncomfortable.',
  },
  'Foreign body sensation': {
    what: 'The feeling that something (like dust or an eyelash) is stuck in your eye, even when nothing is there.',
    example: 'You keep blinking and rubbing your eye trying to remove something that isn\'t there.',
  },
  'Burning / stinging sensation': {
    what: 'A sharp, painful, hot feeling on the surface of the eye.',
    example: 'Your eyes feel like they are stinging as if from smoke or chlorine.',
  },
  'Itching / eye rubbing': {
    what: 'An urge to rub or scratch the eyes due to an itchy feeling on the eyelid or eye surface.',
    example: 'You constantly rub your eyes during or after screen use even though they aren\'t watery.',
  },
  'Lacrimation / watery eye': {
    what: 'Excessive tearing or watering of the eyes, often a reflex response to dryness or irritation.',
    example: 'Your eyes water so much during reading that you have to wipe them repeatedly.',
  },
  'Eyelids feel heavy': {
    what: 'A drooping, weighted sensation in the eyelids that makes keeping them open feel like effort.',
    example: 'You struggle to keep your eyes open during an online lecture, not from sleepiness but from eye tiredness.',
  },
  'Frequent blinking': {
    what: 'Blinking much more often than normal, often as an involuntary response to eye dryness or irritation.',
    example: 'You notice yourself blinking rapidly every few seconds while reading.',
  },
  // CVSQ Q3 — Extraocular complaints
  'Headache': {
    what: 'Pain or pressure in the head, often around the temples, forehead, or back of the skull, triggered or worsened by screen use.',
    example: 'A dull throbbing starts at your temples after two hours of online classes.',
  },
  'Neck pain': {
    what: 'Stiffness, aching, or soreness in the neck muscles, often from holding the head in a fixed position while looking at a screen.',
    example: 'Your neck feels stiff and sore after a long study session at your desk.',
  },
  'Shoulder pain': {
    what: 'Tension, aching, or tightness in the shoulder muscles from prolonged poor posture during screen use.',
    example: 'Your shoulders feel knotted and raised up toward your ears after hours at the computer.',
  },
  'Back pain': {
    what: 'Discomfort or aching in the upper or lower back caused by sustained seated posture during screen activities.',
    example: 'Your lower back aches after a full day of online classes.',
  },
  'Joint pain in fingers and wrists': {
    what: 'Stiffness, soreness, or aching in the fingers or wrists from repetitive typing or scrolling.',
    example: 'Your wrists feel stiff and achy after a long typing or gaming session.',
  },
  'Inability to hold objects well': {
    what: 'A temporary weakness or loss of grip strength in the hands, sometimes after long periods of keyboard or touchscreen use.',
    example: 'After extended typing, your fingers feel weak and clumsy.',
  },
  'Difficulty writing using a pen': {
    what: 'Fine motor difficulty or hand fatigue that makes handwriting feel harder than usual after extended digital device use.',
    example: 'When switching from typing to writing by hand, your grip feels shaky or uncomfortable.',
  },
  'Sleep disturbances / insomnia': {
    what: 'Difficulty falling asleep, staying asleep, or feeling rested — often linked to blue-light exposure and mental stimulation from screens before bed.',
    example: 'You lie awake for an hour after late-night screen use even though you feel tired.',
  },
  'Inattention / depression': {
    what: 'Reduced ability to concentrate, feelings of mental fog, low mood, or low motivation — sometimes associated with excessive screen time and eye fatigue.',
    example: 'After a heavy day of screen use, you feel mentally exhausted, unmotivated, and unable to focus on anything.',
  },
  // CVS-Smart Q4 — Frequency of complaints
  // Anchored to the CVS-F4 Criterion 5 published in Iqbal et al. (2024):
  // "≥2 symptoms/attacks per month over the last 12 months" is the clinical
  // threshold for a positive CVS case.
  'Rare': {
    what: 'Your complaints occur less than twice a month — fewer than 2 episodes in any given 4-week period.',
    example: 'You noticed eye discomfort once last month and maybe once the month before. It does not happen on a regular basis.',
  },
  'Infrequent': {
    what: 'Your complaints occur at least twice a month but not on most days — roughly 2–8 episodes per month (about once or twice a week).',
    example: 'A couple of times each week after long screen sessions you get a headache or dry eyes, but not every day.',
  },
  'Frequent': {
    what: 'Your complaints happen most days — more than 8 episodes per month, meaning you experience symptoms on the majority of days you use a screen.',
    example: 'Almost every day after your online classes you experience eye strain, blurred vision, or a headache.',
  },
  // CVS-Smart Q5 — Screen association
  'Never (screen)': {
    what: 'Your complaints have no connection to screen use — they happen at random times regardless of devices.',
    example: 'You get headaches even on days you don\'t use screens at all.',
  },
  'Sometimes (screen)': {
    what: 'Your complaints appear during or after screen use on some occasions but not consistently every time.',
    example: 'After long study sessions you often feel eye strain, but short use doesn\'t trigger it.',
  },
  'Always (screen)': {
    what: 'Your complaints reliably start or worsen every time you use a screen, and improve when you stop.',
    example: 'Within an hour of using your laptop your eyes always start burning, and the burning fades after you stop.',
  },
  // Q19 symptom grid frequency scale
  'Never': {
    what: 'You did not experience this symptom at all in the past week (0 out of 7 days).',
    example: 'Zero days out of the past 7 days did you feel this.',
  },
  'Rarely': {
    what: 'You experienced this symptom on 1 day out of the past week — it happened briefly and mildly.',
    example: 'It happened once, briefly, and didn\'t bother you much.',
  },
  'Sometimes': {
    what: 'You experienced this symptom on 2–3 days out of the past week — noticeable but not a daily occurrence.',
    example: 'A couple of times during the week you noticed this symptom during or after screen use.',
  },
  'Often': {
    what: 'You experienced this symptom on 4–5 days out of the past week — present most days this week.',
    example: 'Most days this week you felt this symptom, especially during heavy screen sessions.',
  },
  'Always': {
    what: 'You experienced this symptom on 6–7 days out of the past week — present almost every day.',
    example: 'This symptom was present almost every time you used a screen this week.',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// INFO POPUP COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function InfoButton({ term }: { term: string }) {
  const [open, setOpen] = useState(false)
  const def = SYMPTOM_DEFINITIONS[term]
  if (!def) return null

  return (
    <span
      className="relative inline-flex items-center ml-1.5 flex-shrink-0"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v) }}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        aria-label={`What is ${term}?`}
        className="w-4 h-4 rounded-full flex items-center justify-center text-muted-foreground hover:text-[#f97316] transition-colors focus:outline-none focus:ring-1 focus:ring-[#f97316]"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {open && (
        <>
          <span
            className="fixed inset-0 z-40"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false) }}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            aria-hidden="true"
          />
          <span
            className="absolute left-0 top-6 z-50 w-72 rounded-xl border border-[#f97316]/25 bg-card shadow-xl p-4 text-left"
            role="tooltip"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <span className="flex items-start justify-between gap-2 mb-2">
              <span className="text-sm font-semibold text-[#f97316] leading-snug">{term}</span>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false) }}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                className="text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
            <span className="block text-xs text-foreground leading-relaxed mb-2">{def.what}</span>
            <span className="block text-xs text-muted-foreground leading-relaxed border-t border-border pt-2">
              <span className="font-medium text-foreground">Example: </span>{def.example}
            </span>
          </span>
        </>
      )}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** PART 1 — CVS-Smart Questionnaire (Iqbal et al., 2024) */
interface CvsqData {
  cvsq_visual: string[];
  cvsq_ocular: string[];
  cvsq_extraocular: string[];
  cvsq_frequency: string;
  cvsq_screen_associated: string;
}

/** PART 2 — EyeGuard Behavioral Survey */
interface SurveyData {
  age: string;
  gender: string;
  yearLevel: string;
  fieldOfStudy: string;
  firstName: string;
  lastName: string;
  academicScreenTime: string;
  nonAcademicScreenTime: string;
  primaryDevice: string;
  continuousScreenUse: string;
  onlineClassesPerDay: string;
  follows202020: string;
  blueLightFilter: string;
  screenBrightness: string;
  darkRoomUse: string;
  screenDistance: string;
  wearsGlasses: string;
  blueLightGlasses: string;
  breakFrequency: string;
  sleepHours: string;
  sym_dryEyes: string;
  sym_eyeItchiness: string;
  sym_blurredVision: string;
  sym_headaches: string;
  sym_eyeIrritation: string;
  sym_lightSensitivity: string;
  sym_difficultyFocusing: string;
  sym_neckShoulderPain: string;
  sym_mentalFatigue: string;
  sym_difficultyConcentrating: string;
  overallEyeStrain: string;
  digitalFatigueFrequency: string;
  primarySymptomHistory: string;
}

export interface FullFormData extends CvsqData, SurveyData {}

export interface ScreenTimeFormProps {
  onSubmit: (data: FullFormData) => Promise<void>;
  onProfileUpdate?: (profile: {
    firstName: string; lastName: string; age: string;
    gender: string; yearLevel: string; fieldOfStudy: string;
  }) => Promise<void>;
  email?: string;
  defaultValues?: Partial<SurveyData>;
  profileComplete?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const VISUAL_COMPLAINTS = [
  'Blurred vision', 'Eye strain / fatigue', 'Double vision / diplopia',
  'Difficulty refocusing eyes', 'Near vision discomfort / difficulty',
  'Unclear objects post-screen use', 'Glare / seeing halos of light',
  'Feeling of diminished vision', 'Increased sensitivity to light',
];
const OCULAR_SURFACE_COMPLAINTS = [
  'Dry eyes', 'Eye redness', 'Eye irritation / discomfort', 'Foreign body sensation',
  'Burning / stinging sensation', 'Itching / eye rubbing', 'Lacrimation / watery eye',
  'Eyelids feel heavy', 'Frequent blinking',
];
const EXTRAOCULAR_COMPLAINTS = [
  'Headache', 'Neck pain', 'Shoulder pain', 'Back pain',
  'Joint pain in fingers and wrists', 'Inability to hold objects well',
  'Difficulty writing using a pen', 'Sleep disturbances / insomnia', 'Inattention / depression',
];
const CVSQ_FREQUENCY_OPTIONS = ['Rare', 'Infrequent', 'Frequent'];
const CVSQ_SCREEN_ASSOC_OPTIONS = ['Never', 'Sometimes', 'Always'];

const AGE_OPTIONS = ['17-18', '19-20', '21-22', '23+'];
const GENDER_OPTIONS = ['Male', 'Female', 'Prefer not to say'];
const YEAR_LEVEL_OPTIONS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year or higher'];
const FIELD_OPTIONS = ['IT / Computer Science', 'Engineering', 'Business', 'Health Sciences', 'Education', 'Arts and Humanities', 'Other'];
const ACAD_SCREEN_OPTIONS = ['Less than 2 hours', '2–4 hours', '4–6 hours', '6–8 hours', 'More than 8 hours'];
const NON_ACAD_SCREEN_OPTIONS = ['Less than 1 hour', '1–3 hours', '3–5 hours', '5–7 hours', 'More than 7 hours'];
const DEVICE_OPTIONS = ['Smartphone', 'Laptop', 'Desktop Computer', 'Tablet'];
const CONTINUOUS_USE_OPTIONS = ['Less than 30 minutes', '30–60 minutes', '1–2 hours', '2–3 hours', 'More than 3 hours'];
const ONLINE_CLASSES_OPTIONS = ['None', '1–2', '3–4', '5 or more'];
const YESNO_FREQ_OPTIONS = ['Always', 'Sometimes', 'Rarely', 'Never'];
const BRIGHTNESS_OPTIONS = ['Low (0–25%)', 'Medium (26–50%)', 'Medium-High (51–75%)', 'High (76–100%)'];
const DISTANCE_OPTIONS = ['Less than 20 cm', '20–40 cm', '40–60 cm', 'More than 60 cm'];
const BREAK_FREQ_OPTIONS = ['Every 20 minutes', 'Every 30–60 minutes', 'Every 1–2 hours', 'Rarely take breaks'];
const SLEEP_OPTIONS = [
  { label: 'Less than 5 hours', value: '5' },
  { label: '5–6 hours', value: '5.5' },
  { label: '7–8 hours', value: '7.5' },
  { label: 'More than 8 hours', value: '9' },
];
const SYMPTOM_SCALE = ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'];
const SYMPTOM_GRID_ITEMS = [
  { key: 'sym_dryEyes',                label: 'Dry eyes' },
  { key: 'sym_eyeItchiness',           label: 'Eye itchiness' },
  { key: 'sym_blurredVision',          label: 'Blurred vision (near or far)' },
  { key: 'sym_headaches',              label: 'Headaches (especially around temples)' },
  { key: 'sym_eyeIrritation',          label: 'Eye irritation or burning sensation' },
  { key: 'sym_lightSensitivity',       label: 'Sensitivity to light (photophobia)' },
  { key: 'sym_difficultyFocusing',     label: 'Difficulty focusing on the screen' },
  { key: 'sym_neckShoulderPain',       label: 'Neck or shoulder pain' },
  { key: 'sym_mentalFatigue',          label: 'Feeling mentally tired after screen use' },
  { key: 'sym_difficultyConcentrating', label: 'Difficulty concentrating after long screen exposure' },
];
const OVERALL_STRAIN_OPTIONS = ['None', 'Mild', 'Moderate', 'Severe'];
const DIGITAL_FATIGUE_OPTIONS = ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'];
const PRIMARY_SYMPTOM_OPTIONS = ['No, none (or rarely)', 'Yes — Dry Eyes', 'Yes — Blurry Vision', 'Yes — Both Dry Eyes and Blurry Vision'];

// Total pages: 0-3 = CVSQ, 4-8 = EyeGuard Survey
const TOTAL_PAGES = 9;

function sleepHoursToOption(value?: string): string {
  if (!value) return '';
  const h = Number(value);
  if (h < 5.5) return '5';
  if (h <= 6.5) return '5.5';
  if (h <= 8) return '7.5';
  return '9';
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function PartBanner({ part, title, subtitle }: { part: string; title: string; subtitle: string; color?: string }) {
  return (
    <div className="rounded-xl p-5 border-2 bg-[#f97316]/8 dark:bg-[#f97316]/10 border-[#f97316]/30 dark:border-[#f97316]/25">
      <p className="text-xs font-bold uppercase tracking-widest mb-1 text-[#f97316]">{part}</p>
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}

function SectionHeader({ number, title }: { number: string | number; title: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold flex-shrink-0">{number}</div>
        <h3 className="text-base font-semibold text-foreground uppercase tracking-wide">{title}</h3>
      </div>
      <div className="h-0.5 w-12 bg-primary rounded-full ml-11" />
    </div>
  );
}

function FormField({ label, required, children, fieldId, hint }: {
  label: string; required?: boolean; children: React.ReactNode; fieldId?: string; hint?: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={fieldId} className="text-base font-semibold text-foreground block">
        {label}{required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
      </label>
      {hint && <p className="text-xs text-muted-foreground -mt-1">{hint}</p>}
      {children}
    </div>
  );
}

function RadioGroup({ name, options, value, onChange, fieldId, definitionKeys }: {
  name: string; options: string[]; value: string;
  onChange: (v: string) => void; fieldId?: string;
  definitionKeys?: Record<string, string>;
}) {
  return (
    <div id={fieldId} className="space-y-2">
      {options.map((opt) => (
        <label key={opt} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${value === opt ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}>
          <input type="radio" name={name} value={opt} checked={value === opt} onChange={(e) => onChange(e.target.value)} className="w-4 h-4 accent-primary" />
          <span className="flex items-center gap-0.5 text-sm text-foreground flex-1">
            <span>{opt}</span>
            {definitionKeys && definitionKeys[opt] && <InfoButton term={definitionKeys[opt]} />}
          </span>
        </label>
      ))}
    </div>
  );
}

function SelectField({ id, value, onChange, options, placeholder }: {
  id: string; value: string; onChange: (v: string) => void; options: string[]; placeholder: string;
}) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-2 rounded-lg border border-border bg-white dark:bg-[#1a1008] text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none cursor-pointer">
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function CheckboxGroup({ items, selected, onChange, showNoneOption = false }: {
  items: string[]; selected: string[]; onChange: (v: string[]) => void; showNoneOption?: boolean;
}) {
  const isNoneChecked = selected.includes('None') || selected.includes('None of the above');

  const toggle = (item: string) => {
    if (selected.includes(item)) {
      onChange(selected.filter((s) => s !== item));
    } else {
      // Remove any 'None' selection when checking a real symptom
      const cleaned = selected.filter((s) => s !== 'None' && s !== 'None of the above');
      onChange([...cleaned, item]);
    }
  };

  const toggleNone = () => {
    if (isNoneChecked) {
      onChange([]);
    } else {
      onChange(['None']);
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((item) => {
          const checked = selected.includes(item);
          return (
            <label key={item} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${checked ? 'border-[#f97316]/60 bg-[#f97316]/10 dark:bg-[#f97316]/15' : 'border-border hover:border-[#f97316]/30 hover:bg-[#f97316]/5'}`}>
              <input type="checkbox" checked={checked} onChange={() => toggle(item)} className="sr-only" />
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${checked ? 'bg-[#f97316] border-[#f97316]' : 'border-muted-foreground/40'}`}>
                {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" /></svg>}
              </div>
              <span className="flex items-center gap-0.5 text-sm text-foreground leading-snug flex-1 min-w-0">
                <span>{item}</span>
                <InfoButton term={item} />
              </span>
            </label>
          );
        })}
      </div>

      {showNoneOption && (
        <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isNoneChecked ? 'border-[#f97316]/60 bg-[#f97316]/10 dark:bg-[#f97316]/15' : 'border-border hover:border-[#f97316]/30 hover:bg-[#f97316]/5'}`}>
          <input type="checkbox" checked={isNoneChecked} onChange={toggleNone} className="sr-only" />
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${isNoneChecked ? 'bg-[#f97316] border-[#f97316]' : 'border-muted-foreground/40'}`}>
            {isNoneChecked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" /></svg>}
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-medium text-foreground leading-snug">
              None of the above
            </span>
            <span className="text-xs text-muted-foreground">
              I do not experience any of the conditions listed above
            </span>
          </div>
        </label>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FORM COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export function ScreenTimeForm({ onSubmit, onProfileUpdate, email, defaultValues, profileComplete = false }: ScreenTimeFormProps) {
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (page === TOTAL_PAGES - 1) {
      setCanSubmit(false);
      const timer = setTimeout(() => {
        setCanSubmit(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setCanSubmit(false);
    }
  }, [page]);

  const [cvsq, setCvsq] = useState<CvsqData>({
    cvsq_visual: [], cvsq_ocular: [], cvsq_extraocular: [],
    cvsq_frequency: '', cvsq_screen_associated: '',
  });

  const [survey, setSurvey] = useState<SurveyData>({
    age: defaultValues?.age || '',
    gender: defaultValues?.gender || '',
    yearLevel: defaultValues?.yearLevel || '',
    fieldOfStudy: defaultValues?.fieldOfStudy || '',
    firstName: defaultValues?.firstName || '',
    lastName: defaultValues?.lastName || '',
    academicScreenTime: defaultValues?.academicScreenTime || '',
    nonAcademicScreenTime: defaultValues?.nonAcademicScreenTime || '',
    primaryDevice: defaultValues?.primaryDevice || '',
    continuousScreenUse: defaultValues?.continuousScreenUse || '',
    onlineClassesPerDay: defaultValues?.onlineClassesPerDay || '',
    follows202020: defaultValues?.follows202020 || '',
    blueLightFilter: defaultValues?.blueLightFilter || '',
    screenBrightness: defaultValues?.screenBrightness || '',
    darkRoomUse: defaultValues?.darkRoomUse || '',
    screenDistance: defaultValues?.screenDistance || '',
    wearsGlasses: defaultValues?.wearsGlasses || '',
    blueLightGlasses: defaultValues?.blueLightGlasses || '',
    breakFrequency: defaultValues?.breakFrequency || '',
    sleepHours: sleepHoursToOption(defaultValues?.sleepHours),
    sym_dryEyes: defaultValues?.sym_dryEyes || '',
    sym_eyeItchiness: defaultValues?.sym_eyeItchiness || '',
    sym_blurredVision: defaultValues?.sym_blurredVision || '',
    sym_headaches: defaultValues?.sym_headaches || '',
    sym_eyeIrritation: defaultValues?.sym_eyeIrritation || '',
    sym_lightSensitivity: defaultValues?.sym_lightSensitivity || '',
    sym_difficultyFocusing: defaultValues?.sym_difficultyFocusing || '',
    sym_neckShoulderPain: defaultValues?.sym_neckShoulderPain || '',
    sym_mentalFatigue: defaultValues?.sym_mentalFatigue || '',
    sym_difficultyConcentrating: defaultValues?.sym_difficultyConcentrating || '',
    overallEyeStrain: defaultValues?.overallEyeStrain || '',
    digitalFatigueFrequency: defaultValues?.digitalFatigueFrequency || '',
    primarySymptomHistory: defaultValues?.primarySymptomHistory || '',
  });

  const setSurveyField = useCallback((field: keyof SurveyData, value: string) => {
    setSurvey((prev) => ({ ...prev, [field]: value }));
    setError('');
  }, []);

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const validate = (p: number): string | null => {
    switch (p) {
      case 0:
        if (!cvsq.cvsq_visual || cvsq.cvsq_visual.length === 0) {
          return 'Please select at least one visual complaint or choose "None of the above" to continue (Q1).';
        }
        return null;
      case 1:
        if (!cvsq.cvsq_ocular || cvsq.cvsq_ocular.length === 0) {
          return 'Please select at least one ocular surface complaint or choose "None of the above" to continue (Q2).';
        }
        return null;
      case 2:
        if (!cvsq.cvsq_extraocular || cvsq.cvsq_extraocular.length === 0) {
          return 'Please select at least one extraocular complaint or choose "None of the above" to continue (Q3).';
        }
        return null;
      case 3:
        if (!cvsq.cvsq_frequency) return 'Please select the frequency of your complaints (Q4).';
        if (!cvsq.cvsq_screen_associated) return 'Please answer whether your complaints are screen-associated (Q5).';
        return null;
      case 4:
        if (!survey.age) return 'Please select your age range.';
        if (!survey.gender) return 'Please select your gender.';
        if (!survey.yearLevel) return 'Please select your year level.';
        if (!survey.fieldOfStudy) return 'Please select your field of study.';
        return null;
      case 5:
        if (!survey.academicScreenTime) return 'Please select your academic screen time.';
        if (!survey.nonAcademicScreenTime) return 'Please select your non-academic screen time.';
        if (!survey.primaryDevice) return 'Please select your primary device.';
        if (!survey.continuousScreenUse) return 'Please select your typical continuous screen use duration.';
        if (!survey.onlineClassesPerDay) return 'Please select how many online classes you attend per day.';
        return null;
      case 6:
        if (!survey.follows202020) return 'Please answer Q10 (20-20-20 rule).';
        if (!survey.blueLightFilter) return 'Please answer Q11 (blue light filter / night mode).';
        if (!survey.screenBrightness) return 'Please select your screen brightness.';
        if (!survey.darkRoomUse) return 'Please answer Q13 (dark room use).';
        if (!survey.screenDistance) return 'Please select your screen distance.';
        if (!survey.wearsGlasses) return 'Please answer Q15 (eyeglasses / contact lenses).';
        if (!survey.blueLightGlasses) return 'Please answer Q16 (blue-light blocking glasses).';
        if (!survey.breakFrequency) return 'Please select your break frequency.';
        if (!survey.sleepHours) return 'Please select your average sleep hours.';
        return null;
      case 7: {
        const missing = SYMPTOM_GRID_ITEMS.find((s) => !survey[s.key as keyof SurveyData]);
        if (missing) return `Please answer the symptom: "${missing.label}".`;
        return null;
      }
      case 8:
        if (!survey.overallEyeStrain) return 'Please rate your overall eye strain (Q20).';
        if (!survey.digitalFatigueFrequency) return 'Please answer how often you feel digital fatigue (Q21).';
        if (!survey.primarySymptomHistory) return 'Please answer Q22 about your primary symptom history.';
        return null;
      default: return null;
    }
  };

  const handleNext = async () => {
    const err = validate(page);
    if (err) { setError(err); scrollTop(); return; }
    setError('');
    if (page === 4 && onProfileUpdate) {
      try {
        await onProfileUpdate({
          firstName: survey.firstName, lastName: survey.lastName, age: survey.age,
          gender: survey.gender, yearLevel: survey.yearLevel, fieldOfStudy: survey.fieldOfStudy,
        });
        setEditingProfile(false);
      } catch { /* non-fatal */ }
    }
    setPage((p) => p + 1);
    scrollTop();
  };

  const handlePrev = () => { setError(''); setPage((p) => p - 1); scrollTop(); };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (page !== TOTAL_PAGES - 1) return;
    if (!canSubmit) return;
    const err = validate(page);
    if (err) { setError(err); scrollTop(); return; }
    setIsLoading(true); setError('');
    try {
      await onSubmit({ ...cvsq, ...survey });
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Failed to submit. Please try again.');
      scrollTop();
    } finally {
      setIsLoading(false);
    }
  };

  const isCvsqPage = page <= 3;
  const progressPct = Math.round((page / (TOTAL_PAGES - 1)) * 100);

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (page === TOTAL_PAGES - 1 && canSubmit) handleSubmit(e); }} onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName === 'INPUT') e.preventDefault(); }} className="space-y-6">
      <div ref={topRef} />

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{isCvsqPage ? 'Part 1 — CVS-Smart Questionnaire' : 'Part 2 — EyeGuard Survey'}</span>
          <span>{progressPct}% complete</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300 bg-[#f97316]" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex gap-1">
          {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < page ? 'bg-[#f97316]/70' : i === page ? 'bg-[#f97316]' : 'bg-muted'}`} />
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div ref={errorRef} className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* ── PAGE 0 — CVSQ Q1 Visual ──────────────────────────────────────────── */}
      {page === 0 && (
        <div className="space-y-6">
          <PartBanner part="Part 1 of 2 — CVS-Smart Questionnaire" title="Visual Complaints" subtitle="Section 1 of 5 · Part 1" />
          <div className="rounded-lg bg-[#f97316]/8 dark:bg-[#f97316]/10 border border-[#f97316]/25 p-4">
            <p className="text-base font-semibold text-foreground">
              Q1. Out of the following visual complaints, how many do you suffer from? <span className="text-red-500">*</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">Select all that apply, or select &quot;None of the above&quot; if you experience none.</p>
          </div>
          <CheckboxGroup items={VISUAL_COMPLAINTS} selected={cvsq.cvsq_visual} showNoneOption={true} onChange={(v) => { setCvsq((c) => ({ ...c, cvsq_visual: v })); setError(''); }} />
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            {(() => {
              const count = cvsq.cvsq_visual.filter((x) => x && x !== 'None' && x !== 'None of the above').length;
              return `Score: ${count === 0 ? '0 complaints → 0 pts' : count === 1 ? '1 complaint → 1 pt' : `${count} complaints → 2 pts`}`;
            })()}
          </div>
        </div>
      )}

      {/* ── PAGE 1 — CVSQ Q2 Ocular ──────────────────────────────────────────── */}
      {page === 1 && (
        <div className="space-y-6">
          <PartBanner part="Part 1 of 2 — CVS-Smart Questionnaire" title="Ocular Surface Complaints" subtitle="Section 2 of 5 · Part 1" />
          <div className="rounded-lg bg-[#f97316]/8 dark:bg-[#f97316]/10 border border-[#f97316]/25 p-4">
            <p className="text-base font-semibold text-foreground">
              Q2. Out of the following ocular surface complaints, how many do you suffer from? <span className="text-red-500">*</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">Select all that apply, or select &quot;None of the above&quot; if you experience none.</p>
          </div>
          <CheckboxGroup items={OCULAR_SURFACE_COMPLAINTS} selected={cvsq.cvsq_ocular} showNoneOption={true} onChange={(v) => { setCvsq((c) => ({ ...c, cvsq_ocular: v })); setError(''); }} />
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            {(() => {
              const count = cvsq.cvsq_ocular.filter((x) => x && x !== 'None' && x !== 'None of the above').length;
              return `Score: ${count === 0 ? '0 complaints → 0 pts' : count === 1 ? '1 complaint → 1 pt' : `${count} complaints → 2 pts`}`;
            })()}
          </div>
        </div>
      )}

      {/* ── PAGE 2 — CVSQ Q3 Extraocular ─────────────────────────────────────── */}
      {page === 2 && (
        <div className="space-y-6">
          <PartBanner part="Part 1 of 2 — CVS-Smart Questionnaire" title="Extraocular Complaints" subtitle="Section 3 of 5 · Part 1" />
          <div className="rounded-lg bg-[#f97316]/8 dark:bg-[#f97316]/10 border border-[#f97316]/25 p-4">
            <p className="text-base font-semibold text-foreground">
              Q3. Out of the following extraocular complaints, how many do you suffer from? <span className="text-red-500">*</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">Select all that apply, or select &quot;None of the above&quot; if you experience none.</p>
          </div>
          <CheckboxGroup items={EXTRAOCULAR_COMPLAINTS} selected={cvsq.cvsq_extraocular} showNoneOption={true} onChange={(v) => { setCvsq((c) => ({ ...c, cvsq_extraocular: v })); setError(''); }} />
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            {(() => {
              const count = cvsq.cvsq_extraocular.filter((x) => x && x !== 'None' && x !== 'None of the above').length;
              return `Score: ${count === 0 ? '0 complaints → 0 pts' : count === 1 ? '1 complaint → 1 pt' : `${count} complaints → 2 pts`}`;
            })()}
          </div>
        </div>
      )}

      {/* ── PAGE 3 — CVSQ Q4 + Q5 ────────────────────────────────────────────── */}
      {page === 3 && (
        <div className="space-y-6">
          <PartBanner part="Part 1 of 2 — CVS-Smart Questionnaire" title="Frequency & Screen Association" subtitle="Section 4 of 5 · Part 1" />
          <FormField label="Q4. How do you describe the frequency of your complaints?" required fieldId="cvsq_frequency">
            <RadioGroup name="cvsq_frequency" options={CVSQ_FREQUENCY_OPTIONS} value={cvsq.cvsq_frequency}
              onChange={(v) => { setCvsq((c) => ({ ...c, cvsq_frequency: v })); setError(''); }}
              fieldId="cvsq_frequency"
              definitionKeys={{ Rare: 'Rare', Infrequent: 'Infrequent', Frequent: 'Frequent' }} />
            <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">Rare = 0 pts · Infrequent = 1 pt · Frequent = 2 pts</div>
          </FormField>
          <FormField label="Q5. Are your complaints associated with the time of screen use?" hint="i.e. do your complaints exist during or shortly after screen use?" required fieldId="cvsq_screen_associated">
            <RadioGroup name="cvsq_screen_associated" options={CVSQ_SCREEN_ASSOC_OPTIONS} value={cvsq.cvsq_screen_associated}
              onChange={(v) => { setCvsq((c) => ({ ...c, cvsq_screen_associated: v })); setError(''); }}
              fieldId="cvsq_screen_associated"
              definitionKeys={{ Never: 'Never (screen)', Sometimes: 'Sometimes (screen)', Always: 'Always (screen)' }} />
            <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">Never = 0 pts · Sometimes = 1 pt · Always = 2 pts</div>
          </FormField>
          {/* CVSQ preview */}
          {cvsq.cvsq_frequency && cvsq.cvsq_screen_associated && (() => {
            const q1 = Math.min(cvsq.cvsq_visual.filter((x) => x && x !== 'None' && x !== 'None of the above').length, 2);
            const q2 = Math.min(cvsq.cvsq_ocular.filter((x) => x && x !== 'None' && x !== 'None of the above').length, 2);
            const q3 = Math.min(cvsq.cvsq_extraocular.filter((x) => x && x !== 'None' && x !== 'None of the above').length, 2);
            const q4 = ({ Rare: 0, Infrequent: 1, Frequent: 2 } as Record<string,number>)[cvsq.cvsq_frequency] ?? 0;
            const q5 = ({ Never: 0, Sometimes: 1, Always: 2 } as Record<string,number>)[cvsq.cvsq_screen_associated] ?? 0;
            const total = q1 + q2 + q3 + q4 + q5;
            const status = total >= 7 ? 'Positive CVS Case' : total >= 5 ? 'High Probability' : total >= 3 ? 'Low Probability' : total >= 1 ? 'Not a CVS Case' : 'Normal';
            const color = total >= 7 ? 'red' : total >= 5 ? 'orange' : total >= 3 ? 'yellow' : 'green';
            return (
              <div className={`rounded-xl border-2 p-4 ${color === 'red' ? 'bg-red-50 dark:bg-red-950/20 border-red-300' : color === 'orange' ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-300' : color === 'yellow' ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300' : 'bg-green-50 dark:bg-green-950/20 border-green-300'}`}>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">CVS-Smart Preview</p>
                <p className={`text-2xl font-bold ${color === 'red' ? 'text-red-600' : color === 'orange' ? 'text-orange-600' : color === 'yellow' ? 'text-yellow-600' : 'text-green-600'}`}>{total} / 10</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{status}</p>
                <p className="text-xs text-muted-foreground mt-1">Q1: {q1} · Q2: {q2} · Q3: {q3} · Q4: {q4} · Q5: {q5}</p>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── PAGE 4 — Student Profile ──────────────────────────────────────────── */}
      {page === 4 && (
        <div className="space-y-6">
          <PartBanner part="Part 2 of 2 — EyeGuard Survey" title="Student Profile" subtitle="Section 1 of 5 · Tell us about yourself" />
          {/* Summary mode when profile is already saved */}
          {profileComplete && !editingProfile ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-[#f97316]/8 border border-[#f97316]/20 px-4 py-3 flex items-start gap-3">
                <User className="w-4 h-4 text-[#f97316] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">Your profile is saved. It will be used for this submission automatically.</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 divide-y divide-border overflow-hidden">
                {[
                  { label: 'First Name', value: survey.firstName }, { label: 'Last Name', value: survey.lastName },
                  { label: 'Email', value: email || '—' }, { label: 'Age range', value: survey.age },
                  { label: 'Gender', value: survey.gender }, { label: 'Year level', value: survey.yearLevel },
                  { label: 'Field of study', value: survey.fieldOfStudy },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between px-4 py-3">
                    <span className="text-xs text-muted-foreground w-32 flex-shrink-0">{label}</span>
                    <span className="text-sm font-medium text-foreground text-right flex-1">{value || '—'}</span>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setEditingProfile(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#f97316]/30 text-[#f97316] text-sm font-medium hover:bg-[#f97316]/8 transition-colors">
                <Pencil className="w-4 h-4" />Edit Profile
              </button>
            </div>
          ) : (
            /* Edit mode */
            <div className="space-y-6">
              {editingProfile && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-amber-700 dark:text-amber-400">Editing your profile. Changes will be saved when you tap Next.</p>
                  <button type="button" onClick={() => setEditingProfile(false)} className="text-xs text-muted-foreground hover:text-foreground underline flex-shrink-0">Cancel</button>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="First Name" fieldId="firstName">
                  <input id="firstName" type="text" value={survey.firstName} onChange={(e) => setSurveyField('firstName', e.target.value)} placeholder="e.g. Juan"
                    className="w-full px-4 py-2 rounded-lg border border-border bg-white dark:bg-[#1a1008] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </FormField>
                <FormField label="Last Name" fieldId="lastName">
                  <input id="lastName" type="text" value={survey.lastName} onChange={(e) => setSurveyField('lastName', e.target.value)} placeholder="e.g. Dela Cruz"
                    className="w-full px-4 py-2 rounded-lg border border-border bg-white dark:bg-[#1a1008] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </FormField>
              </div>
              <FormField label="Email Address" fieldId="email-display">
                <input id="email-display" type="email" value={email || ''} disabled className="w-full px-4 py-2 rounded-lg border border-border bg-muted text-muted-foreground cursor-not-allowed" />
                <p className="text-xs text-muted-foreground mt-1">Email cannot be changed here</p>
              </FormField>
              <FormField label="Q1. What is your age range?" required fieldId="age">
                <RadioGroup name="age" options={AGE_OPTIONS} value={survey.age} onChange={(v) => setSurveyField('age', v)} fieldId="age" />
              </FormField>
              <FormField label="Q2. What is your gender?" required fieldId="gender">
                <RadioGroup name="gender" options={GENDER_OPTIONS} value={survey.gender} onChange={(v) => setSurveyField('gender', v)} fieldId="gender" />
              </FormField>
              <FormField label="Q3. What is your year level?" required fieldId="yearLevel">
                <RadioGroup name="yearLevel" options={YEAR_LEVEL_OPTIONS} value={survey.yearLevel} onChange={(v) => setSurveyField('yearLevel', v)} fieldId="yearLevel" />
              </FormField>
              <FormField label="Q4. What is your field of study?" required fieldId="fieldOfStudy">
                <SelectField id="fieldOfStudy" value={survey.fieldOfStudy} placeholder="Select your field of study" options={FIELD_OPTIONS} onChange={(v) => setSurveyField('fieldOfStudy', v)} />
              </FormField>
            </div>
          )}
        </div>
      )}

      {/* ── PAGE 5 — Screen Time ──────────────────────────────────────────────── */}
      {page === 5 && (
        <div className="space-y-6">
          <PartBanner part="Part 2 of 2 — EyeGuard Survey" title="Screen Time & Device Use" subtitle="Section 2 of 5" />
          <FormField label="Q5. Average daily screen time for academic purposes" required fieldId="academicScreenTime">
            <RadioGroup name="academicScreenTime" options={ACAD_SCREEN_OPTIONS} value={survey.academicScreenTime} fieldId="academicScreenTime" onChange={(v) => setSurveyField('academicScreenTime', v)} />
          </FormField>
          <FormField label="Q6. Average daily screen time for non-academic purposes" hint="(social media, gaming, entertainment)" required fieldId="nonAcademicScreenTime">
            <RadioGroup name="nonAcademicScreenTime" options={NON_ACAD_SCREEN_OPTIONS} value={survey.nonAcademicScreenTime} fieldId="nonAcademicScreenTime" onChange={(v) => setSurveyField('nonAcademicScreenTime', v)} />
          </FormField>
          <FormField label="Q7. Which device do you use the most for screen activities?" required fieldId="primaryDevice">
            <RadioGroup name="primaryDevice" options={DEVICE_OPTIONS} value={survey.primaryDevice} fieldId="primaryDevice" onChange={(v) => setSurveyField('primaryDevice', v)} />
          </FormField>
          <FormField label="Q8. How long do you usually use a screen continuously without taking a break?" required fieldId="continuousScreenUse">
            <RadioGroup name="continuousScreenUse" options={CONTINUOUS_USE_OPTIONS} value={survey.continuousScreenUse} fieldId="continuousScreenUse" onChange={(v) => setSurveyField('continuousScreenUse', v)} />
          </FormField>
          <FormField label="Q9. How many online classes or digital study sessions do you attend per day?" required fieldId="onlineClassesPerDay">
            <RadioGroup name="onlineClassesPerDay" options={ONLINE_CLASSES_OPTIONS} value={survey.onlineClassesPerDay} fieldId="onlineClassesPerDay" onChange={(v) => setSurveyField('onlineClassesPerDay', v)} />
          </FormField>
        </div>
      )}

      {/* ── PAGE 6 — Screen Habits ────────────────────────────────────────────── */}
      {page === 6 && (
        <div className="space-y-6">
          <PartBanner part="Part 2 of 2 — EyeGuard Survey" title="Screen Habits & Environment" subtitle="Section 3 of 5" />
          <FormField label="Q10. Do you follow the 20-20-20 rule?" hint="(Look away every 20 minutes at something 20 feet away for 20 seconds)" required fieldId="follows202020">
            <RadioGroup name="follows202020" options={YESNO_FREQ_OPTIONS} value={survey.follows202020} fieldId="follows202020" onChange={(v) => setSurveyField('follows202020', v)} />
          </FormField>
          <FormField label="Q11. Do you use blue light filters or night mode on your device?" required fieldId="blueLightFilter">
            <RadioGroup name="blueLightFilter" options={YESNO_FREQ_OPTIONS} value={survey.blueLightFilter} fieldId="blueLightFilter" onChange={(v) => setSurveyField('blueLightFilter', v)} />
          </FormField>
          <FormField label="Q12. What screen brightness level do you usually use?" required fieldId="screenBrightness">
            <RadioGroup name="screenBrightness" options={BRIGHTNESS_OPTIONS} value={survey.screenBrightness} fieldId="screenBrightness" onChange={(v) => setSurveyField('screenBrightness', v)} />
          </FormField>
          <FormField label="Q13. Do you often use your device in a dark environment?" required fieldId="darkRoomUse">
            <RadioGroup name="darkRoomUse" options={YESNO_FREQ_OPTIONS} value={survey.darkRoomUse} fieldId="darkRoomUse" onChange={(v) => setSurveyField('darkRoomUse', v)} />
          </FormField>
          <FormField label="Q14. Approximate distance between your eyes and the screen" required fieldId="screenDistance">
            <RadioGroup name="screenDistance" options={DISTANCE_OPTIONS} value={survey.screenDistance} fieldId="screenDistance" onChange={(v) => setSurveyField('screenDistance', v)} />
          </FormField>
          <FormField label="Q15. Do you wear eyeglasses or contact lenses while using digital devices?" required fieldId="wearsGlasses">
            <RadioGroup name="wearsGlasses" options={['Yes', 'No']} value={survey.wearsGlasses} fieldId="wearsGlasses" onChange={(v) => setSurveyField('wearsGlasses', v)} />
          </FormField>
          <FormField label="Q16. Do you use blue-light blocking glasses?" required fieldId="blueLightGlasses">
            <RadioGroup name="blueLightGlasses" options={YESNO_FREQ_OPTIONS} value={survey.blueLightGlasses} fieldId="blueLightGlasses" onChange={(v) => setSurveyField('blueLightGlasses', v)} />
          </FormField>
          <FormField label="Q17. How often do you take breaks during long screen sessions?" required fieldId="breakFrequency">
            <RadioGroup name="breakFrequency" options={BREAK_FREQ_OPTIONS} value={survey.breakFrequency} fieldId="breakFrequency" onChange={(v) => setSurveyField('breakFrequency', v)} />
          </FormField>
          <FormField label="Q18. How many hours of sleep do you usually get per night?" required fieldId="sleepHours">
            <RadioGroup name="sleepHours" options={SLEEP_OPTIONS.map(o => o.label)} value={SLEEP_OPTIONS.find(o => o.value === survey.sleepHours)?.label || ''}
              fieldId="sleepHours"
              onChange={(v) => { const opt = SLEEP_OPTIONS.find(o => o.label === v); if (opt) setSurveyField('sleepHours', opt.value); }} />
          </FormField>
        </div>
      )}

      {/* ── PAGE 7 — Symptom Grid ─────────────────────────────────────────────── */}
      {page === 7 && (
        <div className="space-y-6">
          <PartBanner part="Part 2 of 2 — EyeGuard Survey" title="Eye Strain Symptoms" subtitle="Section 4 of 5 · Q19 — Rate each symptom in the past week" />
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
            <p className="text-sm text-primary/90 font-medium">Q19. In the past week, how often have you experienced the following symptoms while using digital devices?</p>
            <p className="text-xs text-muted-foreground mt-1">Scale: Never · Rarely · Sometimes · Often · Always</p>
          </div>
          {/* Desktop grid */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left p-3 font-medium text-foreground w-1/2">Symptom</th>
                  {SYMPTOM_SCALE.map((s) => <th key={s} className="text-center p-3 font-medium text-foreground">{s}</th>)}
                </tr>
              </thead>
              <tbody>
                {SYMPTOM_GRID_ITEMS.map((item, i) => (
                  <tr key={item.key} className={`transition-colors ${survey[item.key as keyof SurveyData] ? 'bg-[#f97316]/8 dark:bg-[#f97316]/10' : i % 2 === 0 ? 'bg-white dark:bg-transparent' : 'bg-muted/20'}`}>
                    <td className="p-3 text-foreground">
                      <span className="flex items-center gap-1">{item.label}<InfoButton term={item.label} /></span>
                    </td>
                    {SYMPTOM_SCALE.map((scale) => {
                      const isSelected = survey[item.key as keyof SurveyData] === scale;
                      return (
                        <td key={scale} className="text-center p-1">
                          <label className="flex items-center justify-center w-full min-h-[44px] cursor-pointer">
                            <input type="radio" name={item.key} value={scale} checked={isSelected} onChange={() => setSurveyField(item.key as keyof SurveyData, scale)} className="sr-only" />
                            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${isSelected ? 'border-[#f97316] bg-[#f97316]' : 'border-muted-foreground/40 bg-transparent hover:border-[#f97316]/50'}`}>
                              {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                            </span>
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile stacked */}
          <div className="sm:hidden space-y-4">
            {SYMPTOM_GRID_ITEMS.map((item) => (
              <div key={item.key} className="rounded-lg border border-border p-4 space-y-3">
                <p className="text-sm font-medium text-foreground flex items-center gap-1">{item.label}<InfoButton term={item.label} /></p>
                <div className="flex flex-wrap gap-2">
                  {SYMPTOM_SCALE.map((scale) => (
                    <label key={scale} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${survey[item.key as keyof SurveyData] === scale ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                      <input type="radio" name={item.key} value={scale} checked={survey[item.key as keyof SurveyData] === scale} onChange={() => setSurveyField(item.key as keyof SurveyData, scale)} className="sr-only" />
                      {scale}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PAGE 8 — Self-Assessment ──────────────────────────────────────────── */}
      {page === 8 && (
        <div className="space-y-6">
          <PartBanner part="Part 2 of 2 — EyeGuard Survey" title="Overall Self-Assessment" subtitle="Section 5 of 5 · Almost done!" />
          <FormField label="Q20. How would you rate your overall eye strain after daily screen use?" required fieldId="overallEyeStrain">
            <RadioGroup name="overallEyeStrain" options={OVERALL_STRAIN_OPTIONS} value={survey.overallEyeStrain} fieldId="overallEyeStrain" onChange={(v) => setSurveyField('overallEyeStrain', v)} />
          </FormField>
          <FormField label="Q21. How often do you feel digital fatigue after using screens?" required fieldId="digitalFatigueFrequency">
            <RadioGroup name="digitalFatigueFrequency" options={DIGITAL_FATIGUE_OPTIONS} value={survey.digitalFatigueFrequency} fieldId="digitalFatigueFrequency" onChange={(v) => setSurveyField('digitalFatigueFrequency', v)} />
          </FormField>
          <FormField label="Q22. Have you previously noticed dry eyes or blurry vision as a primary/frequent symptom?" required fieldId="primarySymptomHistory">
            <RadioGroup name="primarySymptomHistory" options={PRIMARY_SYMPTOM_OPTIONS} value={survey.primarySymptomHistory} fieldId="primarySymptomHistory" onChange={(v) => setSurveyField('primarySymptomHistory', v)} />
          </FormField>
        </div>
      )}

      {/* ── Navigation buttons ────────────────────────────────────────────────── */}
      <div className="flex gap-3 pt-2">
        {page > 0 && (
          <button type="button" onClick={handlePrev}
            className="flex-1 sm:flex-none px-6 py-3 border border-border text-foreground text-sm font-medium rounded-xl hover:bg-muted transition-colors">
            Previous
          </button>
        )}
        {page < TOTAL_PAGES - 1 ? (
          <button type="button" onClick={handleNext}
            className="flex-1 px-6 py-3 bg-[#f97316] text-white text-sm font-semibold rounded-xl hover:bg-[#fb923c] transition-colors">
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isLoading || !canSubmit}
            className="flex-1 px-6 py-3 bg-[#f97316] text-white text-sm font-semibold rounded-xl hover:bg-[#fb923c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Submitting…' : 'Submit Survey'}
          </button>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">Page {page + 1} of {TOTAL_PAGES} · Your responses are used only for research purposes.</p>
    </form>
  );
}
