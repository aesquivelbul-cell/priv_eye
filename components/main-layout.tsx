'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard, BarChart3, AlertCircle, CalendarCheck, ClipboardList,
  Settings, LogOut, Sun, Moon, Menu, X, ShieldCheck,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isAdmin } from '@/lib/admin-guard';
import { NotificationBell } from './notification-bell';
import { LogoutDialog } from './logout-dialog';
import { AiChat } from './ai-chat';
import { EyeBreakReminder } from './eye-break-reminder';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard',       icon: LayoutDashboard },
  { label: 'Analytics', href: '/analytics',       icon: BarChart3 },
  { label: 'Risk',      href: '/risk-prediction', icon: AlertCircle },
  { label: 'Daily Log', href: '/daily-log',       icon: CalendarCheck },
  { label: 'History',   href: '/history',         icon: ClipboardList },
];

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const pathname  = usePathname();
  const router    = useRouter();
  const supabase  = createClient();
  const { theme, setTheme } = useTheme();

  const [mounted, setMounted]         = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [showLogout, setShowLogout]   = useState(false);
  const [loggingOut, setLoggingOut]   = useState(false);
  const [user, setUser]               = useState<{ displayName: string; initial: string } | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    setMounted(true);
    const load = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;
        setIsAdminUser(isAdmin(authUser));
        const { data: profile } = await supabase
          .from('user_profiles').select('first_name, last_name')
          .eq('user_id', authUser.id).maybeSingle();

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

        const initial = (displayName.charAt(0) || emailFallback.charAt(0) || 'U').toUpperCase();
        setUser({ displayName, initial });
      } catch { /* non-fatal */ }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmLogout = async () => {
    setLoggingOut(true);
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
    }
    await supabase.auth.signOut();
    router.push('/');
  };

  const isActive = (href: string) =>
    pathname === href || (href !== '/settings' && pathname.startsWith(href + '/'));

  const navCls = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
      active
        ? 'bg-[#f97316]/15 text-[#fb923c]'
        : 'text-[#fff7ed]/60 hover:text-[#fff7ed] hover:bg-[#f97316]/10'
    }`;

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Top nav ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[#f97316]/15 bg-[#1a0f07]/80 backdrop-blur-md print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[4.5rem] grid grid-cols-[auto_1fr_auto] items-center gap-4">

          {/* Left — Logo (matches landing page style) */}
          <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
            <Image
              src="/logo-mark.png"
              alt="EyeGuard"
              width={44}
              height={44}
              className="h-11 w-11 object-contain object-center drop-shadow-sm"
              priority
            />
            <span className="text-lg font-bold tracking-tight hidden sm:inline">
              <span className="text-[#fff7ed]">Eye</span><span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f97316] to-[#fb923c]">Guard</span>
            </span>
          </Link>

          {/* Center — Desktop nav */}
          <nav className="hidden md:flex items-center justify-center gap-0.5">
            {NAV_ITEMS.map(({ label, href, icon: Icon }) => (
              <Link key={href} href={href} className={navCls(isActive(href))}>
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
            {isAdminUser && (
              <Link
                href="/admin/dashboard"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    sessionStorage.removeItem('view_as_user');
                    document.cookie = 'view_as_user=; path=/; max-age=0; SameSite=Lax';
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[#f97316] bg-[#f97316]/10 hover:bg-[#f97316]/20 transition-all ml-1"
              >
                <ShieldCheck className="w-4 h-4" />
                Admin
              </Link>
            )}
          </nav>

          {/* Right — Actions */}
          <div className="flex items-center gap-1 justify-end">
            <NotificationBell />

            {/* Theme toggle */}
            <button
              onClick={() => mounted && setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg text-[#fff7ed]/40 hover:text-[#fff7ed] hover:bg-[#f97316]/10 transition-colors"
              aria-label="Toggle theme"
              suppressHydrationWarning
            >
              {mounted
                ? (theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />)
                : <span className="w-4 h-4 block" />}
            </button>

            <Link
              href="/settings"
              className={`p-2 rounded-lg transition-colors ${
                pathname === '/settings'
                  ? 'text-[#f97316] bg-[#f97316]/15'
                  : 'text-[#fff7ed]/40 hover:text-[#fff7ed] hover:bg-[#f97316]/10'
              }`}
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>

            {/* User + logout */}
            {user && (
              <div className="hidden md:flex items-center gap-2 ml-1 pl-3 border-l border-[#f97316]/15">
                <div className="w-7 h-7 rounded-full bg-[#f97316]/20 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-[#f97316]">{user.initial}</span>
                </div>
                <span className="text-xs font-medium text-[#fff7ed]/80 max-w-[96px] truncate">{user.displayName}</span>
                <button
                  onClick={() => setShowLogout(true)}
                  className="p-1.5 rounded-lg text-[#fff7ed]/25 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  aria-label="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg text-[#fff7ed]/50 hover:bg-[#f97316]/10 transition-colors"
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-[#f97316]/15 bg-[#0f0a07] px-4 py-3 space-y-0.5">
            {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href} href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? 'bg-[#f97316]/15 text-[#fb923c]'
                      : 'text-[#fff7ed]/60 hover:text-[#fff7ed] hover:bg-[#f97316]/10'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
            {isAdminUser && (
              <Link
                href="/admin/dashboard"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#f97316] bg-[#f97316]/10"
              >
                <ShieldCheck className="w-4 h-4" />
                Admin Panel
              </Link>
            )}
            {user && (
              <div className="flex items-center justify-between gap-3 px-3 pt-3 mt-1 border-t border-border">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#f97316]/15 flex items-center justify-center">
                    <span className="text-xs font-bold text-[#f97316]">{user.initial}</span>
                  </div>
                  <span className="text-sm font-medium text-foreground truncate max-w-[160px]">{user.displayName}</span>
                </div>
                <button
                  onClick={() => { setMobileOpen(false); setShowLogout(true); }}
                  className="flex items-center gap-1.5 text-xs text-red-500 font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── Page content ─────────────────────────────────────────────── */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 pb-10">
          {children}
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-background/60 backdrop-blur-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-10 flex items-center justify-between gap-4">
          <span className="text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} EyeGuard — Academic research project
          </span>
          <nav className="flex items-center gap-4" aria-label="Legal links">
            <Link
              href="/terms"
              className="text-[11px] text-muted-foreground hover:text-[#f97316] transition-colors"
            >
              Terms of Service
            </Link>
            <span className="text-muted-foreground/40 text-[11px]" aria-hidden="true">·</span>
            <Link
              href="/privacy"
              className="text-[11px] text-muted-foreground hover:text-[#f97316] transition-colors"
            >
              Privacy Policy
            </Link>
          </nav>
        </div>
      </footer>

      {/* ── AI Chat FAB — opens a popup on the same page ─────────────── */}
      {pathname !== '/ai-assistant' && <AiChat mode="bubble" />}
      <EyeBreakReminder />

      {/* ── Logout dialog ─────────────────────────────────────────────── */}
      <LogoutDialog
        open={showLogout}
        onConfirm={confirmLogout}
        onCancel={() => setShowLogout(false)}
        isLoading={loggingOut}
      />
    </div>
  );
}
