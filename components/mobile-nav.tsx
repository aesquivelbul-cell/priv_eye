'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Eye, BarChart3, AlertCircle, Bot, ClipboardList,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Home',      href: '/dashboard',       icon: LayoutDashboard },
  { label: 'Log',       href: '/daily-log',        icon: Eye },
  { label: 'Analytics', href: '/analytics',        icon: BarChart3 },
  { label: 'Risk',      href: '/risk-prediction',  icon: AlertCircle },
  { label: 'History',   href: '/history',          icon: ClipboardList },
  { label: 'AI',        href: '/ai-assistant',     icon: Bot },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border"
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch h-16">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors relative ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          );
        })}
      </div>
      <div className="h-safe-bottom bg-card" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
    </nav>
  );
}
