'use client';

import Image from 'next/image';
import { Zap, Shield, MessageCircle, ArrowRight, CheckCircle, Menu, X, CalendarDays, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface PublicStats {
  respondents: number;
  logsRecorded: number;
  predictionsGenerated: number;
}

interface Feature {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  desc: string;
  href: string;
  detail: {
    heading: string;
    bullets: string[];
  };
}

const MASCOTS = ['/mascot2.png', '/mascot.png'] as const;

export default function Home() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [mascotIndex, setMascotIndex] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState<Feature | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/public/stats')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setMascotIndex((i) => (i + 1) % MASCOTS.length);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'How It Works', href: '#how' },
  ];

  return (
    <div className="min-h-screen bg-[#0f0a07] text-[#fff7ed] flex flex-col overflow-x-hidden">
      {/* ── Top nav (16personalities-style) ─────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-orange-500/15 bg-[#0f0a07]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-5 sm:px-8 h-[4.5rem]">
          <a href="/" className="flex items-center shrink-0 gap-3">
            <Image
              src="/logo-mark.png"
              alt=""
              width={56}
              height={56}
              className="h-12 w-12 sm:h-14 sm:w-14 object-contain"
              priority
            />
            <span className="text-xl sm:text-2xl font-bold tracking-tight">
              Eye<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f97316] to-[#fb923c]">Guard</span>
            </span>
          </a>

          <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm text-[#fff7ed]/70 hover:text-[#fb923c] transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2">
            <a
              href="/login"
              className="text-sm text-[#fff7ed]/70 hover:text-[#fff7ed] transition-colors px-3 py-2"
            >
              Login
            </a>
            <a
              href="/signup"
              className="text-sm px-4 py-2 rounded-full bg-gradient-to-r from-[#f97316] to-[#fb923c] text-[#0f0a07] font-semibold hover:opacity-90 transition-opacity"
            >
              Get Started
            </a>
          </div>

          <button
            type="button"
            className="md:hidden p-2 text-[#fff7ed]/80"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-orange-500/15 px-5 py-4 space-y-1 bg-[#0f0a07]">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="block py-2.5 text-sm text-[#fff7ed]/80 hover:text-[#fb923c]"
              >
                {l.label}
              </a>
            ))}
            <div className="flex gap-2 pt-3">
              <a href="/login" className="flex-1 text-center text-sm py-2.5 rounded-lg border border-white/15">
                Login
              </a>
              <a
                href="/signup"
                className="flex-1 text-center text-sm py-2.5 rounded-lg bg-gradient-to-r from-[#f97316] to-[#fb923c] text-[#0f0a07] font-semibold"
              >
                Get Started
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* ── Split Hero — centered text + mascot ─────────────────────── */}
      <section className="relative min-h-[calc(100vh-4.5rem)] flex items-center overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[640px] bg-[#f97316]/[0.07] rounded-full blur-3xl pointer-events-none eg-glow-orb" />

        <div className="relative w-full max-w-6xl mx-auto px-6 sm:px-10 py-14 lg:py-0 grid lg:grid-cols-[1fr_1fr] gap-6 lg:gap-4 items-center">
          {/* Copy */}
          <div className="relative flex flex-col justify-center lg:pr-2">
            <div className="inline-flex items-center gap-2 self-start px-3.5 py-1.5 rounded-full border border-[#f97316]/35 bg-[#f97316]/10 text-[#fb923c] text-xs font-semibold mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f97316] animate-pulse" />
              Machine Learning Research Project
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold leading-[1.1] tracking-tight max-w-lg">
              Understand Your Screen Time,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f97316] to-[#fb923c]">
                Predict Your Eye Health Risk
              </span>
            </h1>

            <p className="text-base sm:text-lg text-[#fff7ed]/55 max-w-md mt-5 leading-relaxed">
              EyeGuard is a web-based research system designed for college students to analyze screen time and self-reported symptoms related to eye strain and digital fatigue. Using machine learning, EyeGuard predicts risk levels and provides preventive recommendations to promote healthier screen usage habits.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <a
                href="/signup"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-[#f97316] to-[#fb923c] text-[#0f0a07] font-semibold hover:opacity-90 transition-all shadow-lg shadow-[#f97316]/25 hover:-translate-y-0.5"
              >
                Try the Prototype
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full border border-[#fff7ed]/20 text-[#fff7ed]/80 font-semibold hover:bg-[#fff7ed]/5 hover:border-[#fff7ed]/30 transition-all"
              >
                Learn More
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-8 text-xs text-[#fff7ed]/40">
              {['Machine learning powered', 'Free to try', 'Built for students'].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-[#f97316]/70" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Mascot */}
          <div className="relative flex items-center justify-center lg:justify-end">
            <div className="relative eg-float w-[280px] sm:w-[340px] lg:w-[420px] aspect-square">
              {MASCOTS.map((src, i) => (
                <Image
                  key={src}
                  src={src}
                  alt={i === 0 ? 'EyeGuard mascot waving' : 'EyeGuard mascot polishing'}
                  fill
                  sizes="420px"
                  className="object-contain transition-opacity duration-700 ease-in-out"
                  style={{ opacity: mascotIndex === i ? 1 : 0 }}
                  priority={i === 0}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────────────────── */}
      <section id="how" className="scroll-mt-20">
        <div className="max-w-4xl mx-auto grid grid-cols-3 divide-x divide-orange-500/15 px-6 py-10">
          {[
            { label: 'Users Tracked',    value: stats ? fmt(stats.respondents)           : null, color: 'text-[#f97316]'  },
            { label: 'Daily Logs Recorded',    value: stats ? fmt(stats.logsRecorded)           : null, color: 'text-[#fb923c]'  },
            { label: 'Predictions Generated',  value: stats ? fmt(stats.predictionsGenerated)   : null, color: 'text-[#fdba74]'  },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center px-4">
              {value !== null ? (
                <p className={`text-3xl sm:text-4xl font-bold tabular-nums ${color}`}>{value}</p>
              ) : (
                <div className="mx-auto h-9 w-16 rounded-lg bg-[#fff7ed]/10 animate-pulse" />
              )}
              <p className="text-xs text-[#fff7ed]/45 mt-2">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section id="features" className="px-6 sm:px-10 py-24 max-w-6xl mx-auto w-full scroll-mt-20">
        <div className="text-center mb-14">
          <p className="text-xs text-[#f97316] font-semibold tracking-widest uppercase mb-3">What EyeGuard Does</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#fff7ed]">
            Everything you need to monitor eye health
          </h2>
          <p className="text-[#fff7ed]/50 mt-4 max-w-xl mx-auto text-sm leading-relaxed">
            Log daily habits, get a risk score based on validated research, and receive
            actionable recommendations — all in one place.
          </p>
        </div>

          {(() => {
          const features: Feature[] = [
            {
              icon: <Image src="/icon_reference.png" alt="Daily log" width={20} height={20} className="object-contain" />,
              iconBg: 'bg-[#f97316]/15 text-[#fb923c] ',
              title: 'Daily Eye Health Log',
              desc: 'Record screen time, symptoms, sleep, and environment each day. Takes under 5 minutes.',
              href: '/daily-log',
              detail: {
                heading: 'Build a clear picture of your daily habits',
                bullets: [
                  'Track screen hours, brightness, and device usage',
                  'Log symptoms like dryness, blurred vision, or headaches',
                  'Record sleep duration and outdoor time',
                  'Only takes 3–5 minutes per day',
                  'All data stays private and linked to your account',
                ],
              },
            },
            {
              icon: <Image src="/icon_reference.png" alt="Risk scoring" width={20} height={20} className="object-contain" />,
              iconBg: 'bg-[#fb923c]/15 text-[#fb923c]',
              title: 'Eye Strain Risk Scoring',
              desc: 'Risk is calculated using a research-backed model trained on published eye health guidelines and clinical symptom data.',
              href: '/risk-prediction',
              detail: {
                heading: 'Science-backed eye strain scoring',
                bullets: [
                  'Based on published clinical research and eye health guidelines',
                  'Scores range across Low, Moderate, High, and Critical',
                  'Powered by a trained machine-learning model',
                  'Updates automatically as you log more data',
                  'See how individual factors contribute to your risk',
                ],
              },
            },
            {
              icon: <Image src="/icon_reference.png" alt="Smart recommendations" width={20} height={20} className="object-contain" />,
              iconBg: 'bg-[#fdba74]/15 text-[#fdba74]',
              title: 'Smart Recommendations',
              desc: 'Get personalized advice based on your actual data — screen time, brightness, sleep, and reported symptoms.',
              href: '/ai-assistant',
              detail: {
                heading: 'Actionable advice tailored to you',
                bullets: [
                  'Recommendations generated from your own logs',
                  'Covers screen breaks, lighting, hydration, and sleep',
                  'Prioritises the most impactful changes first',
                  'Updates each time a new prediction is made',
                  'Evidence-based guidance you can act on today',
                ],
              },
            },
          ];

          return (
            <>
              <div id="scoring" className="grid grid-cols-1 md:grid-cols-3 gap-6 scroll-mt-20">
                {features.map((f, i) => (
                  <button
                    key={f.title}
                    type="button"
                    onClick={() => setActiveFeature(f)}
                    className="group text-left p-6 md:p-8 rounded-2xl border border-orange-500/12 bg-[#f97316]/[0.02] hover:bg-[#f97316]/[0.04] hover:border-[#f97316]/25 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316]/60 overflow-hidden"
                  >
                    <div className="flex items-center gap-5">
                      <div
                        className="w-24 h-24 md:w-28 md:h-28 rounded-lg bg-center bg-no-repeat flex-shrink-0 shadow-sm flex items-center justify-center"
                        style={{
                          backgroundImage: `url('/icon_reference.png')`,
                          backgroundSize: '300% 100%',
                          backgroundPosition: `${i === 0 ? '0% 50%' : i === 1 ? '50% 50%' : '100% 50%'}`,
                        }}
                        aria-hidden
                      />

                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-[#f97316] font-semibold mb-1">Step {i + 1}</div>
                        <h3 className="text-lg md:text-xl font-semibold text-[#fff7ed]">{f.title}</h3>
                        <p className="text-sm text-[#fff7ed]/85 mt-2 leading-snug break-words">{f.desc}</p>

                        <div className="mt-3">
                          <span className="inline-flex items-center gap-2 text-sm text-[#f97316] font-medium">
                            Learn more <ArrowRight className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Feature detail modal */}
              {activeFeature && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                  role="dialog"
                  aria-modal="true"
                  aria-label={activeFeature.title}
                >
                  {/* Backdrop */}
                  <div
                    className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                    onClick={() => setActiveFeature(null)}
                  />

                  {/* Panel */}
                  <div className="relative w-full max-w-md rounded-3xl border border-orange-500/25 bg-[#1a1008] shadow-2xl shadow-black/60 p-8">
                    <button
                      type="button"
                      onClick={() => setActiveFeature(null)}
                      className="absolute top-4 right-4 p-1.5 rounded-full text-[#fff7ed]/40 hover:text-[#fff7ed]/80 hover:bg-white/5 transition-colors"
                      aria-label="Close"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left: interactive preview */}
                      <div className="p-4 rounded-2xl border border-white/5 bg-[#0f0a07] flex flex-col items-center gap-4">
                        <div className="w-40 h-40 flex items-center justify-center">
                          {/* Donut chart mockup */}
                          <svg viewBox="0 0 36 36" className="w-36 h-36">
                            <defs>
                              <linearGradient id="pvGrad" x1="0%" x2="100%">
                                <stop offset="0%" stopColor="#ffd8b5" />
                                <stop offset="100%" stopColor="#f97316" />
                              </linearGradient>
                            </defs>
                            <path d="M18 2.0845
                              a 15.9155 15.9155 0 0 1 0 31.831
                              a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none" stroke="#2b1a13" strokeWidth="3" opacity="0.25" />
                            <path
                              d="M18 2.0845
                              a 15.9155 15.9155 0 0 1 0 31.831"
                              fill="none"
                              stroke="url(#pvGrad)"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeDasharray={((activeFeature.title === 'Daily Eye Health Log' ? 75 : activeFeature.title === 'Eye Strain Risk Scoring' ? 62 : 88) * 0.628) + ' 100'}
                            />
                            <text x="18" y="20.5" textAnchor="middle" className="text-sm font-semibold" fill="#fff7ed" style={{fontSize: '7px'}}> 
                              {(activeFeature.title === 'Daily Eye Health Log' ? 75 : activeFeature.title === 'Eye Strain Risk Scoring' ? 62 : 88)}%
                            </text>
                          </svg>
                        </div>

                        <div className="w-full">
                          <ul className="space-y-2">
                            {['Screen time logged', 'Symptoms recorded', 'Brightness set'].map((t, i) => (
                              <li key={t} className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-3 text-[#fff7ed]/80">
                                  <span className={`w-7 h-7 rounded-full flex items-center justify-center ${i === 0 ? 'bg-[#f97316]/20 text-[#f97316]' : i === 1 ? 'bg-[#fb923c]/20 text-[#fb923c]' : 'bg-[#fdba74]/20 text-[#fdba74]'}`}>
                                    <CheckCircle className="w-4 h-4" />
                                  </span>
                                  {t}
                                </span>
                                <span className="text-xs text-[#fff7ed]/50">{i === 0 ? '1.8h' : i === 1 ? '3' : 'Medium'}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Right: text + bullets */}
                      <div>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${activeFeature.iconBg}`}>
                          {activeFeature.icon}
                        </div>

                        <h3 className="text-xl font-bold text-[#fff7ed] mb-1">{activeFeature.title}</h3>
                        <p className="text-sm text-[#fff7ed]/50 mb-6">{activeFeature.detail.heading}</p>

                        <ul className="space-y-3 mb-8">
                          {activeFeature.detail.bullets.map((b) => (
                            <li key={b} className="flex items-start gap-3 text-sm text-[#fff7ed]/70">
                              <CheckCircle className="w-4 h-4 text-[#f97316]/80 mt-0.5 shrink-0" />
                              {b}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => { setActiveFeature(null); router.push(activeFeature.href); }}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-[#f97316] to-[#fb923c] text-[#0f0a07] font-semibold text-sm hover:opacity-90 transition-opacity"
                      >
                        Open feature <ArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveFeature(null)}
                        className="px-5 py-3 rounded-full border border-white/15 text-[#fff7ed]/70 text-sm font-semibold hover:bg-white/5 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="px-6 sm:px-10 pb-24 max-w-6xl mx-auto w-full">
        <div className="relative rounded-3xl overflow-hidden border border-[#f97316]/25 bg-gradient-to-br from-[#f97316]/20 via-[#f97316]/5 to-transparent p-10 sm:p-14 text-center">
          <div className="absolute inset-0 bg-gradient-to-b from-[#f97316]/10 to-transparent pointer-events-none" />
          <h2 className="relative text-3xl sm:text-4xl font-bold text-[#fff7ed] mb-4">
            Start protecting your eyes today
          </h2>
          <p className="relative text-[#fff7ed]/55 max-w-lg mx-auto mb-8 text-sm leading-relaxed">
            Join other students tracking their eye health. Log daily, see your risk score,
            and build better screen habits backed by research.
          </p>
          <a
            href="/signup"
            className="relative inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-[#f97316] to-[#fb923c] text-[#0f0a07] font-semibold hover:opacity-90 transition-all shadow-xl shadow-[#f97316]/30 hover:-translate-y-0.5"
          >
            Create Free Account
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-orange-500/15 px-6 sm:px-10 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image
              src="/logo-mark.png"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
            />
            <span className="text-sm font-semibold text-[#fff7ed]/80">
              Eye<span className="text-[#f97316]">Guard</span>
            </span>
          </div>
          <p className="text-xs text-[#fff7ed]/40 text-center">
            © 2026 EyeGuard. Machine learning eye health monitoring for students.
            Not a substitute for professional medical advice.
          </p>
          <div className="flex items-center gap-4 text-xs text-[#fff7ed]/50">
            <a href="/terms" className="hover:text-[#fb923c] transition-colors">Terms</a>
            <a href="/privacy" className="hover:text-[#fb923c] transition-colors">Privacy</a>
            <a href="/login" className="hover:text-[#fb923c] transition-colors">Login</a>
            <a href="/signup" className="hover:text-[#fb923c] transition-colors">Sign Up</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
