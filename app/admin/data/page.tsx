'use client'

import { useState } from 'react'
import { Download, RefreshCw, CheckCircle, AlertTriangle, Info, Wrench } from 'lucide-react'

interface MigrateResult {
  migrated: number
  skipped: number
  total: number
  errors: string[]
  message: string
}

// ── One-shot migration 004 applier ────────────────────────────────────────────
function Migration004Button() {
  const [running, setRunning]   = useState(false)
  const [done, setDone]         = useState(false)
  const [result, setResult]     = useState<{
    success: boolean
    message: string
    needsManual?: boolean
    manualSql?: string
    results: { sql: string; ok: boolean; error?: string }[]
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const apply = async () => {
    setRunning(true)
    try {
      const res  = await fetch('/api/admin/run-migration-004', { method: 'POST' })
      const body = await res.json()
      setResult(body)
      if (body.success) setDone(true)
    } catch (err) {
      setResult({ success: false, message: String(err), results: [] })
    } finally {
      setRunning(false)
    }
  }

  const copySQL = () => {
    if (result?.manualSql) {
      navigator.clipboard.writeText(result.manualSql)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={apply}
        disabled={running || done}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
      >
        <Wrench className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
        {done ? 'Migration applied ✓' : running ? 'Applying…' : 'Apply Migration 004'}
      </button>

      {result && !result.needsManual && (
        <div className={`rounded-lg border p-2 text-xs space-y-1 ${result.success ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/20' : 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20'}`}>
          <p className={`font-semibold ${result.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>{result.message}</p>
          {result.results.map((r, i) => (
            <p key={i} className={r.ok ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
              {r.ok ? '✓' : '✗'} {r.sql}{r.error ? ` — ${r.error}` : ''}
            </p>
          ))}
        </div>
      )}

      {result?.needsManual && (
        <div className="rounded-lg border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/20 p-3 space-y-2 text-xs">
          <p className="font-semibold text-yellow-800 dark:text-yellow-300">
            Run this SQL manually in Supabase SQL Editor
          </p>
          <p className="text-yellow-700 dark:text-yellow-400">
            Automatic apply is not available for your project. Copy the SQL below, open your{' '}
            <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="underline">Supabase SQL Editor</a>,
            paste it in a new query, and click Run.
          </p>
          <pre className="bg-black/10 dark:bg-white/5 rounded p-2 overflow-x-auto text-[10px] leading-relaxed text-foreground whitespace-pre-wrap break-all">
            {result.manualSql}
          </pre>
          <button
            onClick={copySQL}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-semibold transition-colors"
          >
            {copied ? '✓ Copied!' : 'Copy SQL'}
          </button>
          <p className="text-yellow-600 dark:text-yellow-500">
            After running the SQL successfully, come back and click <strong>Migrate Survey Data</strong>.
          </p>
        </div>
      )}
    </div>
  )
}

export default function AdminDataPage() {
  // ── Export ──────────────────────────────────────────────────────────────────
  const [downloading, setDownloading] = useState(false)
  const [exportError, setExportError] = useState('')

  const handleExport = async () => {
    setDownloading(true)
    setExportError('')
    try {
      const res = await fetch('/api/admin/export-csv')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Export failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `eyeguard-export-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setDownloading(false)
    }
  }

  // ── Migrate ─────────────────────────────────────────────────────────────────
  const [migrating, setMigrating] = useState(false)
  const [migrateResult, setMigrateResult] = useState<MigrateResult | null>(null)
  const [migrateError, setMigrateError] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  const handleMigrate = async () => {
    setShowConfirm(false)
    setMigrating(true)
    setMigrateResult(null)
    setMigrateError('')
    try {
      const res = await fetch('/api/admin/migrate-survey', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Migration failed')
      setMigrateResult(body as MigrateResult)
    } catch (err) {
      setMigrateError(err instanceof Error ? err.message : 'Migration failed')
    } finally {
      setMigrating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Data Management</h1>
        <p className="text-muted-foreground mt-1">Export respondent data and migrate survey imports into live logs</p>
      </div>

      {/* ── Export card ── */}
      <div className="border border-border rounded-xl p-6 max-w-2xl space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Export Data</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Downloads <strong className="text-foreground">all respondents</strong> as a single Excel file —
            imported survey responses plus any live daily log submissions.
            Each row has a "Source" column so you can filter in Excel.
            Includes all CVS-Q answers, symptom grid, habits, environment, and risk scores.
          </p>
        </div>

        <button
          onClick={handleExport}
          disabled={downloading}
          aria-busy={downloading}
          aria-label="Export all respondent data as Excel file"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          <Download className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
          {downloading ? 'Generating…' : 'Export Excel (.xlsx)'}
        </button>

        {exportError && (
          <p role="alert" className="text-sm text-destructive">{exportError}</p>
        )}
      </div>

      {/* ── Migrate survey → logs card ── MIGRATION COMPLETE — hidden from normal view */}
      <div className="border border-green-200 dark:border-green-800 rounded-xl p-6 max-w-2xl space-y-3 bg-green-50 dark:bg-green-950/20">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <div>
            <h2 className="text-lg font-semibold text-green-800 dark:text-green-300">Migration Complete</h2>
            <p className="text-sm text-green-700 dark:text-green-400 mt-0.5">
              399 survey respondents have already been migrated to daily logs. No further action needed.
            </p>
          </div>
        </div>
      </div>

      {/* ── Original migrate card — kept hidden; uncomment if re-migration is needed ── */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      /* hide migrated block */}
      {(false as any) && <div className="border border-border rounded-xl p-6 max-w-2xl space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Migrate Survey Data to Logs</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Converts every row in <code className="text-xs bg-muted px-1 py-0.5 rounded">survey_responses</code> into
            a real <code className="text-xs bg-muted px-1 py-0.5 rounded">daily_logs</code> entry and a
            matching <code className="text-xs bg-muted px-1 py-0.5 rounded">predictions</code> row with full
            risk scoring — exactly as if each respondent had submitted the form through the app.
            Already-migrated rows are automatically skipped, so this is safe to run multiple times.
          </p>
        </div>

        {/* Pre-requisite notice */}
        <div className="flex gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-sm">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-blue-800 dark:text-blue-300 space-y-2">
            <p className="font-medium">Apply database migration first</p>
            <p>
              Click the button below to apply migration 004 automatically —
              this makes <code className="text-xs bg-blue-100 dark:bg-blue-900/40 px-1 py-0.5 rounded">predictions.user_id</code> nullable
              and adds a <code className="text-xs bg-blue-100 dark:bg-blue-900/40 px-1 py-0.5 rounded">source</code> column to both tables.
              Do this once before running the migration.
            </p>
            <Migration004Button />
          </div>
        </div>

        {/* Confirm modal overlay */}
        {showConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-background border border-border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Migrate survey data?</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    This will convert all survey_responses rows into real daily_logs and predictions entries.
                    Existing migrated rows will be skipped. The operation cannot be undone automatically,
                    but migrated rows are clearly tagged as <strong>source = &apos;survey&apos;</strong> and can be
                    deleted manually if needed.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMigrate}
                  className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  Yes, Migrate
                </button>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => setShowConfirm(true)}
          disabled={migrating}
          aria-busy={migrating}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${migrating ? 'animate-spin' : ''}`} />
          {migrating ? 'Migrating…' : 'Migrate Survey Data'}
        </button>

        {migrateError && (
          <div className="flex gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">{migrateError}</p>
          </div>
        )}

        {migrateResult && (
          <div className="space-y-3">
            {/* Summary banner */}
            <div className={`flex gap-3 p-4 rounded-lg border ${
              migrateResult.errors.length > 0
                ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800'
                : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
            }`}>
              <CheckCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                migrateResult.errors.length > 0
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-green-600 dark:text-green-400'
              }`} />
              <div className="space-y-1">
                <p className={`text-sm font-semibold ${
                  migrateResult.errors.length > 0
                    ? 'text-yellow-800 dark:text-yellow-300'
                    : 'text-green-800 dark:text-green-300'
                }`}>
                  Migration complete
                </p>
                <p className={`text-sm ${
                  migrateResult.errors.length > 0
                    ? 'text-yellow-700 dark:text-yellow-400'
                    : 'text-green-700 dark:text-green-400'
                }`}>
                  {migrateResult.message}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total rows',  value: migrateResult.total,    color: 'text-foreground' },
                { label: 'Migrated',    value: migrateResult.migrated, color: 'text-green-600 dark:text-green-400' },
                { label: 'Skipped',     value: migrateResult.skipped,  color: 'text-muted-foreground' },
              ].map(({ label, value, color }) => (
                <div key={label} className="border border-border rounded-lg p-3 text-center">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Errors */}
            {migrateResult.errors.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted px-4 py-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Errors ({migrateResult.errors.length})
                  </p>
                </div>
                <ul className="divide-y divide-border max-h-48 overflow-y-auto">
                  {migrateResult.errors.map((e, i) => (
                    <li key={i} className="px-4 py-2 text-xs text-destructive font-mono">{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>}
    </div>
  )
}
