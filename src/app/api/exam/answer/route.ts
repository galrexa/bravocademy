// src/app/api/exam/answer/route.ts
import { examLimiter } from '@/lib/ratelimit'
import { auditLog } from '@/lib/audit'
import { encrypt } from '@/lib/crypto'
import { submitAnswerSchema } from '@/lib/validations'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// ── Helper: buat Supabase client di Route Handler ──────────────────────────────
function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: () => {},    // read-only di Route Handler
        remove: () => {},
      },
    }
  )
}

// ── Helper: hitung skor per section ───────────────────────────────────────────
function calculateScore(answers: Record<string, string>, correctAnswers: Record<string, string>) {
  let correct = 0
  let wrong   = 0
  let empty   = 0

  for (const [qId, correctAns] of Object.entries(correctAnswers)) {
    const userAns = answers[qId]
    if (!userAns)           empty++
    else if (userAns === correctAns) correct++
    else                    wrong++
  }

  // Sistem penilaian SKD BKN:
  // Benar = +5, Salah = 0, Kosong = 0
  const score = correct * 5

  return { correct, wrong, empty, score }
}

// ── POST /api/exam/answer ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1. Rate limiting
  const ip = req.headers.get('x-forwarded-for')
    ?? req.headers.get('x-real-ip')
    ?? '127.0.0.1'

  const { success, limit, remaining, reset } = await examLimiter.limit(ip)

  if (!success) {
    return NextResponse.json(
      { error: 'Terlalu banyak request. Coba lagi dalam beberapa saat.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit':     String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset':     String(reset),
          'Retry-After':           String(Math.ceil((reset - Date.now()) / 1000)),
        },
      }
    )
  }

  // 2. Autentikasi — pastikan user sudah login
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized — silakan login terlebih dahulu.' },
      { status: 401 }
    )
  }

  // 3. Parse & validasi body dengan Zod
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'Request body tidak valid JSON.' },
      { status: 400 }
    )
  }

  const parsed = submitAnswerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Data tidak valid.', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { examId, questionId, answer } = parsed.data

  // 4. Cek apakah ujian milik user ini dan masih aktif
  const { data: session, error: sessionError } = await supabase
    .from('exam_sessions')
    .select('id, status, expires_at, module_id')
    .eq('id', examId)
    .eq('user_id', user.id)
    .single()

  if (sessionError || !session) {
    return NextResponse.json(
      { error: 'Sesi ujian tidak ditemukan.' },
      { status: 404 }
    )
  }

  if (session.status !== 'active') {
    return NextResponse.json(
      { error: 'Sesi ujian sudah berakhir.' },
      { status: 409 }
    )
  }

  // 5. Cek waktu ujian — server-side timer (anti-cheat)
  if (new Date() > new Date(session.expires_at)) {
    // Auto-close sesi yang sudah expired
    await supabase
      .from('exam_sessions')
      .update({ status: 'timeout' })
      .eq('id', examId)

    await auditLog({
      userId:     user.id,
      action:     'exam.timeout',
      resource:   'exam_sessions',
      resourceId: String(examId),
      ipAddress:  ip,
      userAgent:  req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json(
      { error: 'Waktu ujian telah habis.' },
      { status: 410 }
    )
  }

  // 6. Cek soal ada dan termasuk dalam modul ujian ini
  const { data: question, error: qError } = await supabase
    .from('questions')
    .select('id, correct_answer')
    .eq('id', questionId)
    .eq('module_id', session.module_id)
    .single()

  if (qError || !question) {
    return NextResponse.json(
      { error: 'Soal tidak ditemukan dalam modul ini.' },
      { status: 404 }
    )
  }

  // 7. Simpan atau update jawaban
  // Cek apakah jawaban untuk soal ini sudah ada
  const { data: existing } = await supabase
    .from('exam_answers')
    .select('id')
    .eq('session_id', examId)
    .eq('question_id', questionId)
    .single()

  const isCorrect = answer === question.correct_answer

  if (existing) {
    // Update jawaban yang sudah ada
    const { error: updateError } = await supabase
      .from('exam_answers')
      .update({
        answer,
        is_correct:  isCorrect,
        answered_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (updateError) {
      return NextResponse.json(
        { error: 'Gagal menyimpan jawaban.' },
        { status: 500 }
      )
    }
  } else {
    // Insert jawaban baru
    const { error: insertError } = await supabase
      .from('exam_answers')
      .insert({
        session_id:  examId,
        question_id: questionId,
        user_id:     user.id,
        answer,
        is_correct:  isCorrect,
        answered_at: new Date().toISOString(),
      })

    if (insertError) {
      return NextResponse.json(
        { error: 'Gagal menyimpan jawaban.' },
        { status: 500 }
      )
    }
  }

  // 8. Hitung progress saat ini
  const { count: answeredCount } = await supabase
    .from('exam_answers')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', examId)

  // 9. Return response
  return NextResponse.json({
    ok:        true,
    answered:  answeredCount ?? 0,
    remaining: Math.max(
      0,
      Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000)
    ),
  })
}

// ── POST /api/exam/answer/submit ───────────────────────────────────────────────
// Endpoint terpisah untuk submit final (selesaikan ujian)
export async function PUT(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'

  // Rate limit juga untuk submit
  const { success } = await examLimiter.limit(ip + ':submit')
  if (!success) {
    return NextResponse.json({ error: 'Terlalu banyak request.' }, { status: 429 })
  }

  // Autentikasi
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { examId } = body as { examId: number }
  if (!examId || typeof examId !== 'number') {
    return NextResponse.json({ error: 'examId wajib diisi.' }, { status: 400 })
  }

  // Ambil sesi ujian
  const { data: session } = await supabase
    .from('exam_sessions')
    .select('id, status, module_id, started_at, expires_at')
    .eq('id', examId)
    .eq('user_id', user.id)
    .single()

  if (!session) {
    return NextResponse.json({ error: 'Sesi ujian tidak ditemukan.' }, { status: 404 })
  }
  if (session.status !== 'active') {
    return NextResponse.json({ error: 'Ujian sudah berakhir sebelumnya.' }, { status: 409 })
  }

  // Ambil semua jawaban user di sesi ini
  const { data: answers } = await supabase
    .from('exam_answers')
    .select('question_id, answer, is_correct')
    .eq('session_id', examId)

  const totalAnswered = answers?.length ?? 0
  const totalCorrect  = answers?.filter(a => a.is_correct).length ?? 0
  const totalWrong    = totalAnswered - totalCorrect

  // Hitung skor SKD: benar × 5
  const rawScore = totalCorrect * 5

  // Enkripsi detail jawaban sebelum simpan (fase 1)
  const answersJson    = JSON.stringify(answers ?? [])
  const answersEncrypted = encrypt(answersJson)

  // Simpan hasil ke exam_results
  const { data: result, error: resultError } = await supabase
    .from('exam_results')
    .insert({
      user_id:           user.id,
      module_id:         session.module_id,
      score:             rawScore,
      total_correct:     totalCorrect,
      total_wrong:       totalWrong,
      total_answered:    totalAnswered,
      answers_encrypted: answersEncrypted,
      duration_seconds:  Math.floor(
        (Date.now() - new Date(session.started_at).getTime()) / 1000
      ),
      completed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (resultError) {
    return NextResponse.json({ error: 'Gagal menyimpan hasil ujian.' }, { status: 500 })
  }

  // Update status sesi menjadi completed
  await supabase
    .from('exam_sessions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', examId)

  // Audit log
  await auditLog({
    userId:     user.id,
    action:     'exam.submit',
    resource:   'exam_results',
    resourceId: String(result.id),
    ipAddress:  ip,
    userAgent:  req.headers.get('user-agent') ?? undefined,
    metadata: {
      score:         rawScore,
      totalCorrect,
      totalWrong,
      totalAnswered,
      durationSeconds: Math.floor(
        (Date.now() - new Date(session.started_at).getTime()) / 1000
      ),
    },
  })

  return NextResponse.json({
    ok:           true,
    resultId:     result.id,
    score:        rawScore,
    totalCorrect,
    totalWrong,
    totalAnswered,
  })
}