'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useState } from 'react';
import {
  LayoutDashboard, Users, Database, BarChart3,
  Activity, Settings, ChevronRight, LogOut, TrendingUp, Eye, Brain,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { LogoutDialog } from './logout-dialog';

interface AdminSidebarProps {
  isOpen: boolean;
}

const menuItems = [
  { label: 'Dashboard',            href: '/admin/dashboard',   icon: LayoutDashboard },
  { label: 'Users',                href: '/admin/users',       icon: Users           },
  { label: 'Data Management',      href: '/admin/data',        icon: Database        },
  { label: 'Analytics',            href: '/admin/analytics',   icon: BarChart3       },
  { label: 'Model Evaluation',     href: '/admin/evaluation',  icon: Brain           },
  { label: 'Improvement Tracking', href: '/admin/improvement', icon: TrendingUp      },
  { label: 'Audit History',        href: '/admin/audit',       icon: Eye             },
  { label: 'Activity Logs',        href: '/admin/logs',        icon: Activity        },
  { label: 'Settings',             href: '/admin/settings',    icon: Settings        },
];
export function AdminSidebar({ isOpen }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showLogout, setShowLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const confirmLogout = async () => {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <>
      <aside
        className={`h-full w-64 bg-card border-r border-[#f97316]/20 flex flex-col transition-all duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#f97316]/20 flex items-center gap-3">
          <Image src="/logo-mark.png" alt="EyeGuard" width={30} height={30} className="h-8 w-8 object-contain" />
          <div>
            <h1 className="font-bold text-foreground text-sm">
              Eye<span className="text-[#f97316]">Guard</span>
            </h1>
            <p className="text-[10px] text-muted-foreground">Admin Panel</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {menuItems.map(({ label, href, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  active
                    ? 'bg-[#f97316]/15 text-[#f97316] border border-[#f97316]/25'
                    : 'text-muted-foreground hover:text-foreground hover:bg-[#f97316]/8'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium flex-1 truncate">{label}</span>
                {active && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 pt-3 border-t border-[#f97316]/20 space-y-1">
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('view_as_user', 'true');
                document.cookie = 'view_as_user=true; path=/; max-age=86400; SameSite=Lax';
              }
              router.push('/dashboard?view=user');
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#f97316] hover:bg-[#f97316]/10 transition-colors border border-[#f97316]/20 text-sm font-medium"
          >
            <LayoutDashboard className="w-4 h-4" />
            Switch to User View
          </button>
          <button
            onClick={() => setShowLogout(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
          <p className="text-[10px] text-muted-foreground/60 text-center pt-1">EyeGuard Admin v2.0.1</p>
        </div>
      </aside>

      <LogoutDialog
        open={showLogout}
        onConfirm={confirmLogout}
        onCancel={() => setShowLogout(false)}
        isLoading={loggingOut}
      />
    </>
  );
}
