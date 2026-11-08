'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, CalendarCheck, ArrowRight, LayoutDashboard } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MainLayout } from '@/components/main-layout';
import { AuthGuard } from '@/components/auth-guard';
import { ScreenTimeForm } from '@/components/screen-time-form';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/form-components';

const CONSENT_KEY = 'eyeguard_research_consent';
const NOTICE_REMINDER_KEY = 'eyeguard_research_notice_reminder';

function consentKey(userId: string) {
  return `${CONSENT_KEY}_${userId}`;
}

// Converts a numeric age (integer stored in user_profiles) to the survey's
// categorical age range string. Returns '' if the value is unusable.
function intAgeToRange(age: unknown): string {
  const n = Number(age);
  if (!n || isNaN(n)) return '';
  if (n <= 18) return '17-18';
  if (n <= 20) return '19-20';
  if (n <= 22) return '21-22';
  return '23+';
}

// Fields prefilled from the last daily log (non-profile, non-CVSQ)
interface PreviousLogData {
  // Profile
  firstName?: string;
  lastName?: string;
  age?: string;
  gender?: string;
  yearLevel?: string;
  fieldOfStudy?: string;
  // Screen time
  academicScreenTime?: string;
  nonAcademicScreenTime?: string;
  primaryDevice?: string;
  continuousScreenUse?: string;
  onlineClassesPerDay?: string;
  // Habits & environment
  follows202020?: string;
  blueLightFilter?: string;
  screenBrightness?: string;
  darkRoomUse?: string;
  screenDistance?: string;
  wearsGlasses?: string;
  blueLightGlasses?: string;
  breakFrequency?: string;
  sleepHours?: string;
  // Symptom grid (prefilled so user can adjust)
  sym_dryEyes?: string;
  sym_eyeItchiness?: string;
  sym_blurredVision?: string;
  sym_headaches?: string;
  sym_eyeIrritation?: string;
  sym_lightSensitivity?: string;
  sym_difficultyFocusing?: string;
  sym_neckShoulderPain?: string;
  sym_mentalFatigue?: string;
  sym_difficultyConcentrating?: string;
  // Self-assessment
  overallEyeStrain?: string;
  digitalFatigueFrequency?: string;
  primarySymptomHistory?: string;
}

