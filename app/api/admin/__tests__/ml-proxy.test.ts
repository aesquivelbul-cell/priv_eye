/**
 * Integration tests: ML proxy routes correctly forward Flask responses
 * and send the X-Retrain-Key header.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock admin Supabase client (admin user) ──────────────────────────────────

const mockGetUser = vi.fn().mockResolvedValue({
  data: {
    user: {
      id: 'admin-123',
      email: 'admin@example.com',
      user_metadata: { role: 'admin' },
    },
  },
  error: null,
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}))

// ─── Mock global fetch ────────────────────────────────────────────────────────

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/admin/ml-status — Flask proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'admin-123', email: 'admin@example.com', user_metadata: { role: 'admin' } },
      },
      error: null,
    })
    vi.stubGlobal('fetch', mockFetch)
  })

  it('forwards the Flask JSON response to the client', async () => {
    const rawFlaskPayload = {
      model_loaded: true,
      supabase_rows: 500,
      new_logs_since_retrain: 12,
      retrain_threshold: 10,
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(rawFlaskPayload),
    })

    const { GET } = await import('../ml-status/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      modelLoaded: true,
      trainingRows: 500,
      newLogsSinceRetrain: 12,
      retrainThreshold: 10,
    })
  })

  it('returns 503 with error message when Flask is unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const { GET } = await import('../ml-status/route')
    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe('ML backend unavailable')
    expect(body.modelLoaded).toBe(false)
  })

  it('forwards non-2xx Flask status codes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({ error: 'Internal Flask error' }),
    })

    const { GET } = await import('../ml-status/route')
    const res = await GET()
    expect(res.status).toBe(500)
  })
})

describe('POST /api/admin/ml-retrain — sends X-Retrain-Key header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'admin-123', email: 'admin@example.com', user_metadata: { role: 'admin' } },
      },
      error: null,
    })
    vi.stubGlobal('fetch', mockFetch)
    process.env.NEXT_PUBLIC_RETRAIN_KEY = 'test-retrain-secret'
  })

  it('sends X-Retrain-Key header to Flask', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ message: 'Retraining started' }),
    })

    const { POST } = await import('../ml-retrain/route')
    await POST()

    expect(mockFetch).toHaveBeenCalledOnce()
    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers['X-Retrain-Key']).toBe('test-retrain-secret')
    expect(options.method).toBe('POST')
  })

  it('returns 503 when Flask is unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const { POST } = await import('../ml-retrain/route')
    const res = await POST()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe('ML backend unavailable')
  })
})
