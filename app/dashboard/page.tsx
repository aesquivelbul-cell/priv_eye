'use client';

import { useRouter } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import {
  Eye, AlertCircle, Clock,
  Flame, AlertTriangle, Activity, Users, Lightbulb, ArrowRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { MainLayout } from '@/components/main-layout';
import { MetricCard } from '@/components/dashboard-card';
import { Button } from '@/components/form-components';
import { isAdmin } from '@/lib/admin-guard';

/* ── Section icon ───────────────────────────────────────────────────── */
function SectionIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="w-6 h-6 rounded-md bg-[#f97316]/15 flex items-center justify-center text-[#f97316] flex-shrink-0">
      {icon}
    </div>
  );
}

/* ── Card wrapper — theme-aware, no hardcoded dark colours ─────────── */
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card/80 p-6 ${className}`}>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const router  = useRouter();
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? createClient() : null;

  const [user,        setUser]        = useState<any>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [prediction,  setPrediction]  = useState<any>(null);
  const [hasData,     setHasData]     = useState(false);
  const [analytics,   setAnalytics]   = useState<any>(null);
  const [streak,      setStreak]      = useState(0);
  const [groupAvg,    setGroupAvg]    = useState<any>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (!supabase) { router.push('/login'); return; }
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) { router.push('/login'); return; }

        const admin = isAdmin(authUser);
        setIsAdminUser(admin);
        if (admin) {
          const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
          const hasUserCookie = typeof document !== 'undefined' && document.cookie.split('; ').some((c) => c === 'view_as_user=true');
          const viewingAsUser =
            (urlParams && urlParams.get('view') === 'user') ||
            hasUserCookie ||
            (typeof window !== 'undefined' && sessionStorage.getItem('view_as_user') === 'true');

          if (!viewingAsUser) {
            router.replace('/admin/dashboard');
            return;
          }
        }

        const { data: profile } = await supabase
          .from('user_profiles').select('*').eq('user_id', authUser.id).maybeSingle();

        const pFirst = (profile?.first_name || '').trim();
        const pLast  = (profile?.last_name || '').trim();
        const metaName = (authUser.user_metadata?.name || authUser.user_metadata?.full_name || '').trim();
        const emailFallback = (authUser.email || '').split('@')[0] || 'User';

        let displayName = '';
        if (pFirst && pLast) {
          displayName = `${pFirst} ${pLast}`;
        } else if (pFirst) {
          displayName = pFirst;
        } else if (metaName) {
          displayName = metaName;
        } else {
          displayName = emailFallback;
        }

        setUser({ ...authUser, profile: profile || null, displayName });

        const { data: logs } = await supabase
          .from('daily_logs').select('*').eq('user_id', authUser.id)
          .order('created_at', { ascending: false });

        if (logs && logs.length > 0) {
          setHasData(true);

          // Streak calculation
          const logDates = new Set(logs.map((l: any) => l.date));
          let s = 0;
          const d = new Date(); d.setHours(0, 0, 0, 0);
          while (logDates.has(d.toISOString().split('T')[0])) { s++; d.setDate(d.getDate() - 1); }
          setStreak(s);

          fetch('/api/stats/averages').then(r => r.json()).then(setGroupAvg).catch(() => {});

          const { data: predictions } = await supabase
            .from('predictions').select('*').eq('user_id', authUser.id)
            .order('created_at', { ascending: false }).limit(1).single();
          if (predictions) setPrediction(predictions);

          const n = logs.length;
          const avg = (key: string) => logs.reduce((s: number, l: any) => s + (l[key] || 0), 0) / n;
          setAnalytics({
            averageScreenTime:  avg('screen_time').toFixed(1),
            averageSleepHours:  avg('sleep_hours').toFixed(1),
            averageBrightness:  avg('brightness').toFixed(0),
            totalLogsRecorded:  n,
          });
        } else {
          setHasData(false);
        }
      } catch { router.push('/login'); }
      finally { setIsLoading(false); }
    };
    checkAuth();
  }, [router, supabase]);

  useEffect(() => {
    if (!isLoading && !hasData) router.push('/daily-log');
  }, [hasData, isLoading, router]);

  if (isLoading || !hasData) return (
    <MainLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="inline-block p-4 bg-[#f97316]/10 rounded-full">
            <Eye className="w-8 h-8 text-[#f97316] animate-pulse" />
          </div>
          <p className="text-muted-foreground">{isLoading ? 'Loading your dashboard…' : 'Redirecting…'}</p>
        </div>
      </div>
    </MainLayout>
  );

  /* ── Risk colour helpers ─────────────────────────────────────────── */
  const rl = prediction?.risk_level ?? 0;
  const riskText  = rl === 0 ? 'text-green-600 dark:text-green-400'  : rl === 1 ? 'text-yellow-600 dark:text-yellow-400' : rl === 2 ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400';
  const riskBg    = rl === 0 ? 'bg-green-500/8 border-green-500/20'  : rl === 1 ? 'bg-yellow-500/8 border-yellow-500/20' : rl === 2 ? 'bg-orange-500/8 border-orange-500/20' : 'bg-red-500/8 border-red-500/20';
  const riskIcon  = rl === 0 ? 'text-green-500/50'  : rl === 1 ? 'text-yellow-500/50' : rl === 2 ? 'text-orange-500/50' : 'text-red-500/50';

  return (
    <MainLayout>
      {/* ── Page wrapper — light: warm cream gradient, dark: deep amber ── */}
      <div className="min-h-[calc(100vh-7rem)] w-full max-w-6xl mx-auto space-y-8
        rounded-[2rem] px-4 py-6 sm:px-8 sm:py-10
        bg-[radial-gradient(circle_at_8%_0%,rgba(249,115,22,0.08),transparent_30%),linear-gradient(160deg,rgba(251,191,100,0.10),rgba(249,115,22,0.04)_50%,rgba(180,100,30,0.06))]
        dark:bg-[radial-gradient(circle_at_8%_0%,rgba(249,115,22,0.14),transparent_32%),linear-gradient(135deg,rgba(67,28,12,0.45),rgba(15,10,7,0.08)_52%,rgba(120,53,15,0.12))]">
        {/* ── Admin Preview Banner (shown when Admin views User Dashboard) ── */}
        {isAdminUser && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-[#f97316]/30 bg-[#f97316]/10 text-foreground shadow-sm">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#f97316]/20 flex items-center justify-center text-[#f97316] shrink-0 font-bold text-xs">
                ADM
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Admin Mode: Viewing Student Dashboard
                </p>
                <p className="text-xs text-muted-foreground">
                  You are previewing the student-facing dashboard experience.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  sessionStorage.removeItem('view_as_user');
                  document.cookie = 'view_as_user=; path=/; max-age=0; SameSite=Lax';
                }
                router.push('/admin/dashboard');
              }}
              className="self-start sm:self-auto px-4 py-2 rounded-xl bg-[#f97316] text-[#0f0a07] font-semibold text-xs hover:bg-[#fb923c] transition-colors shrink-0 shadow-sm flex items-center gap-1.5"
            >
              Return to Admin Dashboard
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── Risk alert banner ─────────────────────────────────────── */}
        {prediction && rl >= 2 && (
          <div className={`flex items-start gap-4 p-4 rounded-xl border ${
            rl === 3
              ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700'
              : 'bg-orange-50 dark:bg-orange-950/20 border-orange-300 dark:border-orange-700'
          }`}>
            <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${rl === 3 ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${rl === 3 ? 'text-red-700 dark:text-red-400' : 'text-orange-700 dark:text-orange-400'}`}>
                {rl === 3 ? 'Critical eye strain risk detected' : 'High eye strain risk detected'}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Your latest risk score is <strong className="text-foreground">{prediction.risk_percentage?.toFixed(1)}%</strong>.
                {rl === 3 ? ' Rest your eyes now and reduce screen time today.' : ' Follow the recommendations below to bring your risk down.'}
              </p>
            </div>
            <button
              onClick={() => router.push('/risk-prediction')}
              className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                rl === 3
                  ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/30'
                  : 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-500/30'
              }`}
            >
              View Details
            </button>
          </div>
        )}

        {/* ── Page header ───────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Welcome back, {user?.displayName || 'User'}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Eye health analysis powered by machine learning</p>
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={() => router.push('/daily-log')}
            className="flex items-center gap-2 self-start sm:self-auto"
          >
            <Clock className="w-4 h-4" />
            Log Today
          </Button>
        </div>

        {prediction ? (
          <div className="space-y-6">

            {/* ── Metric cards ─────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Risk card */}
              <div className={`rounded-xl border p-5 ${riskBg}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Eye Strain Risk</p>
                    <p className={`text-3xl font-bold tabular-nums ${riskText}`}>
                      {prediction.risk_percentage?.toFixed(1) ?? '—'}%
                    </p>
                    <p className={`text-sm font-semibold mt-1 ${riskText}`}>
                      {['Low', 'Moderate', 'High', 'Critical'][rl] ?? '—'}
                    </p>
                  </div>
                  <Eye className={`w-8 h-8 mt-1 ${riskIcon}`} />
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push('/history')}
                className="text-left w-full transition-transform hover:-translate-y-0.5 focus:outline-none cursor-pointer"
              >
                <MetricCard
                  title="Total Logs"
                  value={analytics?.totalLogsRecorded ?? '0'}
                  description="Logs recorded • View history & report"
                  icon={<Activity className="w-5 h-5 text-primary" />}
                />
              </button>
              <MetricCard
                title="Logging Streak"
                value={streak}
                unit={streak === 1 ? ' day' : ' days'}
                description={streak >= 7 ? 'On fire! 🔥' : streak >= 3 ? 'Keep it up!' : 'Log daily'}
                icon={<Flame className={`w-5 h-5 ${streak >= 7 ? 'text-[#f97316]' : streak >= 3 ? 'text-yellow-500' : 'text-muted-foreground'}`} />}
              />
            </div>

            {/* ── Two-column section: peer comparison + nudge ──────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Peer comparison */}
              {groupAvg && analytics && (
                <Card>
                  <div className="flex items-center gap-2 mb-1">
                    <SectionIcon icon={<Users className="w-3.5 h-3.5" />} />
                    <h3 className="text-sm font-semibold text-foreground">How You Compare</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-5 ml-8">
                    vs. average of {groupAvg.totalRespondents} users
                  </p>
                  <div className="space-y-4">
                    {[
                      { label: 'Screen Time', yours: parseFloat(analytics.averageScreenTime), avg: groupAvg.avgScreenTime, unit: 'h',  lowerIsBetter: true },
                      { label: 'Sleep Hours', yours: parseFloat(analytics.averageSleepHours),  avg: groupAvg.avgSleepHours,  unit: 'h',  lowerIsBetter: false },
                      { label: 'Brightness',  yours: parseInt(analytics.averageBrightness),    avg: groupAvg.avgBrightness,  unit: '%',  lowerIsBetter: false, optimal: 70 },
                    ].map(({ label, yours, avg, unit, lowerIsBetter, optimal }) => {
                      const better = optimal
                        ? Math.abs(yours - optimal) <= Math.abs(avg - optimal)
                        : lowerIsBetter ? yours <= avg : yours >= avg;
                      return (
                        <div key={label}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm text-muted-foreground">{label}</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-semibold ${better ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                You: {yours}{unit}
                              </span>
                              <span className="text-xs text-muted-foreground">vs {avg}{unit}</span>
                              <span className={`text-xs font-bold ${better ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                {better ? '✓' : '↑'}
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full bg-border overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${better ? 'bg-green-500' : 'bg-orange-500'}`}
                              style={{ width: `${Math.min(100, (yours / (avg * 1.5)) * 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* ── Your next best action — own card ─────────────── */}
              {prediction.recommendations?.length > 0 && (
                <Card>
                  <div className="flex items-center gap-2 mb-4">
                    <SectionIcon icon={<Lightbulb className="w-3.5 h-3.5" />} />
                    <h3 className="text-sm font-semibold text-foreground">Your next best action</h3>
                  </div>
                  <ul className="space-y-3">
                    {(() => {
                      // Dedup by title before slicing
                      const seen = new Set<string>()
                      const uniqueRecs = prediction.recommendations.filter((r: unknown) => {
                        let title = ''
                        if (typeof r === 'string') { try { const p = JSON.parse(r); title = p?.title ?? r } catch { title = r } }
                        else title = (r as any)?.title ?? ''
                        if (seen.has(title)) return false
                        seen.add(title)
                        return true
                      })
                      return uniqueRecs.slice(0, 3).map((rawRec: unknown, idx: number) => {
                        let rec = rawRec;
                        if (typeof rawRec === 'string') {
                          try { const p = JSON.parse(rawRec); if (p?.title) rec = p; } catch { /* plain */ }
                        }
                        if (typeof rec === 'string') return (
                          <li key={idx} className="flex items-start gap-3">
                            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#f97316]/60 flex-shrink-0" />
                            <span className="text-sm text-foreground">{rec}</span>
                          </li>
                        );
                        const r = rec as { title: string; description?: string };
                        return (
                          <li key={idx} className="flex items-start gap-3 py-1">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#f97316] flex-shrink-0" />
                            <div>
                              <p className="text-sm font-semibold text-foreground">{r.title}</p>
                              {r.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{r.description}</p>
                              )}
                            </div>
                          </li>
                        );
                      });
                    })()}
                  </ul>
                  <button
                    onClick={() => router.push('/risk-prediction')}
                    className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[#f97316] hover:text-[#fb923c] transition-colors"
                  >
                    See full assessment
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </Card>
              )}
            </div>

          </div>
        ) : (
          /* ── No prediction yet ──────────────────────────────────── */
          <div className="rounded-xl border-2 border-dashed border-border bg-card/40 p-10 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#f97316]/10 mx-auto">
              <AlertCircle className="w-7 h-7 text-[#f97316]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">No prediction yet</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Your log was saved but a risk score hasn't been generated. Submit today's log to get your first prediction.
              </p>
            </div>
            <Button variant="primary" size="lg" onClick={() => router.push('/daily-log')} className="inline-flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Log Today's Data
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
