'use client'

import { CheckCircle, XCircle, Shield, RefreshCw } from 'lucide-react'

interface EnvCheck {
  key: string
  label: string
  set: boolean
  sensitive?: boolean
}

export default function AdminSettingsPage() {

  // Check which public env vars are configured (we can only check NEXT_PUBLIC_ ones client-side)
  const envChecks: EnvCheck[] = [
    {
      key: 'NEXT_PUBLIC_SUPABASE_URL',
      label: 'Supabase URL',
      set: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    },
    {
      key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      label: 'Supabase Anon Key',
      set: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      sensitive: true,
    },
    {
      key: 'NEXT_PUBLIC_ADMIN_EMAIL',
      label: 'Admin Email',
      set: !!process.env.NEXT_PUBLIC_ADMIN_EMAIL,
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">System configuration and status overview</p>
      </div>

      {/* Environment Variables */}
      <section aria-labelledby="env-heading" className="border border-border rounded-xl p-6">
        <h2 id="env-heading" className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5" /> Environment Variables
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Only <code className="text-xs bg-muted px-1 py-0.5 rounded">NEXT_PUBLIC_</code> variables are visible client-side.
          Server-side keys (like <code className="text-xs bg-muted px-1 py-0.5 rounded">SUPABASE_SERVICE_ROLE_KEY</code>) are verified at runtime.
        </p>
        <div className="space-y-3">
          {envChecks.map((env) => (
            <div key={env.key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium text-foreground">{env.label}</p>
                <p className="text-xs text-muted-foreground font-mono">{env.key}</p>
              </div>
              <div className="flex items-center gap-2">
                {env.set ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-600">Configured</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-destructive" />
                    <span className="text-sm text-destructive">Not set</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* System Info */}
      <section aria-labelledby="system-heading" className="border border-border rounded-xl p-6">
        <h2 id="system-heading" className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <RefreshCw className="w-5 h-5" /> System Info
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Application</span>
            <span className="font-medium text-foreground">EyeGuard Admin Panel</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Framework</span>
            <span className="font-medium text-foreground">Next.js 16 (App Router)</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Database</span>
            <span className="font-medium text-foreground">Supabase (PostgreSQL)</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Admin Email</span>
            <span className="font-medium text-foreground">
              {process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? 'Not configured'}
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
