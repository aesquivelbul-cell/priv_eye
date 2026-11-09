'use client';

import { Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
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
  const [email, setEmail] = useState('');

  useEffect(() => {
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
        {email && (
          <span className="text-xs text-muted-foreground hidden sm:block">{email}</span>
        )}
      </div>
    </header>
  );
}
