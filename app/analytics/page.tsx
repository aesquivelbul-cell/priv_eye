'use client';

import { Download, TrendingUp, Eye, BarChart3 } from 'lucide-react';
import { MainLayout } from '@/components/main-layout';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const TIME_RANGE_DAYS: Record<string, number> = {
  '7days': 7,
  '30days': 30,
  '90days': 90,
};

function formatDateLabel(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${month}/${day}`;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [timeRange, setTimeRange] = useState('7days');
  const [isLoading, setIsLoading] = useState(true);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [predMap, setPredMap] = useState<Record<string, { risk_percentage: number; fatigue_score: number }>>({});
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/login'); return; }

        const { data: logs, error } = await supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: true });

        if (error) { console.error('Error loading logs:', error); return; }

        const logsArr = logs || [];
        setAllLogs(logsArr);
        setHasData(logsArr.length > 0);

        if (logsArr.length > 0) {
          const logIds = logsArr.map((l: any) => l.id);
          const { data: preds } = await supabase
            .from('predictions')
            .select('daily_log_id, risk_percentage, fatigue_score')
            .in('daily_log_id', logIds);

          const map: Record<string, { risk_percentage: number; fatigue_score: number }> = {};
          (preds || []).forEach((p: any) => {
            map[p.daily_log_id] = {
              risk_percentage: p.risk_percentage ?? 0,
              fatigue_score: p.fatigue_score ?? 0,
            };
          });
          setPredMap(map);
        }
      } catch (err) {
        console.error('Error:', err);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [router, supabase]);

  // Apply time range filter — compare by actual date, not array position
  const days = TIME_RANGE_DAYS[timeRange] ?? 7;
  const filteredLogs = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return allLogs.filter((l: any) => l.date >= cutoffStr);
  }, [allLogs, days]);

  // Build chart points
  const chartPoints = useMemo(() => filteredLogs.flatMap((log: any) => {
    const pred = predMap[log.id];
    if (!pred) return [];
    return [{
      label: formatDateLabel(log.date),
      date: log.date,
      eyeStrain: Number(pred.risk_percentage),
      fatigue: Math.min(Number(pred.fatigue_score) * 10, 100),
      screenTime: Number(log.screen_time) || 0,
    }];
  }), [filteredLogs, predMap]);

  // Derived analytics
  const analytics = useMemo(() => {
    if (filteredLogs.length === 0) return null;
    const n = filteredLogs.length;
    const avgScreenTime = filteredLogs.reduce((s: number, l: any) => s + (l.screen_time || 0), 0) / n;
    const totalHours = filteredLogs.reduce((s: number, l: any) => s + (l.screen_time || 0), 0);

    const eyeStrainCount    = filteredLogs.filter((l: any) => l.sym_eye_irritation   && l.sym_eye_irritation   !== 'Never').length;
    const headachesCount    = filteredLogs.filter((l: any) => l.sym_headaches         && l.sym_headaches         !== 'Never').length;
    const dryEyesCount      = filteredLogs.filter((l: any) => l.sym_dry_eyes          && l.sym_dry_eyes          !== 'Never').length;
    const blurryVisionCount = filteredLogs.filter((l: any) => l.sym_blurred_vision    && l.sym_blurred_vision    !== 'Never').length;

    const symptomFrequency = {
      'Eye Strain': Math.round((eyeStrainCount / n) * 100),
      'Headaches': Math.round((headachesCount / n) * 100),
      'Dry Eyes': Math.round((dryEyesCount / n) * 100),
      'Blurry Vision': Math.round((blurryVisionCount / n) * 100),
    };

    const riskValues = chartPoints.map(p => p.eyeStrain);
    const firstRisk = riskValues[0] ?? 0;
    const previousRisk = riskValues[riskValues.length - 2] ?? null;
    const lastRisk = riskValues[riskValues.length - 1] ?? 0;
    const riskTrend = riskValues.length < 2
      ? 'Insufficient data'
      : lastRisk < (previousRisk as number) - 5 ? 'Improving'
      : lastRisk > (previousRisk as number) + 5 ? 'Worsening'
      : 'Stable';

    const topSymptomEntry = Object.entries(symptomFrequency).sort((a, b) => b[1] - a[1])[0];

    return {
      averageScreenTime: parseFloat(avgScreenTime.toFixed(1)),
      totalHours: parseFloat(totalHours.toFixed(1)),
      trendDirection: riskTrend,
      improving: riskTrend === 'Improving',
      symptomFrequency,
      topSymptom: topSymptomEntry,
      firstRisk,
      previousRisk,
      lastRisk,
    };
  }, [filteredLogs, chartPoints]);

  // Export as XLSX — user's own logs, updated for new questionnaire columns
  const handleExport = async () => {
    if (filteredLogs.length === 0) return;

    const { generateXlsx } = await import('@/lib/xlsx-export');
    type XlsxColumn = import('@/lib/xlsx-export').XlsxColumn;

    const formatDate = (d: string) => {
      if (!d) return '';
      const [y, m, day] = d.split('-');
      return `${m}/${day}/${y}`;
    };
    const s = (v: any) => (v == null ? '' : String(v));

    const columns: XlsxColumn[] = [
      { header: 'Date',                        key: 'Date',                   width: 12 },
      { header: 'Academic Screen Time',        key: 'Academic Screen Time',   width: 22 },
      { header: 'Non-Academic Screen Time',    key: 'Non-Academic Screen Time', width: 24 },
      { header: 'Primary Device',             key: 'Primary Device',         width: 16 },
      { header: '20-20-20 Rule',              key: '20-20-20',               width: 14 },
      { header: 'Blue Light Filter',          key: 'Blue Light Filter',      width: 16 },
      { header: 'Screen Brightness',          key: 'Screen Brightness',      width: 16 },
      { header: 'Dark Room Use',              key: 'Dark Room Use',          width: 14 },
      { header: 'Screen Distance',            key: 'Screen Distance',        width: 16 },
      { header: 'Break Frequency',            key: 'Break Frequency',        width: 20 },
      { header: 'Sleep Hours',               key: 'Sleep Hours',            width: 12 },
      { header: 'Sym: Blurred Vision',        key: 'Blurred Vision',         width: 16 },
      { header: 'Sym: Dry Eyes',             key: 'Dry Eyes',               width: 12 },
      { header: 'Sym: Eye Irritation',        key: 'Eye Irritation',         width: 16 },
      { header: 'Sym: Headaches',            key: 'Headaches',              width: 12 },
      { header: 'Sym: Mental Fatigue',        key: 'Mental Fatigue',         width: 16 },
      { header: 'Sym: Light Sensitivity',     key: 'Light Sensitivity',      width: 18 },
      { header: 'Sym: Difficulty Focusing',   key: 'Difficulty Focusing',    width: 18 },
      { header: 'Sym: Neck/Shoulder Pain',    key: 'Neck Shoulder Pain',     width: 18 },
      { header: 'Overall Eye Strain',         key: 'Overall Eye Strain',     width: 16 },
      { header: 'Digital Fatigue Frequency',  key: 'Digital Fatigue',        width: 20 },
      { header: 'CVS-Q Frequency',            key: 'CVSQ Frequency',         width: 16 },
      { header: 'CVS-Q Screen Associated',    key: 'CVSQ Screen',            width: 18 },
      { header: 'EyeGuard Risk Level',        key: 'Risk Level',             width: 16 },
    ];

    const rows = filteredLogs.map((l: any) => ({
      'Date':                    formatDate(l.date),
      'Academic Screen Time':    s(l.academic_screen_time),
      'Non-Academic Screen Time': s(l.non_academic_screen_time),
      'Primary Device':          s(l.primary_device),
      '20-20-20':                s(l.follows_20_20_20),
      'Blue Light Filter':       s(l.blue_light_filter),
      'Screen Brightness':       s(l.screen_brightness),
      'Dark Room Use':           s(l.dark_room_use),
      'Screen Distance':         s(l.screen_distance),
      'Break Frequency':         s(l.break_frequency),
      'Sleep Hours':             l.sleep_hours ?? '',
      'Blurred Vision':          s(l.sym_blurred_vision),
      'Dry Eyes':                s(l.sym_dry_eyes),
      'Eye Irritation':          s(l.sym_eye_irritation),
      'Headaches':               s(l.sym_headaches),
      'Mental Fatigue':          s(l.sym_mental_fatigue),
      'Light Sensitivity':       s(l.sym_light_sensitivity),
      'Difficulty Focusing':     s(l.sym_difficulty_focusing),
      'Neck Shoulder Pain':      s(l.sym_neck_shoulder_pain),
      'Overall Eye Strain':      s(l.overall_eye_strain),
      'Digital Fatigue':         s(l.digital_fatigue_frequency),
      'CVSQ Frequency':          s(l.cvsq_frequency),
      'CVSQ Screen':             s(l.cvsq_screen_associated),
      'Risk Level':              s(l.risk_level),
    }));

    const xlsx = generateXlsx(rows, columns, 'My Eye Health Data');
    const blob = new Blob([xlsx], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `eyeguard-my-data-${timeRange}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <div className="inline-block p-4 bg-muted rounded-full">
              <BarChart3 className="w-8 h-8 text-primary animate-pulse" />
            </div>
            <p className="text-lg text-muted-foreground">Loading analytics…</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!hasData) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-96 rounded-2xl border-2 border-dashed border-border bg-card/40 m-4 md:m-8">
          <div className="text-center space-y-4 p-8">
            <div className="inline-block p-4 bg-primary/10 rounded-full">
              <Eye className="w-12 h-12 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">No Data Yet</h2>
            <p className="text-muted-foreground max-w-sm">
              Complete the daily log survey to start seeing analytics and insights about your eye health.
            </p>
            <button
              onClick={() => router.push('/daily-log')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
            >
              Start Daily Log
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-[calc(100vh-7rem)] w-full max-w-6xl mx-auto space-y-6 rounded-[2rem]
        bg-[radial-gradient(circle_at_8%_0%,rgba(249,115,22,0.08),transparent_30%),linear-gradient(160deg,rgba(251,191,100,0.10),rgba(249,115,22,0.04)_50%,rgba(180,100,30,0.06))]
        dark:bg-[radial-gradient(circle_at_8%_0%,rgba(249,115,22,0.14),transparent_32%),linear-gradient(135deg,rgba(67,28,12,0.45),rgba(15,10,7,0.08)_52%,rgba(120,53,15,0.12))]
        px-4 py-6 sm:px-8 sm:py-10">

        {/* ── CONTAINER 1 — Header · Metrics · Chart ── */}
        <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-6">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f97316]">Personal health overview</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mt-1">Analytics & Insights</h1>
              <p className="text-muted-foreground text-sm mt-1">Analyse your eye health trends over time</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="7days">Last 7 days</option>
                <option value="30days">Last 30 days</option>
                <option value="90days">Last 90 days</option>
              </select>
              <button
                onClick={handleExport}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all
                  bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/25
                  hover:from-amber-400 hover:to-orange-400 hover:shadow-orange-400/35 hover:scale-[1.02]
                  dark:from-amber-600 dark:to-orange-600"
              >
                <Download className="w-4 h-4" />
                Export Report
              </button>
            </div>
          </div>

          {/* Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-background/60 p-4">
              <p className="text-xs text-muted-foreground mb-1">Average Daily Screen Time</p>
              <p className="text-2xl font-bold text-foreground">{analytics?.averageScreenTime || 0}<span className="text-sm font-normal text-muted-foreground ml-1">hours</span></p>
            </div>
            <div className="rounded-xl border border-border bg-background/60 p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Hours This Period</p>
              <p className="text-2xl font-bold text-foreground">{analytics?.totalHours || 0}<span className="text-sm font-normal text-muted-foreground ml-1">hours</span></p>
              <p className="text-xs text-muted-foreground mt-0.5">Over {filteredLogs.length} logged day{filteredLogs.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="rounded-xl border border-border bg-background/60 p-4">
              <p className="text-xs text-muted-foreground mb-1">Trend Direction</p>
              <p className={`text-2xl font-bold ${
                analytics?.trendDirection === 'Improving' ? 'text-green-600 dark:text-green-400' :
                analytics?.trendDirection === 'Worsening' ? 'text-red-600 dark:text-red-400' :
                'text-yellow-600 dark:text-yellow-400'
              }`}>{analytics?.trendDirection || 'Stable'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {analytics?.trendDirection === 'Improving' ? 'Lower than previous log' :
                 analytics?.trendDirection === 'Worsening' ? 'Higher than previous log' :
                 analytics?.trendDirection === 'Insufficient data' ? 'Need more predictions' : 'Similar to previous log'}
              </p>
            </div>
          </div>

          {/* Chart */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">Risk and Fatigue Over Time</p>
            <p className="text-xs text-muted-foreground mb-4">{days}-day trend · missing predictions excluded</p>
            <div className="h-64">
              {chartPoints.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No predictions for this range</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartPoints} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" width={36} />
                    <Tooltip
                      formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name === 'eyeStrain' ? 'Risk' : 'Fatigue (×10)']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
                    />
                    <Line type="monotone" dataKey="eyeStrain" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="fatigue" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5 bg-red-500 rounded" /> Risk %</div>
              <div className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5 bg-yellow-500 rounded" style={{ backgroundImage: 'repeating-linear-gradient(to right, #f59e0b 0, #f59e0b 4px, transparent 4px, transparent 6px)' }} /> Fatigue ×10</div>
            </div>
          </div>
        </div>

        {/* ── CONTAINER 2 — Symptom Frequency + What They May Indicate ── */}
        <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-6">
          <div className="border-b border-border pb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f97316]">Symptom tracking</p>
            <h2 className="text-xl font-bold text-foreground mt-1">Symptom Frequency Analysis</h2>
          </div>

          {/* Frequency bars */}
          <div className="space-y-4">
            {analytics && Object.entries(analytics.symptomFrequency).map(([symptom, frequency]) => (
              <div key={symptom} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{symptom}</span>
                  <span className="text-sm font-bold text-primary">{frequency as number}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (frequency as number) >= 60 ? 'bg-red-500' :
                      (frequency as number) >= 30 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${frequency}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* What they indicate */}
          <div className="border-t border-border pt-5">
            <p className="text-sm font-semibold text-foreground mb-3">What These Symptoms May Indicate</p>
            <p className="text-xs text-muted-foreground mb-4">Common screen-use contributors — not a diagnosis</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ['Eye Strain',    'Often associated with prolonged near focus, glare, small text, or infrequent blinking.'],
                ['Headaches',     'May be linked to visual effort, glare, poor viewing distance, posture, dehydration, or insufficient sleep.'],
                ['Dry Eyes',      'Commonly associated with reduced blinking during screen use, airflow, low humidity, or contact-lens irritation.'],
                ['Blurry Vision', 'Can occur with prolonged focusing, uncorrected vision needs, fatigue, or temporary tear-film instability.'],
              ].map(([symptom, explanation]) => (
                <div key={symptom} className="rounded-xl border border-border bg-background/60 p-4">
                  <p className="text-sm font-semibold text-foreground">{symptom}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground mt-1.5">{explanation}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4 border-t border-border pt-4">
              These are possible contributors, not proof of a medical condition. Persistent, severe, or worsening symptoms should be assessed by a licensed eye-care professional.
            </p>
          </div>
        </div>

        {/* ── CONTAINER 3 — Key Insights ── */}
        <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-4">
          <div className="border-b border-border pb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f97316]">Personalised summary</p>
            <h2 className="text-xl font-bold text-foreground mt-1">Key Insights</h2>
          </div>

          {analytics && (
            <div className="space-y-3">
              {/* Trend insight */}
              <div className={`p-4 rounded-xl border ${
                analytics.improving
                  ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                  : analytics.trendDirection === 'Worsening'
                  ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                  : 'bg-[#f97316]/5 border-[#f97316]/20'
              }`}>
                <p className={`text-sm font-semibold ${
                  analytics.improving ? 'text-green-700 dark:text-green-300' :
                  analytics.trendDirection === 'Worsening' ? 'text-red-700 dark:text-red-300' :
                  'text-[#f97316]'
                }`}>
                  {analytics.improving ? '✓ Improving Trend'
                    : analytics.trendDirection === 'Worsening' ? '⚠ Worsening Trend'
                    : analytics.trendDirection === 'Insufficient data' ? '→ More Data Needed'
                    : '→ Stable Trend'}
                </p>
                <p className={`text-sm mt-1.5 ${
                  analytics.improving ? 'text-green-700 dark:text-green-400' :
                  analytics.trendDirection === 'Worsening' ? 'text-red-700 dark:text-red-400' :
                  'text-muted-foreground'
                }`}>
                  {analytics.improving
                    ? 'Your risk level has improved compared to your earliest logged entry. Keep up the good habits.'
                    : analytics.trendDirection === 'Worsening'
                    ? 'Your risk level has increased. Consider reducing screen time and taking more breaks.'
                    : analytics.trendDirection === 'Insufficient data'
                    ? 'Log more days with predictions to identify a reliable trend.'
                    : 'Your risk level has been consistent across this period.'}
                </p>
              </div>

              {/* Top symptom */}
              {analytics.topSymptom && analytics.topSymptom[1] > 0 && (
                <div className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">⚠ Most Frequent Symptom</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1.5">
                    <strong>{analytics.topSymptom[0]}</strong> appears in {analytics.topSymptom[1]}% of your logs.
                    {analytics.topSymptom[0] === 'Dry Eyes'      ? ' Consider using lubricating eye drops and a humidifier.' : ''}
                    {analytics.topSymptom[0] === 'Eye Strain'    ? ' Try the 20-20-20 rule and adjust your monitor distance.' : ''}
                    {analytics.topSymptom[0] === 'Headaches'     ? ' Check your monitor position and reduce glare.' : ''}
                    {analytics.topSymptom[0] === 'Blurry Vision' ? ' Take more frequent breaks and consider an eye exam.' : ''}
                  </p>
                </div>
              )}

              {/* Screen time */}
              <div className="p-4 rounded-xl bg-[#f97316]/5 border border-[#f97316]/20">
                <p className="text-sm font-semibold text-[#f97316]">💡 Based on Your Data</p>
                <p className="text-sm text-muted-foreground mt-1.5">
                  Your average screen time is <strong className="text-foreground">{analytics.averageScreenTime}h/day</strong>.{' '}
                  {analytics.averageScreenTime > 8
                    ? 'This exceeds the recommended 8-hour limit — consider scheduling screen-free recovery time.'
                    : 'This is within a manageable range. Keep maintaining healthy screen habits.'}
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </MainLayout>
  );
}
