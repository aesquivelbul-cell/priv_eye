/**
 * POST /api/admin/run-migration-004
 *
 * Applies migration 004 by executing raw SQL via Supabase's
 * postgres REST function (pg_query via rpc), using the service-role key.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/admin-guard'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdmin(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let adminClient
  try {
    adminClient = createAdminClient()
  } catch {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const statements = [
    `ALTER TABLE public.predictions ALTER COLUMN user_id DROP NOT NULL`,
    `ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'live'`,
    `ALTER TABLE public.daily_logs ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'live'`,
    `CREATE INDEX IF NOT EXISTS idx_predictions_source ON public.predictions(source)`,
    `CREATE INDEX IF NOT EXISTS idx_daily_logs_source ON public.daily_logs(source)`,
    `UPDATE public.daily_logs SET source = 'survey' WHERE user_id IS NULL AND (source IS NULL OR source = 'live')`,
  ]

  const results: { sql: string; ok: boolean; error?: string }[] = []

  for (const sql of statements) {
    try {
      // Use rpc call to execute raw sql via a postgres function if available,
      // otherwise fall back to direct table operations via the admin client
      const { error } = await adminClient.rpc('exec_sql', { query: sql })

      if (error) {
        // exec_sql may not exist — try alternative approach
        results.push({ sql: sql.slice(0, 70) + '…', ok: false, error: error.message })
      } else {
        results.push({ sql: sql.slice(0, 70) + '…', ok: true })
      }
    } catch (err) {
      results.push({ sql: sql.slice(0, 70) + '…', ok: false, error: String(err) })
    }
  }

  // If exec_sql RPC doesn't exist, try the pg extension approach
  const allFailed = results.every(r => !r.ok)
  if (allFailed) {
    // Try using supabase's built-in pg_query if available
    const pgResults: { sql: string; ok: boolean; error?: string }[] = []
    for (const sql of statements) {
      try {
        const { error } = await adminClient.rpc('pg_query', { query: sql })
        if (error) {
          pgResults.push({ sql: sql.slice(0, 70) + '…', ok: false, error: error.message })
        } else {
          pgResults.push({ sql: sql.slice(0, 70) + '…', ok: true })
        }
      } catch (err) {
        pgResults.push({ sql: sql.slice(0, 70) + '…', ok: false, error: String(err) })
      }
    }

    const pgAllFailed = pgResults.every(r => !r.ok)
    if (!pgAllFailed) {
      const allOk = pgResults.every(r => r.ok)
      return NextResponse.json({
        success: allOk,
        results: pgResults,
        message: allOk ? 'Migration 004 applied successfully.' : 'Some statements failed.',
      })
    }

    // Both RPCs failed — return instructions for manual approach
    return NextResponse.json({
      success: false,
      results,
      needsManual: true,
      message: 'Automatic migration not available. Use the manual SQL below in Supabase SQL Editor.',
      manualSql: statements.map(s => s + ';').join('\n'),
    })
  }

  const allOk = results.every(r => r.ok)
  return NextResponse.json({
    success: allOk,
    results,
    message: allOk ? 'Migration 004 applied successfully.' : 'Some statements failed — check results.',
  })
}
