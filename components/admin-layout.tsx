'use client';

import React, { useState } from 'react';
import { AdminSidebar } from './admin-sidebar';
import { AdminHeader } from './admin-header';
import { AdminAiChatBubble } from './admin-ai-chat-bubble';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-background overflow-hidden print:h-auto print:overflow-visible print:bg-white print:text-black">
      {/* Sidebar — hidden on print */}
      <div className={`flex-shrink-0 transition-all duration-300 print:hidden ${sidebarOpen ? 'w-64' : 'w-0'}`}>
        <AdminSidebar isOpen={sidebarOpen} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 print:overflow-visible print:w-full print:block">
        {/* Header — hidden on print */}
        <div className="print:hidden">
          <AdminHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-background print:overflow-visible print:bg-white print:p-0">
          <div className="p-6 lg:p-8 max-w-7xl mx-auto print:max-w-none print:p-0">
            {children}
          </div>
        </main>
      </div>

      {/* Global floating AI chat bubble — hidden on print */}
      <div className="print:hidden">
        <AdminAiChatBubble />
      </div>
    </div>
  );
}
