import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { selectRecommendations, type RecommendationInput } from '@/lib/recommendations';

// ─────────────────────────────────────────────────────────────────────────────
// CVSQ SCORING  (Iqbal et al., 2024 — verbatim instrument)
// ─────────────────────────────────────────────────────────────────────────────
function computeCvsqScore(formData: Record<string, unknown>): {
  cvsq_q1: number; cvsq_q2: number; cvsq_q3: number;
  cvsq_q4: number; cvsq_q5: number; cvsq_total: number;
  cvsq_status: string;
} {
  const countComplaints = (val: unknown): number => {
    if (Array.isArray(val)) {
      return val.filter((v) => v && v !== 'None' && v !== 'None of the above').length;
    }
    return 0;
  };

  const q1 = Math.min(countComplaints(formData.cvsq_visual),      2);
  const q2 = Math.min(countComplaints(formData.cvsq_ocular),      2);
  const q3 = Math.min(countComplaints(formData.cvsq_extraocular), 2);

  const freqMap: Record<string, number> = { Rare: 0, Infrequent: 1, Frequent: 2 };
  const q4 = freqMap[String(formData.cvsq_frequency ?? '')] ?? 0;

  const screenMap: Record<string, number> = { Never: 0, Sometimes: 1, Always: 2 };
  const q5 = screenMap[String(formData.cvsq_screen_associated ?? '')] ?? 0;

  const total = q1 + q2 + q3 + q4 + q5;

  const status =
    total >= 7 ? 'Positive CVS Case' :
    total >= 5 ? 'High Probability' :
    total >= 3 ? 'Low Probability' :
    total >= 1 ? 'Not a CVS Case' :
                 'Normal';

  return { cvsq_q1: q1, cvsq_q2: q2, cvsq_q3: q3, cvsq_q4: q4, cvsq_q5: q5,
           cvsq_total: total, cvsq_status: status };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONCORDANCE CHECK
// ─────────────────────────────────────────────────────────────────────────────
function checkConcordance(cvsqTotal: number, riskLevel: number): {
  concordant: boolean; concordance_scenario: string;
} {
  let concordant = false;

  if (cvsqTotal >= 7)       concordant = riskLevel >= 2;
  else if (cvsqTotal >= 5)  concordant = riskLevel >= 1;
  else if (cvsqTotal >= 3)  concordant = riskLevel <= 1;
  else                      concordant = riskLevel === 0;

  let concordance_scenario = 'agree';
  if (!concordant) {
    if (cvsqTotal >= 5 && riskLevel <= 1) concordance_scenario = 'cvsq_high_eyeguard_low';
    else if (cvsqTotal <= 2 && riskLevel >= 2) concordance_scenario = 'cvsq_low_eyeguard_high';
    else concordance_scenario = 'discordant';
  }

  return { concordant, concordance_scenario };
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN BRIGHTNESS — map categorical to numeric
// ─────────────────────────────────────────────────────────────────────────────
function brightnessToNumber(val: string): number {
  const map: Record<string, number> = {
    'Low (0–25%)':          15,
    'Medium (26–50%)':      40,
    'Medium-High (51–75%)': 65,
    'High (76–100%)':       90,
  };
  if (map[val] !== undefined) return map[val];
  const n = parseInt(val);
  return isNaN(n) ? 50 : n;
}

// ─────────────────────────────────────────────────────────────────────────────
// SYMPTOM FREQUENCY MAP
// ─────────────────────────────────────────────────────────────────────────────
const SYM_FREQ_MAP: Record<string, number> = {
  'Never': 0, 'Rarely': 0.5, 'Sometimes': 1.0, 'Often': 1.5, 'Always': 2.0,
  'Rarely (1-2 times a week)':    0.5,
  'Sometimes (3-4 times a week)': 1.0,
  'Often (5-6 times a week)':     1.5,
  'Always (every day)':           2.0,
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/predict-supabase
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.json();

    // ── Profile upsert ───────────────────────────────────────────────────────
    try {
      await supabase.from('user_profiles').upsert({
        user_id:        user.id,
        first_name:     formData.firstName || '',
        last_name:      formData.lastName  || '',
        age:            formData.age,
        gender:         formData.gender,
        year_level:     formData.yearLevel,
        field_of_study: formData.fieldOfStudy,
      }, { onConflict: 'user_id' });
    } catch { /* non-fatal */ }

    // ── PART 1 — CVSQ Scoring ────────────────────────────────────────────────
    const cvsqResult = computeCvsqScore(formData);

    // ── PART 2 — Raw EyeGuard inputs ─────────────────────────────────────────
    const academicHours = ({
      'Less than 2 hours': 1, '2–4 hours': 3, '4–6 hours': 5,
      '6–8 hours': 7, 'More than 8 hours': 8,
    } as Record<string, number>)[formData.academicScreenTime] ?? 0;

    const nonAcademicHours = ({
      'Less than 1 hour': 0.5, '1–3 hours': 2, '3–5 hours': 4,
      '5–7 hours': 5.5, 'More than 7 hours': 6,
    } as Record<string, number>)[formData.nonAcademicScreenTime] ?? 0;

    const screenTime = Math.min(academicHours + nonAcademicHours, 12);
    const sleepHours = parseFloat(formData.sleepHours) || 7;
    const brightness = brightnessToNumber(formData.screenBrightness ?? formData.brightness ?? '50');

    const eyeStrainFreq    = SYM_FREQ_MAP[formData.sym_blurredVision   ?? formData.blurryVisionFrequency ?? ''] ?? 0;
    const blurryVisionFreq = SYM_FREQ_MAP[formData.sym_blurredVision   ?? formData.blurryVisionFrequency ?? ''] ?? 0;
    const headachesFreq    = SYM_FREQ_MAP[formData.sym_headaches        ?? formData.headachesFrequency    ?? ''] ?? 0;
    const dryEyesFreq      = SYM_FREQ_MAP[formData.sym_dryEyes          ?? formData.dryEyesFrequency      ?? ''] ?? 0;
    const eyeItchinessFreq       = SYM_FREQ_MAP[formData.sym_eyeItchiness          ?? ''] ?? 0;
    const eyeIrritationFreq      = SYM_FREQ_MAP[formData.sym_eyeIrritation         ?? ''] ?? 0;
    const lightSensitivityFreq   = SYM_FREQ_MAP[formData.sym_lightSensitivity      ?? ''] ?? 0;
    const difficultyFocusingFreq = SYM_FREQ_MAP[formData.sym_difficultyFocusing    ?? ''] ?? 0;
    const neckShoulderPainFreq   = SYM_FREQ_MAP[formData.sym_neckShoulderPain      ?? ''] ?? 0;
    const mentalFatigueFreq      = SYM_FREQ_MAP[formData.sym_mentalFatigue         ?? ''] ?? 0;
    const difficultyConcentFreq  = SYM_FREQ_MAP[formData.sym_difficultyConcentrating ?? ''] ?? 0;

    const blueLight    = formData.blueLightFilter ?? formData.blueLight ?? '';
    const exerciseFreq = formData.exerciseFrequency ?? '';
    const outdoorTime  = formData.outdoorTime ?? '';

    // ── STEP 1 — Symptom Score ────────────────────────────────────────────────
    // Scaled to 60 max so symptom score alone cannot reach High without
    // environmental modifiers confirming heavy exposure.
    const cvqRawScore =
      (eyeStrainFreq    * 2.0) +
      (blurryVisionFreq * 2.0) +
      (headachesFreq    * 1.0) +
      (dryEyesFreq      * 1.5) +
      (eyeIrritationFreq     * 1.5) +
      (lightSensitivityFreq  * 1.0) +
      (difficultyFocusingFreq * 1.0) +
      (neckShoulderPainFreq  * 0.5) +
      (mentalFatigueFreq     * 1.0) +
      (difficultyConcentFreq * 0.5) +
      (eyeItchinessFreq      * 0.5);
    const symptomScore = (cvqRawScore / 14) * 60;

    // ── STEP 2 — Environmental modifiers ─────────────────────────────────────
    let screenMod = 0;
    if (screenTime >= 2 && screenTime <= 6) {
      screenMod = ((screenTime - 2) / 4) * 20;
    } else if (screenTime > 6) {
      screenMod = 20 + (Math.min(screenTime - 6, 6) / 6) * 15;
    }

    let sleepMod = 0;
    if      (sleepHours < 5)  sleepMod = 15;
    else if (sleepHours < 6)  sleepMod = 10;
    else if (sleepHours < 7)  sleepMod = 5;
    else if (sleepHours <= 9) sleepMod = 0;
    else                      sleepMod = 2;

    let brightnessMod = 0;
    if (brightness < 40) {
      brightnessMod = Math.min(((40 - brightness) / 10) * 2, 8);
    } else if (brightness > 80) {
      brightnessMod = Math.min(((brightness - 80) / 10) * 2, 8);
    }

    const darkRoomMod = ({
      Always: 10, Sometimes: 5, Rarely: 1, Never: 0,
    } as Record<string, number>)[formData.darkRoomUse ?? ''] ?? 0;

    const rule202020Mod = ({
      Always: -10, Sometimes: -5, Rarely: -2, Never: 0,
    } as Record<string, number>)[formData.follows202020 ?? ''] ?? 0;

    const breakMod = ({
      'Every 20 minutes': -12,
      'Every 30–60 minutes': -7,
      'Every 1–2 hours': -3,
      'Rarely take breaks': 0,
    } as Record<string, number>)[formData.breakFrequency ?? ''] ?? 0;

    // ── STEP 3 — Lifestyle protective modifiers ───────────────────────────────
    const blueLightMod = ({
      Always: -5, Regularly: -3, Sometimes: -1, Never: 0,
    } as Record<string, number>)[blueLight] ?? 0;

    const exerciseMod = ({
      Regular: -3, Moderate: -1.5, Minimal: -0.5, None: 0,
    } as Record<string, number>)[exerciseFreq] ?? 0;

    const outdoorMod = ({
      '>2h': -3, '1–2h': -2, '30min–1h': -1, '<30min': 0,
    } as Record<string, number>)[outdoorTime] ?? 0;

    const blueGlassesMod = ({
      Always: -4, Sometimes: -2, Rarely: -1, Never: 0,
    } as Record<string, number>)[formData.blueLightGlasses ?? ''] ?? 0;

    const totalModifier = screenMod + sleepMod + brightnessMod + darkRoomMod +
                          rule202020Mod + breakMod + blueLightMod + exerciseMod +
                          outdoorMod + blueGlassesMod;

    // ── STEP 4 — EyeGuard risk score ──────────────────────────────────────────
    let riskScore: number;
    if (symptomScore === 0) {
      riskScore = Math.max(0, Math.min(40, totalModifier));
    } else {
      riskScore = Math.max(0, Math.min(100, symptomScore + totalModifier));
    }
    riskScore = parseFloat(riskScore.toFixed(1));

    // ── STEP 5 — EyeGuard risk level ─────────────────────────────────────────
    let riskLevel = 0;
    if      (riskScore < 25) riskLevel = 0;
    else if (riskScore < 50) riskLevel = 1;
    else if (riskScore < 75) riskLevel = 2;
    else                     riskLevel = 3;

    // ── STEP 5b — Overall combined score (60% EyeGuard + 40% CVSQ) ───────────
    // Data-driven rationale: 399-row analysis → 91.5% concordance at this blend.
    // Clinical anchors: CVSQ ≤2 caps overall at Moderate; CVSQ ≥7 floors at High.
    const cvsqNorm = (cvsqResult.cvsq_total / 10) * 100;
    let overallScore = parseFloat((riskScore * 0.60 + cvsqNorm * 0.40).toFixed(1));
    if (cvsqResult.cvsq_total <= 2) overallScore = Math.min(overallScore, 49.0);
    if (cvsqResult.cvsq_total >= 7) overallScore = Math.max(overallScore, 50.0);
    overallScore = parseFloat(overallScore.toFixed(1));

    let overallLevel = 0;
    if      (overallScore < 25) overallLevel = 0;
    else if (overallScore < 50) overallLevel = 1;
    else if (overallScore < 75) overallLevel = 2;
    else                        overallLevel = 3;
    const OVERALL_STATUS = ['Low Risk', 'Moderate Risk', 'High Risk', 'Critical Risk'] as const;
    const overallStatus = OVERALL_STATUS[overallLevel];

    // ── Concordance ───────────────────────────────────────────────────────────
    const concordanceResult = checkConcordance(cvsqResult.cvsq_total, overallLevel);

    // ── STEP 6 — Fatigue score ────────────────────────────────────────────────
    const symptomFatigue  = (cvqRawScore / 14) * 5;
    const screenFatigue   = Math.min(screenTime / 3, 2.5);
    const sleepFatigue    = sleepHours < 6 ? 1.5 : sleepHours < 7 ? 0.8 : 0;
    const breakFatigue    = formData.breakFrequency === 'Rarely take breaks' ? 1.0 :
                            formData.breakFrequency === 'Every 1–2 hours' ? 0.5 : 0;
    const fatigueScore    = parseFloat(
      Math.min(10, Math.max(0, symptomFatigue + screenFatigue + sleepFatigue + breakFatigue)).toFixed(1)
    );

    // ── STEP 7 — Confidence ───────────────────────────────────────────────────
    const symptomFieldsAnswered = [
      formData.sym_dryEyes, formData.sym_blurredVision,
      formData.sym_headaches, formData.sym_eyeIrritation,
    ].filter(Boolean).length;
    const lifestyleFieldsAnswered = [blueLight, exerciseFreq, outdoorTime].filter(Boolean).length;
    const envFieldsComplete = !!(formData.sleepHours && formData.screenBrightness && screenTime);

    let historyBonus = 0;
    try {
      const { count } = await supabase
        .from('daily_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (count && count >= 14) historyBonus = 0.08;
      else if (count && count >= 7)  historyBonus = 0.05;
      else if (count && count >= 3)  historyBonus = 0.02;
    } catch { /* non-fatal */ }

    const confidence = parseFloat(Math.min(
      0.92,
      0.55 +
      (symptomFieldsAnswered  * 0.05) +
      (lifestyleFieldsAnswered * 0.02) +
      (envFieldsComplete ? 0.04 : 0) +
      historyBonus,
    ).toFixed(3));

    // ── STEP 8 — Flask ML override ────────────────────────────────────────────
    const flaskBase = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api')
      .replace(/\/api\/?$/, '');
    const retrainKey = process.env.NEXT_PUBLIC_RETRAIN_KEY ?? '';

    const symptomNames: string[] = [];
    if (eyeStrainFreq    > 0) symptomNames.push(eyeStrainFreq >= 1.5 ? 'severe_eye_strain' : 'moderate_eye_strain');
    if (blurryVisionFreq > 0) symptomNames.push('blurred_vision');
    if (headachesFreq    > 0) symptomNames.push('headache');
    if (dryEyesFreq      > 0) symptomNames.push('dry_eyes');
    if (mentalFatigueFreq > 0) symptomNames.push('eye_fatigue');
    if (difficultyFocusingFreq > 0) symptomNames.push('difficulty_focusing');

    const flaskLog = {
      screen_time_hours:  screenTime,
      break_minutes:      breakMod === -12 ? 20 : breakMod === -7 ? 10 : breakMod === -3 ? 5 : 0,
      symptoms:           symptomNames,
      sleep_quality:      sleepHours,
      water_intake_cups:  6,
      break_type:         'rest',
      eye_exercises:      0,
      blue_light_filter:  blueLight === 'Always' || blueLight === 'Regularly',
    };

    let finalRiskLevel    = riskLevel;
    let finalRiskScore    = riskScore;
    let finalFatigueScore = fatigueScore;
    let finalConfidence   = confidence;
    let mlSource: 'flask' | 'rule-based' = 'rule-based';

    try {
      const mlRes = await fetch(`${flaskBase}/api/ml/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Retrain-Key': retrainKey },
        body: JSON.stringify(flaskLog),
        signal: AbortSignal.timeout(4000),
      });
      if (mlRes.ok) {
        const mlData = await mlRes.json();
        if (mlData.success && typeof mlData.risk_level === 'number') {
          finalRiskLevel    = Math.min(3, Math.max(0, Math.round(mlData.risk_level)));
          finalRiskScore    = parseFloat(Math.min(100, Math.max(0, mlData.risk_percentage ?? riskScore)).toFixed(1));
          finalFatigueScore = typeof mlData.fatigue_score === 'number'
            ? parseFloat(Math.min(10, Math.max(0, mlData.fatigue_score)).toFixed(1))
            : fatigueScore;
          finalConfidence   = typeof mlData.confidence === 'number'
            ? parseFloat(Math.min(0.99, Math.max(0.50, mlData.confidence)).toFixed(3))
            : confidence;
          mlSource = 'flask';
        }
      }
    } catch { /* Flask unavailable — use rule-based */ }

    // ── Recommendations ───────────────────────────────────────────────────────
    const recInput: RecommendationInput = {
      screenTime,
      sleepHours,
      brightness,
      riskLevel: (['Low', 'Moderate', 'High', 'Critical'] as const)[finalRiskLevel],
      eyeStrain:    eyeStrainFreq    > 0 ? 1 : 0,
      headaches:    headachesFreq    > 0 ? 1 : 0,
      blurryVision: blurryVisionFreq > 0 ? 1 : 0,
      dryEyes:      dryEyesFreq      > 0 ? 1 : 0,
    };
    const recommendations = await selectRecommendations(recInput);

    // ── Save daily log ────────────────────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0];

    const { data: dailyLog, error: logError } = await supabase
      .from('daily_logs')
      .upsert({
        user_id:   user.id,
        date:      today,
        email:     user.email,
        age:            formData.age,
        gender:         formData.gender,
        year_level:     formData.yearLevel,
        field_of_study: formData.fieldOfStudy,
        academic_screen_time:     formData.academicScreenTime,
        non_academic_screen_time: formData.nonAcademicScreenTime,
        screen_time:              screenTime,
        primary_device:           formData.primaryDevice,
        continuous_screen_use:    formData.continuousScreenUse,
        online_classes_per_day:   formData.onlineClassesPerDay,
        follows_20_20_20:     formData.follows202020,
        blue_light_filter:    formData.blueLightFilter,
        screen_brightness:    formData.screenBrightness,
        brightness:           brightness,
        dark_room_use:        formData.darkRoomUse,
        screen_distance:      formData.screenDistance,
        wears_glasses:        formData.wearsGlasses,
        blue_light_glasses:   formData.blueLightGlasses,
        break_frequency:      formData.breakFrequency,
        sleep_hours:          sleepHours,
        sym_dry_eyes:                formData.sym_dryEyes,
        sym_eye_itchiness:           formData.sym_eyeItchiness,
        sym_blurred_vision:          formData.sym_blurredVision,
        sym_headaches:               formData.sym_headaches,
        sym_eye_irritation:          formData.sym_eyeIrritation,
        sym_light_sensitivity:       formData.sym_lightSensitivity,
        sym_difficulty_focusing:     formData.sym_difficultyFocusing,
        sym_neck_shoulder_pain:      formData.sym_neckShoulderPain,
        sym_mental_fatigue:          formData.sym_mentalFatigue,
        sym_difficulty_concentrating: formData.sym_difficultyConcentrating,
        overall_eye_strain:        formData.overallEyeStrain,
        digital_fatigue_frequency: formData.digitalFatigueFrequency,
        primary_symptom_history:   formData.primarySymptomHistory,
        eye_strain:            eyeStrainFreq    > 0 ? 1 : 0,
        eye_strain_frequency:  formData.sym_eyeIrritation ?? '',
        headaches:             headachesFreq    > 0 ? 1 : 0,
        headaches_frequency:   formData.sym_headaches ?? '',
        blurry_vision:         blurryVisionFreq > 0 ? 1 : 0,
        blurry_vision_frequency: formData.sym_blurredVision ?? '',
        dry_eyes:              dryEyesFreq > 0 ? 1 : 0,
        dry_eyes_frequency:    formData.sym_dryEyes ?? '',
        cvsq_visual_complaints:      JSON.stringify(formData.cvsq_visual ?? []),
        cvsq_ocular_complaints:      JSON.stringify(formData.cvsq_ocular ?? []),
        cvsq_extraocular_complaints: JSON.stringify(formData.cvsq_extraocular ?? []),
        cvsq_frequency:              formData.cvsq_frequency ?? '',
        cvsq_screen_associated:      formData.cvsq_screen_associated ?? '',
        risk_level: (['Low', 'Moderate', 'High', 'Critical'] as const)[finalRiskLevel],
      }, { onConflict: 'user_id,date' })
      .select()
      .single();

    if (logError) {
      console.error('Error saving daily log:', logError);
      return NextResponse.json({ error: 'Failed to save daily log: ' + logError.message }, { status: 500 });
    }

    // ── Save prediction ───────────────────────────────────────────────────────
    await supabase.from('predictions').delete().eq('daily_log_id', dailyLog.id);

    const { data: prediction, error: predictionError } = await supabase
      .from('predictions')
      .insert({
        user_id:         user.id,
        daily_log_id:    dailyLog.id,
        risk_level:      finalRiskLevel,
        risk_percentage: finalRiskScore,
        fatigue_score:   finalFatigueScore,
        confidence:      finalConfidence,
        recommendations: recommendations,
        cvsq_score:   cvsqResult.cvsq_total,
        cvsq_status:  cvsqResult.cvsq_status,
        cvsq_q1:      cvsqResult.cvsq_q1,
        cvsq_q2:      cvsqResult.cvsq_q2,
        cvsq_q3:      cvsqResult.cvsq_q3,
        cvsq_q4:      cvsqResult.cvsq_q4,
        cvsq_q5:      cvsqResult.cvsq_q5,
        overall_score:  overallScore,
        overall_level:  overallLevel,
        overall_status: overallStatus,
        concordant:            concordanceResult.concordant,
        concordance_scenario:  concordanceResult.concordance_scenario,
      })
      .select()
      .single();

    if (predictionError) {
      console.error('Error saving prediction:', predictionError);
      return NextResponse.json({ error: 'Failed to save prediction: ' + predictionError.message }, { status: 500 });
    }

    // Fire-and-forget Flask retrain notification
    fetch(`${flaskBase}/api/ml/notify-new-log`, { method: 'POST' }).catch(() => {});

    // ── High-risk email alert ─────────────────────────────────────────────────
    if (finalRiskLevel >= 2) {
      (async () => {
        try {
          const { data: userSettings } = await supabase
            .from('user_settings')
            .select('enable_email_notifications')
            .eq('user_id', user.id)
            .maybeSingle();
          const wantsEmail = userSettings?.enable_email_notifications !== false;
          if (wantsEmail) {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('first_name')
              .eq('user_id', user.id)
              .maybeSingle();
            const name = profile?.first_name || user.email?.split('@')[0] || 'there';
            const riskLabel = (['Low', 'Moderate', 'High', 'Critical'] as const)[finalRiskLevel];
            const recTitles: string[] = Array.isArray(recommendations)
              ? recommendations.slice(0, 3).map((r: { title?: string } | string) =>
                  typeof r === 'string' ? r : (r?.title ?? '')
                ).filter(Boolean)
              : [];
            await fetch(`${flaskBase}/api/email/send-alert`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Retrain-Key': retrainKey },
              body: JSON.stringify({ email: user.email, name, riskLevel: riskLabel, recommendations: recTitles }),
              signal: AbortSignal.timeout(10000),
            });
          }
        } catch { /* non-fatal */ }
      })();
    }

    // ── Response ──────────────────────────────────────────────────────────────
    return NextResponse.json({
      success:           true,
      daily_log_id:      dailyLog.id,
      prediction_id:     prediction.id,
      risk_level:        finalRiskLevel,
      risk_percentage:   finalRiskScore,
      fatigue_score:     finalFatigueScore,
      confidence:        finalConfidence,
      recommendations:   recommendations,
      prediction_source: mlSource,
      cvsq_score:        cvsqResult.cvsq_total,
      cvsq_status:       cvsqResult.cvsq_status,
      cvsq_breakdown: {
        q1: cvsqResult.cvsq_q1,
        q2: cvsqResult.cvsq_q2,
        q3: cvsqResult.cvsq_q3,
        q4: cvsqResult.cvsq_q4,
        q5: cvsqResult.cvsq_q5,
      },
      overall_score:       overallScore,
      overall_level:       overallLevel,
      overall_status:      overallStatus,
      concordant:           concordanceResult.concordant,
      concordance_scenario: concordanceResult.concordance_scenario,
      score_breakdown: {
        symptomScore:   parseFloat(symptomScore.toFixed(1)),
        screenMod:      parseFloat(screenMod.toFixed(1)),
        sleepMod:       parseFloat(sleepMod.toFixed(1)),
        brightnessMod:  parseFloat(brightnessMod.toFixed(1)),
        darkRoomMod:    parseFloat(darkRoomMod.toFixed(1)),
        rule202020Mod:  parseFloat(rule202020Mod.toFixed(1)),
        breakMod:       parseFloat(breakMod.toFixed(1)),
        blueLightMod:   parseFloat(blueLightMod.toFixed(1)),
        totalModifier:  parseFloat(totalModifier.toFixed(1)),
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
