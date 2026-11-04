'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import {
  LayoutDashboard, BarChart3, Settings, LogOut,
  AlertCircle, ShieldCheck, Sun, Moon,
  Bot, CalendarCheck, ClipboardList,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isAdmin } from '@/lib/admin-guard';
import { LogoutDialog } from './logout-dialog';

const navItems = [
  { label: 'Dashboard',       href: '/dashboard',       icon: LayoutDashboard, category: 'main' },
  { label: 'Analytics',       href: '/analytics',       icon: BarChart3,       category: 'main' },
  { label: 'Risk Prediction', href: '/risk-prediction', icon: AlertCircle,     category: 'main' },
  { label: 'Daily Log',       href: '/daily-log',       icon: CalendarCheck,   category: 'main' },
  { label: 'Log History',     href: '/history',         icon: ClipboardList,   category: 'main' },
  { label: 'AI Assistant',    href: '/ai-assistant',    icon: Bot,             category: 'main' },
  { label: 'Settings',        href: '/settings',        icon: Settings,        category: 'bottom' },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<{ email: string; displayName: string } | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showLogout, setShowLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          setIsAdminUser(isAdmin(authUser));
          const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', authUser.id).single();
          setUser({
            email: authUser.email ?? '',
            displayName: profile?.first_name && profile?.last_name
              ? `${profile.first_name} ${profile.last_name}`
              : profile?.first_name ?? authUser.email?.split('@')[0] ?? 'User',
          });
        }
      } catch { /* non-fatal */ }
      finally { setLoading(false); }
    };
    load();
  }, [supabase]);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.push('/');
  };

  const mainItems   = navItems.filter(i => i.category === 'main');
  const bottomItems = navItems.filter(i => i.category === 'bottom');

  const NavLink = ({ label, href, icon: Icon }: { label: string; href: string; icon: typeof LayoutDashboard }) => {
    const active = pathname === href || (href !== '/settings' && pathname.startsWith(href + '/'));
    const isAi = href === '/ai-assistant';
    return (
      <Link
        href={href}
        onClick={onClose}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
          active
            ? 'bg-primary/15 text-primary border border-primary/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-primary' : ''}`} />
        <span className="flex-1">{label}</span>
        {isAi && (
          <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
        )}
      </Link>
    );
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <aside className={`fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-40 transition-transform duration-300 md:relative md:z-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>

        {/* Logo */}
        <div className="px-5 py-5 border-b border-sidebar-border">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <Image
              src="/logo-mark.png"
              alt="EyeGuard"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
            <span className="font-bold text-sidebar-foreground text-sm">
              Eye<span className="text-primary">Guard</span>
            </span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {/* Main */}
          <div className="space-y-0.5">
            {mainItems.map(item => <NavLink key={item.href} {...item} />)}
          </div>

          {/* Log Today CTA */}
          <div className="pt-2">
            <Link
              href="/daily-log"
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
            >
              <CalendarCheck className="w-4 h-4" />
              Log Today's Data
            </Link>
          </div>

          {/* Admin */}
          {isAdminUser && (
            <div>
              <p className="px-3 mb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Admin</p>
              <Link
                href="/admin/dashboard"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all"
              >
                <ShieldCheck className="w-4 h-4" />
                Admin Panel
              </Link>
            </div>
          )}
        </nav>

        {/* Bottom nav items */}
        <div className="px-3 pb-2 space-y-0.5 border-t border-sidebar-border pt-3">
          {bottomItems.map(item => <NavLink key={item.href} {...item} />)}
        </div>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-sidebar-border space-y-1">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>

          {!loading && user && (
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">
                  {user.displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{user.displayName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
              </div>
              <button
                onClick={() => setShowLogout(true)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                aria-label="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      <LogoutDialog
        open={showLogout}
        onConfirm={handleLogout}
        onCancel={() => setShowLogout(false)}
        isLoading={loggingOut}
      />
    </>
  );
}
