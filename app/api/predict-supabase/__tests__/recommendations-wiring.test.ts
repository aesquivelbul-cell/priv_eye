/**
 * Integration test: predict-supabase route saves recommendations as
 * { title, description, category } objects (not strings) to the predictions table.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mock selectRecommendations ───────────────────────────────────────────────

const mockRecommendations = [
  { title: 'Follow the 20-20-20 rule', description: 'Look away every 20 minutes.', category: 'general' },
  { title: 'Stay hydrated', description: 'Drink 8 glasses of water.', category: 'general' },
  { title: 'Reduce screen brightness', description: 'Keep brightness at 60-80%.', category: 'brightness' },
]

const mockSelectRecommendations = vi.fn().mockResolvedValue(mockRecommendations)

vi.mock('@/lib/recommendations', () => ({
  selectRecommendations: mockSelectRecommendations,
}))

// ─── Mock Supabase server client ──────────────────────────────────────────────

let capturedPredictionInsert: Record<string, unknown> | null = null

const mockGetUser = vi.fn().mockResolvedValue({
  data: {
    user: { id: 'user-abc', email: 'test@example.com', user_metadata: {} },
  },
  error: null,
})

function buildMockFrom() {
  return vi.fn().mockImplementation((table: string) => {
    if (table === 'user_profiles') {
      return { upsert: vi.fn().mockResolvedValue({ error: null }) }
    }
    if (table === 'daily_logs') {
      return {
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'log-456' },
              error: null,
            }),
          }),
        }),
      }
    }
    if (table === 'predictions') {
      return {
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        insert: vi.fn().mockImplementation((data: Record<string, unknown>) => {
          capturedPredictionInsert = data
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'pred-123', ...data },
                error: null,
              }),
            }),
          }
        }),
      }
    }
    return {}
  })
}

const mockCreateClient = vi.fn().mockResolvedValue({
  auth: { getUser: mockGetUser },
  from: buildMockFrom(),
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('predict-supabase route — recommendations wiring', () => {
  beforeEach(() => {
    capturedPredictionInsert = null
    mockSelectRecommendations.mockResolvedValue(mockRecommendations)
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-abc', email: 'test@example.com', user_metadata: {} } },
      error: null,
    })
    mockCreateClient.mockResolvedValue({
      auth: { getUser: mockGetUser },
      from: buildMockFrom(),
    })
  })

  it('saves recommendations as an array of { title, description, category } objects', async () => {
    const { POST } = await import('../route')

    const body = {
      screenTime: 6,
      sleepHours: 7,
      brightness: 70,
      symptoms: ['eyeStrain'],
      breaksTaken: 3,
      email: 'test@example.com',
      age: '20-21',
      gender: 'Male',
      yearLevel: '3rd Year',
      fieldOfStudy: 'Computer Science',
    }

    const request = new NextRequest('http://localhost/api/predict-supabase', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(request)
    expect(res.status).toBe(200)

    // Verify the insert received structured objects, not strings
    expect(capturedPredictionInsert).not.toBeNull()
    const recs = (capturedPredictionInsert as Record<string, unknown>).recommendations as unknown[]
    expect(Array.isArray(recs)).toBe(true)
    expect(recs.length).toBeGreaterThan(0)

    for (const rec of recs) {
      expect(typeof rec).toBe('object')
      expect(rec).not.toBeNull()
      const r = rec as Record<string, unknown>
      expect(typeof r.title).toBe('string')
      expect(typeof r.description).toBe('string')
      expect(typeof r.category).toBe('string')
    }

    // Verify the response also includes structured recommendations
    const responseBody = await res.json()
    expect(Array.isArray(responseBody.recommendations)).toBe(true)
    expect(responseBody.recommendations[0]).toHaveProperty('title')
    expect(responseBody.recommendations[0]).toHaveProperty('description')
    expect(responseBody.recommendations[0]).toHaveProperty('category')
  })

  it('calls selectRecommendations with correct input shape', async () => {
    const { POST } = await import('../route')

    const body = {
      academicScreenTime: '6–8 hours', // 7h
      nonAcademicScreenTime: '1–3 hours', // 2h -> screenTime = 9h
      sleepHours: 5,
      screenBrightness: 'High (76–100%)', // brightness = 90
      sym_difficultyFocusing: 'Sometimes (3-4 times a week)', // eyeStrain = 1
      sym_headaches: 'Sometimes (3-4 times a week)', // headaches = 1
      sym_dryEyes: 'Sometimes (3-4 times a week)', // dryEyes = 1
      breaksTaken: 1,
      email: 'test@example.com',
    }

    const request = new NextRequest('http://localhost/api/predict-supabase', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })

    await POST(request)

    expect(mockSelectRecommendations).toHaveBeenCalled()
    const callArg = mockSelectRecommendations.mock.calls[mockSelectRecommendations.mock.calls.length - 1][0]
    expect(callArg).toMatchObject({
      screenTime: 9,
      sleepHours: 5,
      brightness: 90,
      eyeStrain: 1,
      headaches: 1,
      dryEyes: 1,
      blurryVision: 0,
    })
  })
})