export default function DailyLogPage() {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{
    riskPercentage?: number;
    riskLevel?: string;
    fatigueScore?: number;
    cvsqScore?: number;
    cvsqStatus?: string;
    overallScore?: number;
    overallLevel?: number;
    overallStatus?: string;
    concordant?: boolean;
    concordanceScenario?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alreadyLoggedToday, setAlreadyLoggedToday] = useState(false);
  const [checkingLog, setCheckingLog] = useState(true);
  const [previousLog, setPreviousLog] = useState<PreviousLogData | null>(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [showConsent, setShowConsent] = useState<boolean | null>(null);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [doNotShowAgain, setDoNotShowAgain] = useState(false);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const userConsentKey = consentKey(user.id);
        const stored = localStorage.getItem(userConsentKey);
        const reminderEnabled = localStorage.getItem(NOTICE_REMINDER_KEY) === 'enabled';
        setShowConsent(stored !== 'accepted' || reminderEnabled);

        const today = new Date().toISOString().split('T')[0];

        const [todayCheck, profileResult, lastLogResult] = await Promise.all([
          supabase.from('daily_logs').select('id').eq('user_id', user.id).eq('date', today).limit(1),
          supabase.from('user_profiles').select('first_name, last_name, age, gender, year_level, field_of_study').eq('user_id', user.id).maybeSingle(),
          supabase.from('daily_logs').select(
            'age, gender, year_level, field_of_study,' +
            'academic_screen_time, non_academic_screen_time, primary_device,' +
            'continuous_screen_use, online_classes_per_day,' +
            'follows_20_20_20, blue_light_filter, screen_brightness, dark_room_use,' +
            'screen_distance, wears_glasses, blue_light_glasses, break_frequency, sleep_hours,' +
            'sym_dry_eyes, sym_eye_itchiness, sym_blurred_vision, sym_headaches,' +
            'sym_eye_irritation, sym_light_sensitivity, sym_difficulty_focusing,' +
            'sym_neck_shoulder_pain, sym_mental_fatigue, sym_difficulty_concentrating,' +
            'overall_eye_strain, digital_fatigue_frequency, primary_symptom_history'
          ).eq('user_id', user.id).order('date', { ascending: false }).limit(1).maybeSingle(),
        ]);

        setAlreadyLoggedToday(!!(todayCheck.data && todayCheck.data.length > 0));
        setUserEmail(user.email || '');
        setUserId(user.id);

        const profile = profileResult.data;
        const last = lastLogResult.data as Record<string, unknown> | null;

        // Convert profile.age (INT) to the survey's range string.
        const profileAgeRange = intAgeToRange((profile as any)?.age);
        const ageRange = profileAgeRange || (last?.age as string) || '';

        // A profile is "complete" when the user_profiles row has all required fields.
        const isProfileComplete = !!(
          (profile as any)?.first_name &&
          (profile as any)?.last_name &&
          profileAgeRange &&
          (profile as any)?.gender &&
          (profile as any)?.year_level &&
          (profile as any)?.field_of_study
        );
        setProfileComplete(isProfileComplete);

        if (profile || last) {
          setPreviousLog({
            firstName:    (profile as any)?.first_name || '',
            lastName:     (profile as any)?.last_name  || '',
            age:          ageRange,
            gender:       (profile as any)?.gender       || (last?.gender as string)       || '',
            yearLevel:    (profile as any)?.year_level   || (last?.year_level as string)   || '',
            fieldOfStudy: (profile as any)?.field_of_study || (last?.field_of_study as string) || '',
            academicScreenTime:    (last?.academic_screen_time    as string) || '',
            nonAcademicScreenTime: (last?.non_academic_screen_time as string) || '',
            primaryDevice:         (last?.primary_device           as string) || '',
            continuousScreenUse:   (last?.continuous_screen_use    as string) || '',
            onlineClassesPerDay:   (last?.online_classes_per_day   as string) || '',
            follows202020:    (last?.follows_20_20_20    as string) || '',
            blueLightFilter:  (last?.blue_light_filter   as string) || '',
            screenBrightness: (last?.screen_brightness   as string) || '',
            darkRoomUse:      (last?.dark_room_use        as string) || '',
            screenDistance:   (last?.screen_distance      as string) || '',
            wearsGlasses:     (last?.wears_glasses         as string) || '',
            blueLightGlasses: (last?.blue_light_glasses   as string) || '',
            breakFrequency:   (last?.break_frequency      as string) || '',
            sleepHours:       last?.sleep_hours != null ? String(last.sleep_hours) : '',
            sym_dryEyes:                (last?.sym_dry_eyes                  as string) || '',
            sym_eyeItchiness:           (last?.sym_eye_itchiness             as string) || '',
            sym_blurredVision:          (last?.sym_blurred_vision            as string) || '',
            sym_headaches:              (last?.sym_headaches                  as string) || '',
            sym_eyeIrritation:          (last?.sym_eye_irritation            as string) || '',
            sym_lightSensitivity:       (last?.sym_light_sensitivity         as string) || '',
            sym_difficultyFocusing:     (last?.sym_difficulty_focusing       as string) || '',
            sym_neckShoulderPain:       (last?.sym_neck_shoulder_pain        as string) || '',
            sym_mentalFatigue:          (last?.sym_mental_fatigue            as string) || '',
            sym_difficultyConcentrating:(last?.sym_difficulty_concentrating  as string) || '',
            overallEyeStrain:        (last?.overall_eye_strain        as string) || '',
            digitalFatigueFrequency: (last?.digital_fatigue_frequency  as string) || '',
            primarySymptomHistory:   (last?.primary_symptom_history   as string) || '',
          });
        }
      } catch { /* non-fatal */ }
      finally { setCheckingLog(false); }
    };

    loadUserData();
  }, [supabase]);

  const handleConsent = () => {
    if (userId) localStorage.setItem(consentKey(userId), 'accepted');
    if (doNotShowAgain) localStorage.removeItem(NOTICE_REMINDER_KEY);
    setShowConsent(false);
  };

  const handleDecline = () => setShowConsent(false);

  const handleFormSubmit = async (formData: any) => {
    try {
      setError('');
      setSuccess(false);
      setIsSubmitting(true);

      const response = await fetch('/api/predict-supabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save daily log');
      }

      const result = await response.json();

      const riskLevelLabel = result.risk_level !== undefined
        ? (['Low', 'Moderate', 'High', 'Critical'][result.risk_level] ?? String(result.risk_level))
        : undefined;

      if (result.risk_level === 2) {
        toast.warning('High Eye Strain Risk Detected', {
          description: `Your risk score is ${result.risk_percentage?.toFixed(1)}%. Take a break and follow the recommendations.`,
          duration: 8000,
          action: { label: 'View Details', onClick: () => router.push('/risk-prediction') },
        });
      } else if (result.risk_level === 3) {
        toast.error('Critical Eye Strain Risk!', {
          description: `Your risk score is ${result.risk_percentage?.toFixed(1)}%. Please rest your eyes immediately.`,
          duration: 12000,
          action: { label: 'View Details', onClick: () => router.push('/risk-prediction') },
        });
      }

      if (result.cvsq_score >= 7) {
        toast.warning('CVS-Smart: Positive CVS Case', {
          description: `Your CVS-Smart score is ${result.cvsq_score}/10. Consider consulting an eye care professional.`,
          duration: 10000,
        });
      }

      setSuccessData({
        riskPercentage:      result.risk_percentage,
        riskLevel:           riskLevelLabel,
        fatigueScore:        result.fatigue_score,
        cvsqScore:           result.cvsq_score,
        cvsqStatus:          result.cvsq_status,
        overallScore:        result.overall_score,
        overallLevel:        result.overall_level,
        overallStatus:       result.overall_status,
        concordant:          result.concordant,
        concordanceScenario: result.concordance_scenario,
      });
      setSuccess(true);
      setAlreadyLoggedToday(true);
    } catch (err) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : 'Failed to save daily log';
      setError(msg);
      toast.error('Submission Failed', { description: msg });
      throw err;
    }
  };

  // ── Risk level colour helper ───────────────────────────────────────────────
  const riskColors = (level?: string) => ({
    bg:     level === 'Low' ? 'bg-green-50 dark:bg-green-950/20' : level === 'Moderate' ? 'bg-yellow-50 dark:bg-yellow-950/20' : level === 'High' ? 'bg-orange-50 dark:bg-orange-950/20' : 'bg-red-50 dark:bg-red-950/20',
    border: level === 'Low' ? 'border-green-200 dark:border-green-800' : level === 'Moderate' ? 'border-yellow-200 dark:border-yellow-800' : level === 'High' ? 'border-orange-200 dark:border-orange-800' : 'border-red-200 dark:border-red-800',
    text:   level === 'Low' ? 'text-green-700 dark:text-green-400' : level === 'Moderate' ? 'text-yellow-700 dark:text-yellow-400' : level === 'High' ? 'text-orange-700 dark:text-orange-400' : 'text-red-700 dark:text-red-400',
  });

  const cvsqColor = (score?: number) =>
    !score || score === 0 ? 'text-green-600' : score <= 2 ? 'text-green-600' : score <= 4 ? 'text-yellow-600' : score <= 6 ? 'text-orange-600' : 'text-red-600';

  return (
    <AuthGuard>
      <MainLayout>

        {/* ── SUCCESS STATE ──────────────────────────────────────────────── */}
        {success && (
          <div className="flex items-center justify-center min-h-[70vh]">
            <div className="text-center space-y-6 p-8 max-w-lg w-full">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto">
                <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-foreground">Survey submitted!</h2>
                <p className="text-muted-foreground text-sm">Your eye health data has been recorded.</p>
              </div>

              {successData && (
                <div className="space-y-3 text-left">
                  {/* CVSQ result card */}
                  {successData.cvsqScore !== undefined && (
                    <div className="rounded-xl p-4 border border-[#f97316]/25 bg-[#f97316]/8 dark:bg-[#f97316]/10">
                      <p className="text-xs text-[#f97316] font-semibold mb-1 uppercase tracking-wide">CVS-Smart Score</p>
                      <div className="flex items-end gap-2">
                        <p className={`text-3xl font-bold ${cvsqColor(successData.cvsqScore)}`}>
                          {successData.cvsqScore}
                          <span className="text-base font-normal text-muted-foreground"> / 10</span>
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-foreground mt-0.5">{successData.cvsqStatus}</p>
                    </div>
                  )}

                  {/* Overall combined score */}
                  {successData.overallScore !== undefined && (() => {
                    const ol = successData.overallLevel ?? 0;
                    const c = riskColors(['Low','Moderate','High','Critical'][ol]);
                    return (
                      <div className={`rounded-xl p-4 border ${c.bg} ${c.border}`}>
                        <p className="text-xs text-muted-foreground mb-1">Overall Combined Risk</p>
                        <p className={`text-2xl font-bold ${c.text}`}>{successData.overallScore.toFixed(1)}%</p>
                        <p className={`text-xs font-semibold mt-0.5 ${c.text}`}>{successData.overallStatus}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">60% EyeGuard + 40% CVS-Smart</p>
                      </div>
                    );
                  })()}

                  {/* EyeGuard risk + fatigue */}
                  <div className="grid grid-cols-2 gap-3">
                    {successData.riskPercentage !== undefined && (() => {
                      const c = riskColors(successData.riskLevel);
                      return (
                        <div className={`rounded-xl p-4 border ${c.bg} ${c.border}`}>
                          <p className="text-xs text-muted-foreground mb-1">EyeGuard Score</p>
                          <p className={`text-2xl font-bold ${c.text}`}>{successData.riskPercentage.toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{successData.riskLevel}</p>
                        </div>
                      );
                    })()}
                    {successData.fatigueScore !== undefined && (
                      <div className="rounded-xl p-4 border border-border bg-muted/40">
                        <p className="text-xs text-muted-foreground mb-1">Fatigue Score</p>
                        <p className="text-2xl font-bold text-foreground">{successData.fatigueScore.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">out of 10</p>
                      </div>
                    )}
                  </div>

                  {/* Concordance banner */}
                  {successData.concordant !== undefined && (
                    <div className={`rounded-xl p-3 border text-sm ${
                      successData.concordant
                        ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                        : successData.concordanceScenario === 'cvsq_high_eyeguard_low'
                          ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 text-orange-800 dark:text-orange-300'
                          : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 text-blue-800 dark:text-blue-300'
                    }`}>
                      {successData.concordant
                        ? '✅ Both assessments agree on your risk level.'
                        : successData.concordanceScenario === 'cvsq_high_eyeguard_low'
                          ? '⚠️ Your CVS-Smart score indicates active symptoms. Consider consulting an eye care professional.'
                          : '💡 No active symptoms yet, but your screen habits show early-warning risk. Act now to prevent symptoms.'}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => router.push('/risk-prediction')}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors">
                  View Full Results<ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={() => router.push('/dashboard')}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 border border-border text-foreground text-sm font-medium rounded-xl hover:bg-muted transition-colors">
                  <LayoutDashboard className="w-4 h-4" />Dashboard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── FORM ──────────────────────────────────────────────────────── */}
        {!success && (
          <>
            {/* Consent modal */}
            {showConsent === true && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh]">
                  <div className="flex items-center gap-3 px-7 pt-7 pb-5 border-b border-border flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Before You Continue</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Please read and check both boxes to proceed</p>
                    </div>
                  </div>

                  <div className="overflow-y-auto flex-1 px-7 py-5 space-y-5 text-sm text-muted-foreground leading-relaxed">
                    <div className="rounded-xl bg-primary/5 border border-primary/15 p-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Research Participation Notice</p>
                      <ul className="space-y-2">
                        {[
                          <>This survey collects personal health data for <strong className="text-foreground">academic research</strong> on digital eye strain among Filipino students.</>,
                          <>Your participation is <strong className="text-foreground">voluntary</strong>. You may stop at any time without penalty.</>,
                          <>Your data is kept <strong className="text-foreground">confidential</strong> and will not be shared publicly or used for commercial purposes.</>,
                          <>Data is used solely to <strong className="text-foreground">improve the eye strain prediction model</strong> and provide personalised recommendations.</>,
                          <>You must be at least <strong className="text-foreground">17 years old</strong> to participate.</>,
                        ].map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-primary font-bold mt-0.5 flex-shrink-0">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Terms of Service — Summary</p>
                      <p>EyeGuard is an <strong className="text-foreground">academic screening tool</strong>, not a medical device. Risk scores are informational only and do not constitute a medical diagnosis.</p>
                      <a href="/terms" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-medium">Read full Terms of Service ↗</a>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Privacy Policy — Summary</p>
                      <p>We collect your email, profile information, and survey responses. Processed under the <strong className="text-foreground">Philippines' Data Privacy Act of 2012 (R.A. 10173)</strong>.</p>
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-medium">Read full Privacy Policy ↗</a>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground font-medium">You must check both boxes before continuing:</p>
                      {[
                        { state: agreedTerms, setter: setAgreedTerms, label: <>I have read and agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-primary hover:underline font-medium">Terms of Service</a></> },
                        { state: agreedPrivacy, setter: setAgreedPrivacy, label: <>I have read and agree to the <a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-primary hover:underline font-medium">Privacy Policy</a> and consent to data collection</> },
                      ].map(({ state, setter, label }, i) => (
                        <label key={i} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${state ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                          <div className="flex-shrink-0 mt-0.5">
                            <input type="checkbox" checked={state} onChange={e => setter(e.target.checked)} className="sr-only" />
                            <div className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-colors ${state ? 'bg-primary border-primary' : 'border-muted-foreground/40'}`}>
                              {state && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" /></svg>}
                            </div>
                          </div>
                          <span className="text-sm text-foreground leading-snug">{label}</span>
                        </label>
                      ))}
                    </div>

                    <label className={`flex items-start gap-3 cursor-pointer group ${!agreedTerms || !agreedPrivacy ? 'opacity-40 pointer-events-none' : ''}`}>
                      <div className="flex-shrink-0 mt-0.5">
                        <input type="checkbox" checked={doNotShowAgain} onChange={e => setDoNotShowAgain(e.target.checked)} disabled={!agreedTerms || !agreedPrivacy} className="sr-only" />
                        <div className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-colors ${doNotShowAgain ? 'bg-primary border-primary' : 'border-muted-foreground/40 group-hover:border-primary/50'}`}>
                          {doNotShowAgain && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" /></svg>}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors leading-relaxed">
                        Don't show this notice again<br />
                        <span className="text-muted-foreground/60">You can turn this back on in <strong className="text-foreground">Settings → Privacy</strong>.</span>
                      </span>
                    </label>
                  </div>

                  <div className="px-7 pb-7 pt-5 border-t border-border flex-shrink-0">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button onClick={handleConsent} disabled={!agreedTerms || !agreedPrivacy}
                        className="flex-1 px-5 py-3 bg-primary text-primary-foreground text-sm font-semibold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90">
                        {!agreedTerms || !agreedPrivacy ? 'Check both boxes above to continue' : 'I Agree & Continue'}
                      </button>
                      <button onClick={handleDecline}
                        className="sm:w-auto px-5 py-3 border border-border text-muted-foreground text-sm font-medium rounded-xl hover:bg-muted transition-colors">
                        Exit
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Page header */}
            <div className="min-h-[calc(100vh-7rem)] w-full max-w-3xl mx-auto space-y-8 px-4 py-6 sm:px-8 sm:py-10">
              <div className="border-b border-[#f97316]/15 pb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#fb923c]">Daily check-in</p>
                <h1 className="text-3xl sm:text-4xl font-bold text-foreground mt-2">Eye Health Survey</h1>
                <p className="text-muted-foreground mt-2">Complete both the CVS-Smart questionnaire and the EyeGuard behavioral survey to get your results.</p>
              </div>

              {!checkingLog && alreadyLoggedToday && (
                <div className="flex items-start gap-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <CalendarCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">You already submitted today</p>
                    <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">Submitting again will update your entry for today.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')} className="flex-shrink-0">View Dashboard</Button>
                </div>
              )}

              {error && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive font-medium">{error}</p>
                </div>
              )}

              <div className="bg-card rounded-xl border border-border p-6">
                {checkingLog ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <ScreenTimeForm
                    onSubmit={handleFormSubmit}
                    email={userEmail}
                    defaultValues={previousLog ?? undefined}
                    profileComplete={profileComplete}
                    onProfileUpdate={async (profile) => {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) return;
                      await supabase.from('user_profiles').upsert({
                        user_id:        user.id,
                        first_name:     profile.firstName,
                        last_name:      profile.lastName,
                        age:            profile.age ? profile.age : null,
                        gender:         profile.gender,
                        year_level:     profile.yearLevel,
                        field_of_study: profile.fieldOfStudy,
                        updated_at:     new Date().toISOString(),
                      }, { onConflict: 'user_id' });
                      if (profile.firstName && profile.lastName && profile.age && profile.gender && profile.yearLevel && profile.fieldOfStudy) {
                        setProfileComplete(true);
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </MainLayout>
    </AuthGuard>
  );
}
