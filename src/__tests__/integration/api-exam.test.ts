// src/__tests__/integration/api-exam.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── State mock ────────────────────────────────────────────────────────────────
let _user:   { id: string } | null = null
let _dbData: unknown               = null
let _dbErr:  unknown               = null

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => {
    const makeChain = () => {
      const c: Record<string, unknown> = {}
      const s = () => c
      ;['select','eq','update','order','limit','gt','range','head'].forEach(m => { c[m] = vi.fn(s) })
      c.upsert      = vi.fn(() => Promise.resolve({ data: null, error: null }))
      c.single      = vi.fn(() => Promise.resolve({ data: _dbData, error: _dbErr }))
      c.maybeSingle = vi.fn(() => Promise.resolve({ data: _dbData, error: _dbErr }))
      return c
    }
    return {
      auth: {
        getUser: vi.fn(() => Promise.resolve({
          data:  { user: _user },
          error: _user ? null : { message: 'Unauthorized' },
        })),
      },
      from: vi.fn(makeChain),
      rpc:  vi.fn(() => Promise.resolve({
        data: { session_id: 'new-sess', expires_at: new Date(Date.now() + 3_600_000).toISOString() },
        error: null,
      })),
    }
  },
}))

vi.mock('next/headers', () => ({
  cookies: () => ({ getAll: () => [], set: vi.fn(), get: vi.fn() }),
}))

import { POST as answerPOST } from '@/app/api/exam/answer/route'
import { POST as submitPOST } from '@/app/api/exam/submit/route'
import { POST as startPOST  } from '@/app/api/exam/start/route'

const UUID1 = '00000000-0000-4000-8000-000000000001'
const UUID2 = '00000000-0000-4000-8000-000000000002'

function post(body: unknown) {
  return new NextRequest('http://localhost/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  _user   = null
  _dbData = null
  _dbErr  = null
})

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/exam/answer', () => {

  it('401 — tidak login, body valid', async () => {
    _user = null
    const res = await answerPOST(post({ session_id: UUID1, question_id: UUID2, selected_option: 'A', is_flagged: false }))
    expect(res.status).toBe(401)
  })

  it('400 — body tidak valid', async () => {
    _user = { id: 'u1' }
    const res = await answerPOST(post({ session_id: 'x', question_id: 'y', selected_option: 'Z' }))
    expect(res.status).toBe(400)
  })

  it('404 — sesi tidak ditemukan', async () => {
    _user   = { id: 'u1' }
    _dbData = null
    _dbErr  = { message: 'not found' }
    const res = await answerPOST(post({ session_id: UUID1, question_id: UUID2, selected_option: 'A', is_flagged: false }))
    expect(res.status).toBe(404)
  })

  it('409 — sesi sudah submitted', async () => {
    _user   = { id: 'u1' }
    _dbData = { id: UUID1, status: 'submitted', expires_at: new Date(Date.now() + 3_600_000).toISOString() }
    _dbErr  = null
    const res = await answerPOST(post({ session_id: UUID1, question_id: UUID2, selected_option: 'A', is_flagged: false }))
    expect(res.status).toBe(409)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/exam/submit', () => {

  it('400 — session_id bukan UUID', async () => {
    _user = { id: 'u1' }
    expect((await submitPOST(post({ session_id: 'bukan-uuid' }))).status).toBe(400)
  })

  it('401 — tidak login', async () => {
    _user = null
    expect((await submitPOST(post({ session_id: UUID1 }))).status).toBe(401)
  })

  it('200 already_submitted', async () => {
    _user   = { id: 'u1' }
    _dbData = { id: UUID1, status: 'submitted', user_id: 'u1', expires_at: new Date(Date.now() + 3_600_000).toISOString() }
    _dbErr  = null
    const res  = await submitPOST(post({ session_id: UUID1 }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.already_submitted).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/exam/start', () => {

  it('400 — module_id bukan UUID', async () => {
    _user = { id: 'u1' }
    expect((await startPOST(post({ module_id: 'bukan-uuid' }))).status).toBe(400)
  })

  it('401 — tidak login', async () => {
    _user = null
    expect((await startPOST(post({ module_id: UUID1 }))).status).toBe(401)
  })

  it('403 — tidak punya akses modul', async () => {
    _user   = { id: 'u1' }
    _dbData = null
    _dbErr  = null
    expect((await startPOST(post({ module_id: UUID1 }))).status).toBe(403)
  })
})