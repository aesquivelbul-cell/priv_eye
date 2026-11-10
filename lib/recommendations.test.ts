import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RecommendationInput } from './recommendations'

// ─── Mock Supabase server client ──────────────────────────────────────────────

type MockQueryResult = { data: unknown[] | null; error: null | { message: string } }

let mockQueryResult: MockQueryResult = { data: [], error: null }

function makeChain(): Record<string, unknown> {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  chain.select = self
  chain.in = self
  chain.eq = self
  chain.is = self
  chain.order = self
  chain.limit = vi.fn().mockImplementation(() => Promise.resolve(mockQueryResult))
  chain.then = (resolve: (v: MockQueryResult) => void) => resolve(mockQueryResult)
  return chain
}

const mockFrom = vi.fn().mockImplementation(() => makeChain())
const mockCreateClient = vi.fn().mockResolvedValue({ from: mockFrom })

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

// Import after mock
const { selectRecommendations } = await import('./recommendations')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTip(overrides: Partial<{
  id: string
  category: string
  risk_level: string | null
  symptom_type: string | null
  title: string
  description: string
  priority: number
}> = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    category: overrides.category ?? 'general',
    risk_level: overrides.risk_level ?? null,
    symptom_type: overrides.symptom_type ?? null,
    title: overrides.title ?? `Tip ${overrides.id ?? Math.random()}`,
    description: overrides.description ?? 'Test description',
    implementation_steps: null,
    priority: overrides.priority ?? 5,
  }
}

const baseInput: RecommendationInput = {
  screenTime: 4,
  sleepHours: 7,
  brightness: 70,
  riskLevel: 'Low',
  eyeStrain: 0,
  headaches: 0,
  blurryVision: 0,
  dryEyes: 0,
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('selectRecommendations', () => {
  beforeEach(() => {
    mockQueryResult = {
      data: [
        makeTip({ id: '1', category: 'general', symptom_type: null, priority: 10 }),
        makeTip({ id: '2', category: 'general', symptom_type: null, priority: 9 }),
        makeTip({ id: '3', category: 'general', symptom_type: null, priority: 8 }),
      ],
      error: null,
    }
    mockFrom.mockImplementation(() => makeChain())
    mockCreateClient.mockResolvedValue({ from: mockFrom })
  })

  it('returns 3–8 items for any valid input', async () => {
    const result = await selectRecommendations(baseInput)
    expect(result.length).toBeGreaterThanOrEqual(3)
    expect(result.length).toBeLessThanOrEqual(8)
  })

  it('returns exactly 3 general tips when no symptoms are active', async () => {
    const result = await selectRecommendations({ ...baseInput, eyeStrain: 0, headaches: 0, blurryVision: 0, dryEyes: 0 })
    expect(result).toHaveLength(3)
  })

  it('returns hardcoded fallback when table is empty', async () => {
    mockQueryResult = { data: [], error: null }
    mockFrom.mockImplementation(() => makeChain())

    const result = await selectRecommendations(baseInput)
    expect(result).toHaveLength(3)
    expect(result[0].title).toBe('Adjust your monitor distance')
    expect(result[1].title).toBe('Maintain optimal screen brightness (60–80%)')
    expect(result[2].title).toBe('Get 7–9 hours of sleep per night')
  })

  it('returns hardcoded fallback on Supabase error', async () => {
    mockCreateClient.mockRejectedValue(new Error('network error'))

    const result = await selectRecommendations(baseInput)
    expect(result).toHaveLength(3)
    expect(result[0].title).toBe('Adjust your monitor distance')
  })

  it('every result object has non-empty title, description, and category', async () => {
    const result = await selectRecommendations(baseInput)
    for (const rec of result) {
      expect(rec.title).toBeTruthy()
      expect(rec.description).toBeTruthy()
      expect(rec.category).toBeTruthy()
    }
  })

  it('fills to 3 when only 1 tip is returned — falls back to hardcoded 3-item list', async () => {
    mockQueryResult = {
      data: [makeTip({ id: '1', category: 'general', symptom_type: null, priority: 10 })],
      error: null,
    }
    mockFrom.mockImplementation(() => makeChain())

    const result = await selectRecommendations(baseInput)
    // When the fill query also returns only 1 tip, the engine falls back to hardcoded 3 items
    expect(result.length).toBeGreaterThanOrEqual(3)
    expect(result.length).toBeLessThanOrEqual(8)
  })

  it('caps at 8 when many tips are returned', async () => {
    const manyTips = Array.from({ length: 20 }, (_, i) =>
      makeTip({ id: String(i), category: 'general', symptom_type: null, priority: 10 - i }),
    )
    mockQueryResult = { data: manyTips, error: null }
    mockFrom.mockImplementation(() => makeChain())

    const result = await selectRecommendations({
      ...baseInput,
      eyeStrain: 1,
      headaches: 1,
      blurryVision: 1,
      dryEyes: 1,
    })
    expect(result.length).toBeLessThanOrEqual(8)
  })
})
