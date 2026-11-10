/**
 * Property-based tests for the CSV serialization utility.
 *
 * Tag: Feature: admin-and-recommendations
 * Properties 9 and 10.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { serializeToCSV, DAILY_LOG_COLUMNS } from './csv-export'

// ─── CSV parser helper ────────────────────────────────────────────────────────
// Minimal RFC 4180 parser for round-trip verification.

function parseCSV(csv: string): string[][] {
  const rows: string[][] = []
  const lines = csv.split('\r\n')
  for (const line of lines) {
    if (line === '') continue
    const fields: string[] = []
    let i = 0
    while (i < line.length) {
      if (line[i] === '"') {
        // Quoted field
        let field = ''
        i++ // skip opening quote
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') {
            field += '"'
            i += 2
          } else if (line[i] === '"') {
            i++ // skip closing quote
            break
          } else {
            field += line[i]
            i++
          }
        }
        fields.push(field)
        if (line[i] === ',') i++ // skip comma
      } else {
        // Unquoted field
        const end = line.indexOf(',', i)
        if (end === -1) {
          fields.push(line.slice(i))
          break
        } else {
          fields.push(line.slice(i, end))
          i = end + 1
        }
      }
    }
    rows.push(fields)
  }
  return rows
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

// Generate a single daily_log-shaped row with arbitrary field values
const arbitraryLogRow = fc.record({
  id: fc.uuid(),
  user_id: fc.option(fc.uuid(), { nil: null }),
  date: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }).map((d) => d.toISOString().split('T')[0]),
  email: fc.emailAddress(),
  age: fc.option(fc.integer({ min: 15, max: 80 }), { nil: null }),
  gender: fc.option(fc.constantFrom('Male', 'Female', 'Non-binary', 'Prefer not to say'), { nil: null }),
  year_level: fc.option(fc.constantFrom('1st Year', '2nd Year', '3rd Year', '4th Year'), { nil: null }),
  field_of_study: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  screen_time: fc.float({ min: 0, max: 16, noNaN: true }).map((v) => Math.round(v * 10) / 10),
  breaks_taken: fc.integer({ min: 0, max: 20 }),
  eye_strain: fc.constantFrom(0, 1),
  headaches: fc.constantFrom(0, 1),
  blurry_vision: fc.constantFrom(0, 1),
  dry_eyes: fc.constantFrom(0, 1),
  brightness: fc.integer({ min: 0, max: 100 }),
  sleep_hours: fc.float({ min: 0, max: 12, noNaN: true }).map((v) => Math.round(v * 10) / 10),
  risk_level: fc.option(fc.constantFrom('Low', 'Moderate', 'High', 'Critical'), { nil: null }),
  created_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }).map((d) => d.toISOString()),
})

const arbitraryLogRows = fc.array(arbitraryLogRow, { minLength: 0, maxLength: 50 })

// ─── Properties ──────────────────────────────────────────────────────────────

describe('CSV Export — Property-Based Tests', () => {
  it(
    'Property 9: CSV round-trip fidelity — parsing the exported CSV produces the same row count and field values',
    () => {
      fc.assert(
        fc.property(arbitraryLogRows, (rows) => {
          const columns = [...DAILY_LOG_COLUMNS]
          const csv = serializeToCSV(rows as Record<string, unknown>[], columns)
          const parsed = parseCSV(csv)

          // First row is header
          expect(parsed.length).toBe(rows.length + 1)

          // Check each data row
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i] as Record<string, unknown>
            const parsedRow = parsed[i + 1]
            for (let j = 0; j < columns.length; j++) {
              const originalValue = row[columns[j]]
              const expectedStr = originalValue === null || originalValue === undefined ? '' : String(originalValue)
              expect(parsedRow[j]).toBe(expectedStr)
            }
          }
        }),
        { numRuns: 100 },
      )
    },
  )

  it(
    'Property 10: CSV column completeness — header contains all required DAILY_LOG_COLUMNS in the correct order',
    () => {
      fc.assert(
        fc.property(arbitraryLogRows, (rows) => {
          const columns = [...DAILY_LOG_COLUMNS]
          const csv = serializeToCSV(rows as Record<string, unknown>[], columns)
          const parsed = parseCSV(csv)

          // Header row must exist
          expect(parsed.length).toBeGreaterThanOrEqual(1)
          const header = parsed[0]

          // Must have all columns matching DAILY_LOG_COLUMNS
          expect(header.length).toBe(DAILY_LOG_COLUMNS.length)

          // Must match the required order exactly
          expect(header).toEqual([...DAILY_LOG_COLUMNS])
        }),
        { numRuns: 100 },
      )
    },
  )
})
