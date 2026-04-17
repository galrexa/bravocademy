// src/__tests__/integration/api-exam.test.ts
// Integration test untuk API routes exam — Supabase di-mock

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mock @supabase/ssr SEBELUM import route ───────────────────────────────────
// Penting: vi.mock di-hoist ke atas oleh vitest, tapi referensi ke
// mockSupabase harus lewat getter supaya selalu fresh setelah vi.clearAllMocks()

const mockGetUser = vi.fn()
const mockFrom    = vi.fn()
const mockRpc     = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  }),
}))

// ── Helper: buat mock chain Supabase yang fully awaitable ─────────────────────
// Route memanggil pola: supabase.from('x').select('*').eq('a',b).single()
// Setiap method harus kembalikan object yang bisa di-chain DAN di-await
function makeQueryChain(resolveValue: { data: unknown; error: unknown }) {
  const chain = {
    select:     vi.fn().mockReturnThis(),
    eq:         vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(resolveValue),
    single:     vi.fn().mockResolvedValue(resolveValue),
    update:     vi.fn().mockReturnThis(),
    upsert:     vi.fn().mockResolvedValue({ data: null, error: null }),
    order:      vi.fn().mockReturnThis(),
    limit:      vi.fn().mockReturnThis(),
    gt:         vi.fn().mockReturnThis(),
    head:       vi.fn().mockReturnThis(),
    range:      vi.fn().mockReturnThis(),
    // Buat chain bisa di-await langsung (untuk pola tanpa .single())
    then: undefined as unknown,
  }
  // Jika route await chain tanpa memanggil .single()/.maybeSingle() di akhir
  // (misal: await supabase.from().update().eq()), perlu juga resolveValue
  const asyncChain = Object.assign(chain, {
    // Promise-like: bisa di-await
    then: (resolve: (v: typeof resolveValue) => void) => resolve(resolveValue),
    catch: (reject: (e: unknown) => void) => chain,
  })
  return asyncChain
}

// ── Helper buat NextRequest ───────────────────────────────────────────────────
function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/exam/answer
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/exam/answer', () => {
  // Import handler SEKALI — mock sudah aktif saat ini
  let handler: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    // Gunakan dynamic import supaya mock sudah terdaftar
    const mod = await import('@/app/api/exam/answer/route')
    handler = mod.POST
  })

  it('401 jika tidak login — body valid, user null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    // Body VALID supaya Zod lulus → baru ketemu auth check
    const req = makeReq({
      session_id:      '00000000-0000-0000-0000-000000000001',
      question_id:     '00000000-0000-0000-0000-000000000002',
      selected_option: 'A',
      is_flagged:      false,
    })

    const res = await handler(req)
    expect(res.status).toBe(401)
  })

  it('400 jika body tidak valid — selected_option = Z bukan A-E', async () => {
    // Auth tidak perlu dipanggil untuk test ini karena Zod jalan duluan
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } }, error: null,
    })

    const req = makeReq({
      session_id:      'bukan-uuid',
      question_id:     'juga-bukan',
      selected_option: 'Z',
    })
    const res = await handler(req)
    expect(res.status).toBe(400)
  })

  it('404 jika sesi tidak ditemukan', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } }, error: null,
    })
    mockFrom.mockReturnValue(
      makeQueryChain({ data: null, error: { message: 'not found' } })
    )

    const req = makeReq({
      session_id:      '00000000-0000-0000-0000-000000000001',
      question_id:     '00000000-0000-0000-0000-000000000002',
      selected_option: 'A',
      is_flagged:      false,
    })
    const res = await handler(req)
    expect(res.status).toBe(404)
  })

  it('409 jika sesi sudah submitted', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } }, error: null,
    })
    mockFrom.mockReturnValue(
      makeQueryChain({
        data: {
          id:         'sess-1',
          expires_at: new Date(Date.now() + 3_600_000).toISOString(),
          status:     'submitted',
        },
        error: null,
      })
    )

    const req = makeReq({
      session_id:      '00000000-0000-0000-0000-000000000001',
      question_id:     '00000000-0000-0000-0000-000000000002',
      selected_option: 'A',
      is_flagged:      false,
    })
    const res = await handler(req)
    expect(res.status).toBe(409)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/exam/submit
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/exam/submit', () => {
  let handler: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/exam/submit/route')
    handler = mod.POST
  })

  it('400 jika session_id bukan UUID', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } }, error: null,
    })
    const req = makeReq({ session_id: 'bukan-uuid' })
    const res = await handler(req)
    expect(res.status).toBe(400)
  })

  it('401 jika tidak login — session_id valid, user null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    // Body valid supaya Zod lulus
    const req = makeReq({ session_id: '00000000-0000-0000-0000-000000000001' })
    const res = await handler(req)
    expect(res.status).toBe(401)
  })

  it('200 + already_submitted jika sesi sudah submitted sebelumnya', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } }, error: null,
    })
    mockFrom.mockReturnValue(
      makeQueryChain({
        data: {
          id:         '00000000-0000-0000-0000-000000000001',
          status:     'submitted',
          expires_at: new Date(Date.now() + 3_600_000).toISOString(),
          user_id:    'user-1',
        },
        error: null,
      })
    )

    const req = makeReq({ session_id: '00000000-0000-0000-0000-000000000001' })
    const res = await handler(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.already_submitted).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/exam/start
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/exam/start', () => {
  let handler: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/exam/start/route')
    handler = mod.POST
  })

  it('400 jika module_id bukan UUID', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } }, error: null,
    })
    const req = makeReq({ module_id: 'bukan-uuid' })
    const res = await handler(req)
    expect(res.status).toBe(400)
  })

  it('401 jika tidak login — module_id valid, user null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const req = makeReq({ module_id: '00000000-0000-0000-0000-000000000001' })
    const res = await handler(req)
    expect(res.status).toBe(401)
  })

  it('403 jika tidak punya akses ke modul', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } }, error: null,
    })
    // user_module_access tidak ada → maybeSingle() return null
    mockFrom.mockReturnValue(
      makeQueryChain({ data: null, error: null })
    )

    const req = makeReq({ module_id: '00000000-0000-0000-0000-000000000001' })
    const res = await handler(req)
    expect(res.status).toBe(403)
  })
})