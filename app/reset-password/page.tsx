'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Eye, EyeOff, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// ── Password strength helpers ────────────────────────────────────────────────

interface StrengthRule {
  label: string;
  test: (pw: string) => boolean;
}

const RULES: StrengthRule[] = [
  { label: 'At least 8 characters',          test: pw => pw.length >= 8 },
  { label: 'At least one uppercase letter',  test: pw => /[A-Z]/.test(pw) },
  { label: 'At least one lowercase letter',  test: pw => /[a-z]/.test(pw) },
  { label: 'At least one number',            test: pw => /\d/.test(pw) },
  { label: 'At least one special character', test: pw => /[^A-Za-z0-9]/.test(pw) },
];

function getStrength(pw: string): { passed: number; label: string; color: string; barColor: string } {
  const passed = RULES.filter(r => r.test(pw)).length;
  if (passed <= 1) return { passed, label: 'Very weak',  color: 'text-red-400',    barColor: 'bg-red-500' };
  if (passed === 2) return { passed, label: 'Weak',       color: 'text-orange-400', barColor: 'bg-orange-500' };
  if (passed === 3) return { passed, label: 'Fair',       color: 'text-yellow-400', barColor: 'bg-yellow-500' };
  if (passed === 4) return { passed, label: 'Strong',     color: 'text-lime-400',   barColor: 'bg-lime-500' };
  return                  { passed, label: 'Very strong', color: 'text-green-400',  barColor: 'bg-green-500' };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading,   setIsLoading]   = useState(false);
  const [done,        setDone]        = useState(false);
  const [error,       setError]       = useState('');
  const [sessionReady, setSessionReady] = useState(false);

  // Grab the user's email once the session is established by the callback
  useEffect(() => {
    const init = async () => {
      // Poll briefly — the callback may still be exchanging the code
      for (let i = 0; i < 10; i++) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setEmail(user.email ?? '');
          setSessionReady(true);
          return;
        }
        await new Promise(r => setTimeout(r, 400));
      }
      // No session after retries — link was invalid or already used.
      // Redirect to forgot-password so the user can request a fresh link.
      router.replace('/forgot-password?expired=1');
    };
    init();
  }, [supabase, router]);

  const strength = getStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (strength.passed < 4) {
      setError('Please choose a stronger password before continuing.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      // Redirect to login after 3 s
      setTimeout(() => router.push('/login'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputCls =
    'w-full px-3 py-3 border border-[#f97316]/20 rounded-xl bg-[#fff7ed]/[0.06] text-sm text-[#fff7ed] placeholder:text-[#fff7ed]/25 focus:outline-none focus:ring-2 focus:ring-[#f97316]/50 focus:border-[#f97316]/50 transition-all';

  return (
    <div className="min-h-screen bg-[#0f0a07] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">

        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <Image src="/logo-mark.png" alt="EyeGuard" width={72} height={72}
              className="h-16 w-16 object-contain" priority />
          </div>
          <h1 className="text-2xl font-bold text-[#fff7ed]">Set a new password</h1>
          <p className="text-sm text-[#fff7ed]/50">
            Choose a strong password to secure your account.
          </p>
        </div>

        {/* ── Success ── */}
        {done ? (
          <div className="bg-[#fff7ed]/[0.05] border border-[#f97316]/20 rounded-2xl p-8 space-y-5 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/15 mx-auto">
              <CheckCircle2 className="w-7 h-7 text-green-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-[#fff7ed]">Password updated!</h2>
              <p className="text-sm text-[#fff7ed]/50">
                Your password has been changed successfully. Redirecting you to login…
              </p>
            </div>
            <Link href="/login"
              className="inline-flex items-center gap-2 text-sm text-[#f97316] hover:underline">
              <ArrowLeft className="w-4 h-4" /> Go to login now
            </Link>
          </div>
        ) : (
          /* ── Form ── */
          <div className="bg-[#fff7ed]/[0.05] border border-[#f97316]/20 rounded-2xl p-8 space-y-6">

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Email display — read-only, shows what account is being reset */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#fff7ed]/60">Resetting password for</label>
              <div className="flex items-center gap-2.5 px-3 py-3 rounded-xl border border-[#f97316]/15 bg-[#fff7ed]/[0.03]">
                <Lock className="w-4 h-4 text-[#f97316]/50 flex-shrink-0" />
                <span className="text-sm text-[#fff7ed]/70 truncate">
                  {sessionReady ? email || '—' : (
                    <span className="inline-block w-40 h-3 rounded bg-[#fff7ed]/10 animate-pulse" />
                  )}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* New password */}
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-[#fff7ed]/80">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    required
                    className={inputCls + ' pr-10'}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#fff7ed]/30 hover:text-[#fff7ed]/60 transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Strength bar */}
                {password.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          i <= strength.passed ? strength.barColor : 'bg-[#fff7ed]/10'
                        }`} />
                      ))}
                    </div>
                    <p className={`text-xs font-semibold ${strength.color}`}>{strength.label}</p>
                    <ul className="space-y-1">
                      {RULES.map(rule => (
                        <li key={rule.label} className={`flex items-center gap-2 text-xs transition-colors ${
                          rule.test(password) ? 'text-green-400' : 'text-[#fff7ed]/30'
                        }`}>
                          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            rule.test(password) ? 'bg-green-500/20' : 'bg-[#fff7ed]/5'
                          }`}>
                            {rule.test(password)
                              ? <CheckCircle2 className="w-3 h-3" />
                              : <span className="w-1.5 h-1.5 rounded-full bg-[#fff7ed]/20" />}
                          </span>
                          {rule.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <label htmlFor="confirm" className="text-sm font-medium text-[#fff7ed]/80">
                  Confirm new password
                </label>
                <div className="relative">
                  <input
                    id="confirm"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value); setError(''); }}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                    required
                    className={`${inputCls} pr-10 ${
                      confirm.length > 0
                        ? password === confirm
                          ? 'border-green-500/40 focus:ring-green-500/30'
                          : 'border-red-500/40 focus:ring-red-500/30'
                        : ''
                    }`}
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#fff7ed]/30 hover:text-[#fff7ed]/60 transition-colors">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirm.length > 0 && password !== confirm && (
                  <p className="text-xs text-red-400">Passwords do not match</p>
                )}
                {confirm.length > 0 && password === confirm && (
                  <p className="text-xs text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Passwords match
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || !sessionReady || strength.passed < 4 || password !== confirm}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-br from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-xl hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/25"
              >
                {isLoading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {isLoading ? 'Updating…' : 'Update Password'}
              </button>
            </form>

            <div className="text-center">
              <Link href="/login"
                className="inline-flex items-center gap-1.5 text-sm text-[#fff7ed]/40 hover:text-[#fff7ed]/70 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to login
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
