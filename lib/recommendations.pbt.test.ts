/**
 * Property-based tests for the recommendation engine.
 * Tag: Feature: admin-and-recommendations, Properties 1–8
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import type { RecommendationInput } from './recommendations'

// ─── Tip factory ──────────────────────────────────────────────────────────────

function makeTip(overrides: {
  id?: string
  category?: string
  risk_level?: string | null
  symptom_type?: string | null
  priority?: number
} = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    category: overrides.category ?? 'general',
    risk_level: overrides.risk_level ?? null,
    symptom_type: overrides.symptom_type ?? null,
    title: `Tip-${overrides.id ?? 'x'}`,
    description: 'Test tip description',
    implementation_steps: null,
    priority: overrides.priority ?? 5,
  }
}

function buildTipPool() {
  return [
    makeTip({ id: 'es1', category: 'eye_strain', symptom_type: 'eye_strain', risk_level: null, priority: 9 }),
    makeTip({ id: 'es2', category: 'eye_strain', symptom_type: 'eye_strain', risk_level: 'High', priority: 8 }),
    makeTip({ id: 'ha1', category: 'headaches', symptom_type: 'headaches', risk_level: null, priority: 9 }),
    makeTip({ id: 'ha2', category: 'headaches', symptom_type: 'headaches', risk_level: 'Moderate', priority: 7 }),
    makeTip({ id: 'bv1', category: 'blurry_vision', symptom_type: 'blurry_vision', risk_level: null, priority: 8 }),
    makeTip({ id: 'bv2', category: 'blurry_vision', symptom_type: 'blurry_vision', risk_level: 'Critical', priority: 10 }),
    makeTip({ id: 'de1', category: 'dry_eyes', symptom_type: 'dry_eyes', risk_level: null, priority: 9 }),
    makeTip({ id: 'de2', category: 'dry_eyes', symptom_type: 'dry_eyes', risk_level: 'Low', priority: 6 }),
    makeTip({ id: 'st1', category: 'screen_time', symptom_type: null, risk_level: null, priority: 10 }),
    makeTip({ id: 'sl1', category: 'sleep', symptom_type: null, risk_level: null, priority: 10 }),
    makeTip({ id: 'br1', category: 'brightness', symptom_type: null, risk_level: null, priority: 8 }),
    makeTip({ id: 'g1', category: 'general', symptom_type: null, risk_level: null, priority: 7 }),
    makeTip({ id: 'g2', category: 'general', symptom_type: null, risk_level: null, priority: 6 }),
    makeTip({ id: 'g3', category: 'general', symptom_type: null, risk_level: null, priority: 5 }),
    makeTip({ id: 'rl1', category: 'general', symptom_type: null, risk_level: 'Low', priority: 5 }),
    makeTip({ id: 'rm1', category: 'general', symptom_type: null, risk_level: 'Moderate', priority: 6 }),
    makeTip({ id: 'rh1', category: 'general', symptom_type: null, risk_level: 'High', priority: 7 }),
    makeTip({ id: 'rc1', category: 'general', symptom_type: null, risk_level: 'Critical', priority: 8 }),
  ]
}

// ─── Mock setup ───────────────────────────────────────────────────────────────

const pool = buildTipPool()
type Pool = ReturnType<typeof buildTipPool>

function makeChain(filteredPool: Pool) {
  let currentPool = [...filteredPool]

  const chain = {
    select: () => chain,
    in: (_col: string, values: string[]) => {
      currentPool = currentPool.filter((t) => values.includes((t as Record<string, unknown>)[_col] as string))
      return chain
    },
    eq: (_col: string, value: unknown) => {
      currentPool = currentPool.filter((t) => (t as Record<string, unknown>)[_col] === value)
      return chain
    },
    is: (_col: string, value: unknown) => {
      currentPool = currentPool.filter((t) => (t as Record<string, unknown>)[_col] === value)
      return chain
    },
    order: (_col: string, opts: { ascending: boolean }) => {
      currentPool = [...currentPool].sort((a, b) =>
        opts.ascending
          ? ((a as Record<string, unknown>)[_col] as number) - ((b as Record<string, unknown>)[_col] as number)
          : ((b as Record<string, unknown>)[_col] as number) - ((a as Record<string, unknown>)[_col] as number),
      )
      return chain
    },
    limit: (n: number) => Promise.resolve({ data: currentPool.slice(0, n), error: null }),
    then: (resolve: (v: { data: Pool; error: null }) => void) => resolve({ data: currentPool, error: null }),
  }
  return chain
}

const mockCreateClientPbt = vi.fn().mockResolvedValue({
  from: vi.fn().mockImplementation(() => makeChain(pool)),
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClientPbt,
}))

const { selectRecommendations } = await import('./recommendations')

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const symptomFlag = fc.constantFrom(0 as const, 1 as const)
const riskLevel = fc.constantFrom('Low', 'Moderate', 'High', 'Critical')

const arbitraryInput: fc.Arbitrary<RecommendationInput> = fc.record({
  screenTime: fc.float({ min: 0, max: 16, noNaN: true }),
  sleepHours: fc.float({ min: 0, max: 12, noNaN: true }),
  brightness: fc.integer({ min: 0, max: 100 }),
  riskLevel,
  eyeStrain: symptomFlag,
  headaches: symptomFlag,
  blurryVision: symptomFlag,
  dryEyes: symptomFlag,
})

const arbitraryInputWithSymptom = arbitraryInput.filter(
  (i) => i.eyeStrain === 1 || i.headaches === 1 || i.blurryVision === 1 || i.dryEyes === 1,
)

const arbitraryInputNoSymptom: fc.Arbitrary<RecommendationInput> = fc.record({
  screenTime: fc.float({ min: 0, max: 16, noNaN: true }),
  sleepHours: fc.float({ min: 0, max: 12, noNaN: true }),
  brightness: fc.integer({ min: 0, max: 100 }),
  riskLevel,
  eyeStrain: fc.constant(0 as const),
  headaches: fc.constant(0 as const),
  blurryVision: fc.constant(0 as const),
  dryEyes: fc.constant(0 as const),
})

// ─── Properties 1–8 ──────────────────────────────────────────────────────────

describe('Recommendation Engine — Property-Based Tests', () => {
  beforeEach(() => {
    mockCreateClientPbt.mockResolvedValue({
      from: vi.fn().mockImplementation(() => makeChain(pool)),
    })
  })

  it('Property 1: recommendation count bounds — result length is always between 3 and 8', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryInput, async (input) => {
        const result = await selectRecommendations(input)
        expect(result.length).toBeGreaterThanOrEqual(3)
        expect(result.length).toBeLessThanOrEqual(8)
      }),
      { numRuns: 100 },
    )
  }, 30000)

  it('Property 2: no duplicate recommendations — no two items share the same title+description+category', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryInput, async (input) => {
        const result = await selectRecommendations(input)
        expect(result.length).toBeGreaterThanOrEqual(3)
        expect(result.length).toBeLessThanOrEqual(8)
        const serialized = result.map((r) => `${r.title}|${r.description}|${r.category}`)
        const unique = new Set(serialized)
        expect(unique.size).toBe(serialized.length)
      }),
      { numRuns: 100 },
    )
  }, 30000)

  it('Property 3: recommendation idempotence — same input produces same ordered result', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryInput, async (input) => {
        const result1 = await selectRecommendations(input)
        const result2 = await selectRecommendations(input)
        expect(result1).toEqual(result2)
      }),
      { numRuns: 50 },
    )
  }, 30000)

  it('Property 4: symptom coverage — result contains at least one tip per active symptom type', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryInputWithSymptom, async (input) => {
        const result = await selectRecommendations(input)
        const categories = result.map((r) => r.category)
        if (input.eyeStrain === 1) expect(categories).toContain('eye_strain')
        if (input.headaches === 1) expect(categories).toContain('headaches')
        if (input.blurryVision === 1) expect(categories).toContain('blurry_vision')
        if (input.dryEyes === 1) expect(categories).toContain('dry_eyes')
      }),
      { numRuns: 100 },
    )
  }, 30000)

  it('Property 5: no-symptom fallback returns only general tips — length = 3', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryInputNoSymptom, async (input) => {
        const result = await selectRecommendations(input)
        expect(result.length).toBe(3)
        for (const rec of result) {
          expect(['general', 'screen_time', 'sleep', 'brightness']).toContain(rec.category)
        }
      }),
      { numRuns: 100 },
    )
  }, 30000)

  it('Property 7: result objects have required fields — non-empty title, description, category', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryInput, async (input) => {
        const result = await selectRecommendations(input)
        for (const rec of result) {
          expect(typeof rec.title).toBe('string')
          expect(rec.title.length).toBeGreaterThan(0)
          expect(typeof rec.description).toBe('string')
          expect(rec.description.length).toBeGreaterThan(0)
          expect(typeof rec.category).toBe('string')
          expect(rec.category.length).toBeGreaterThan(0)
        }
      }),
      { numRuns: 100 },
    )
  }, 30000)

  it('Property 8: priority ordering invariant — result order is deterministic', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryInput, async (input) => {
        const result1 = await selectRecommendations(input)
        const result2 = await selectRecommendations(input)
        expect(result1.map((r) => r.title)).toEqual(result2.map((r) => r.title))
      }),
      { numRuns: 50 },
    )
  }, 30000)
})

// ─── Property 6: Empty-table fallback ────────────────────────────────────────

describe('Property 6: empty-table fallback is constant', () => {
  it('returns the same hardcoded 3-item fallback for any input when table is empty', async () => {
    const emptyChain: Record<string, unknown> = {}
    emptyChain.select = () => emptyChain
    emptyChain.in = () => emptyChain
    emptyChain.eq = () => emptyChain
    emptyChain.is = () => emptyChain
    emptyChain.order = () => emptyChain
    emptyChain.limit = () => Promise.resolve({ data: [], error: null })
    emptyChain.then = (resolve: (v: { data: []; error: null }) => void) => resolve({ data: [], error: null })

    mockCreateClientPbt.mockResolvedValue({
      from: vi.fn().mockReturnValue(emptyChain),
    })

    const EXPECTED_TITLES = [
      'Adjust your monitor distance',
      'Maintain optimal screen brightness (60–80%)',
      'Get 7–9 hours of sleep per night',
    ]

    await fc.assert(
      fc.asyncProperty(arbitraryInput, async (input) => {
        const result = await selectRecommendations(input)
        expect(result).toHaveLength(3)
        expect(result.map((r) => r.title)).toEqual(EXPECTED_TITLES)
      }),
      { numRuns: 50 },
    )
  }, 30000)
})
