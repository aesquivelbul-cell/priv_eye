'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isAdmin } from '@/lib/admin-guard';

export default function LoginPage() {
  const router = useRouter();
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? createClient() : null;

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-redirect if already logged in
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('view_as_user');
          document.cookie = 'view_as_user=; path=/; max-age=0; SameSite=Lax';
        }
        if (isAdmin(data.user)) {
          router.replace('/admin/dashboard');
        } else {
          router.replace('/dashboard');
        }
      }
    });
  }, [router, supabase]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      if (!supabase) throw new Error('Service not configured.');
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      if (err) throw err;
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('view_as_user');
        document.cookie = 'view_as_user=; path=/; max-age=0; SameSite=Lax';
      }
      if (isAdmin(data?.user)) {
        router.push('/admin/dashboard');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /* shared input classes */
  const inputCls =
    'w-full py-3.5 bg-[#fff7ed]/[0.06] border border-[#f97316]/20 rounded-xl text-[#fff7ed] placeholder:text-[#fff7ed]/25 text-sm focus:outline-none focus:ring-2 focus:ring-[#f97316]/50 focus:border-[#f97316]/50 transition-all';

  return (
    <div className="min-h-screen bg-[#0f0a07] flex">

      {/* ── Left decorative panel ── */}
      <div className="hidden lg:flex lg:w-[45%] relative flex-col items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#f97316]/12 via-transparent to-[#fb923c]/5 pointer-events-none" />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#f97316]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-[#fb923c]/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 text-center space-y-8 max-w-sm">
          <div className="flex justify-center">
            <Image
              src="/logo-mark.png"
              alt="EyeGuard"
              width={88}
              height={88}
              className="h-20 w-20 object-contain"
              priority
            />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-[#fff7ed] tracking-tight">
              Eye<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f97316] to-[#fb923c]">Guard</span>
            </h1>
            <p className="text-[#fff7ed]/50 mt-2 text-sm leading-relaxed">
              Machine learning eye health monitoring for students
            </p>
          </div>

          <div className="space-y-4 text-left">
            {[
              { n: '01', title: 'Log Daily',       desc: 'Track screen time, symptoms, and habits' },
              { n: '02', title: 'Get Your Score',   desc: 'AI-powered eye strain risk assessment' },
              { n: '03', title: 'Improve',          desc: 'Follow personalised recommendations' },
            ].map(({ n, title, desc }) => (
              <div key={n} className="flex items-start gap-4">
                <span className="text-xs font-bold text-[#f97316]/60 mt-0.5 w-6 flex-shrink-0">{n}</span>
                <div>
                  <p className="text-sm font-semibold text-[#fff7ed]/90">{title}</p>
                  <p className="text-xs text-[#fff7ed]/40">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-[#fff7ed]/30 justify-center">
            <Shield className="w-3.5 h-3.5 text-[#f97316]/50" />
            Research-backed · Free to use
          </div>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md space-y-8">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 justify-center">
            <Image src="/logo-mark.png" alt="EyeGuard" width={40} height={40} className="h-10 w-10 object-contain" />
            <span className="text-xl font-bold text-[#fff7ed]">
              Eye<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f97316] to-[#fb923c]">Guard</span>
            </span>
          </div>

          <div>
            <h2 className="text-3xl font-bold text-[#fff7ed]">Welcome back</h2>
            <p className="text-[#fff7ed]/50 mt-1.5 text-sm">Sign in to your eye health dashboard</p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#fff7ed]/50 uppercase tracking-wide">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#fff7ed]/30" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  required
                  className={`${inputCls} pl-11 pr-4`}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#fff7ed]/50 uppercase tracking-wide">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-[#f97316] hover:text-[#fb923c] transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#fff7ed]/30" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  className={`${inputCls} pl-11 pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#fff7ed]/30 hover:text-[#fff7ed]/60 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-[#f97316] to-[#fb923c] text-[#0f0a07] font-semibold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#f97316]/25 hover:-translate-y-0.5"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-[#0f0a07]/30 border-t-[#0f0a07] rounded-full animate-spin" />
              ) : (
                <>Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-[#fff7ed]/40">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="text-[#f97316] hover:text-[#fb923c] font-semibold transition-colors"
            >
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
