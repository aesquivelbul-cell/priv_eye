'use client';

import { Menu, Sun, Moon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

interface AdminHeaderProps {
  onToggleSidebar: () => void;
}

const pageTitles: Record<string, string> = {
  '/admin/dashboard':   'Dashboard',
  '/admin/users':       'Users',
  '/admin/data':        'Data Management',
  '/admin/analytics':   'Analytics',
  '/admin/improvement': 'Improvement Tracking',
  '/admin/audit':       'Audit History',
  '/admin/logs':        'Activity Logs',
  '/admin/settings':    'Settings',
};

export function AdminHeader({ onToggleSidebar }: AdminHeaderProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
    });
  }, []);

  const title =
    Object.entries(pageTitles).find(([path]) => pathname.startsWith(path))?.[1] ?? 'Admin Panel';

  return (
    <header className="bg-background border-b border-[#f97316]/15 px-5 py-3.5 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 hover:bg-[#f97316]/10 rounded-lg transition-colors text-muted-foreground hover:text-[#f97316]"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-4 h-4" />
        </button>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground bg-[#f97316]/10 text-[#f97316] px-2 py-0.5 rounded-full font-medium">
          Admin
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Light / Dark Mode Toggle */}
        <button
          onClick={() => mounted && setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[#f97316]/10 transition-colors"
          aria-label="Toggle theme"
          title={mounted && theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          suppressHydrationWarning
        >
          {mounted
            ? (theme === 'dark' ? <Sun className="w-4 h-4 text-[#f97316]" /> : <Moon className="w-4 h-4 text-foreground" />)
            : <span className="w-4 h-4 block" />}
        </button>

        {email && (
          <span className="text-xs text-muted-foreground hidden sm:block border-l border-border pl-3">{email}</span>
        )}
      </div>
    </header>
  );
}
