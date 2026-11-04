'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    if (!email.includes('@')) { setError('Please enter a valid email address.'); return; }
    setIsLoading(true);
    setError('');
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0a07] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">

        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <Image src="/logo-mark.png" alt="EyeGuard" width={72} height={72}
              className="h-16 w-16 object-contain" priority />
          </div>
          <h1 className="text-2xl font-bold text-[#fff7ed]">Reset your password</h1>
          <p className="text-sm text-[#fff7ed]/50">
            Enter your email and we'll send you a link to reset your password.
          </p>
        </div>

        {sent ? (
          /* ── Sent state ── */
          <div className="bg-[#fff7ed]/[0.05] border border-[#f97316]/20 rounded-2xl p-8 space-y-5 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/15 mx-auto">
              <CheckCircle2 className="w-7 h-7 text-green-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-[#fff7ed]">Check your email</h2>
              <p className="text-sm text-[#fff7ed]/50">
                We've sent a password reset link to{' '}
                <strong className="text-[#f97316]">{email}</strong>.{' '}
                Check your inbox and click the link to reset your password.
              </p>
            </div>
            <p className="text-xs text-[#fff7ed]/30">
              Didn't receive it? Check your spam folder or{' '}
              <button onClick={() => { setSent(false); setEmail(''); }}
                className="text-[#f97316] hover:underline">try again</button>.
            </p>
            <Link href="/login" className="inline-flex items-center gap-2 text-sm text-[#f97316] hover:underline">
              <ArrowLeft className="w-4 h-4" /> Back to login
            </Link>
          </div>
        ) : (
          /* ── Form ── */
          <div className="bg-[#fff7ed]/[0.05] border border-[#f97316]/20 rounded-2xl p-8 space-y-5">
            {error && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-[#fff7ed]/80">Email address</label>
                <input id="email" type="email" value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  placeholder="you@example.com" autoComplete="email" required
                  className="w-full px-3 py-3 border border-[#f97316]/20 rounded-xl bg-[#fff7ed]/[0.06] text-sm text-[#fff7ed] placeholder:text-[#fff7ed]/25 focus:outline-none focus:ring-2 focus:ring-[#f97316]/50 focus:border-[#f97316]/50 transition-all" />
              </div>
              <button type="submit" disabled={isLoading}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-br from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-xl hover:from-amber-400 hover:to-orange-400 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/25">
                {isLoading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {isLoading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
            <div className="text-center">
              <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-[#fff7ed]/40 hover:text-[#fff7ed]/70 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to login
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
