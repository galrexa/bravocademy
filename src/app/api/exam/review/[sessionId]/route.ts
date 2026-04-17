// src/app/api/exam/review/[sessionId]/route.ts
// GET /api/exam/review/:sessionId — soal + jawaban user + kunci + penjelasan

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verifikasi session milik user & sudah selesai
    const { data: session } = await supabase
      .from('exam_sessions')
      .select('id, status, user_id, module_id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })
    }

    if (session.status === 'in_progress') {
      return NextResponse.json(
        { error: 'Ujian belum selesai, review belum tersedia' },
        { status: 403 }
      )
    }

    // Ambil semua soal dari sesi ini (urutan sesuai randomisasi saat start)
    const { data: sessionQuestions, error: sqError } = await supabase
      .from('exam_session_questions')
      .select(`
        question_order,
        questions (
          id, content, option_a, option_b, option_c, option_d, option_e,
          correct_answer, explanation, section,
          points_correct, points_wrong
        )
      `)
      .eq('session_id', sessionId)
      .order('question_order', { ascending: true })

    if (sqError) {
      return NextResponse.json({ error: 'Gagal memuat soal' }, { status: 500 })
    }

    // Ambil semua jawaban user
    const { data: userAnswers } = await supabase
      .from('exam_answers')
      .select('question_id, selected_option, is_flagged, answered_at')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)

    const answersMap = Object.fromEntries(
      (userAnswers ?? []).map((a) => [a.question_id, a])
    )

    // Gabungkan soal + jawaban user
    const reviewData = (sessionQuestions ?? []).map((sq) => {
      const q = sq.questions as any
      const userAnswer = answersMap[q.id]

      return {
        question_order: sq.question_order,
        id: q.id,
        content: q.content,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        option_e: q.option_e,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        section: q.section,
        points_correct: q.points_correct,
        points_wrong: q.points_wrong,
        user_answer: userAnswer?.selected_option ?? null,
        is_flagged: userAnswer?.is_flagged ?? false,
        is_correct: userAnswer?.selected_option === q.correct_answer,
        answered_at: userAnswer?.answered_at ?? null,
      }
    })

    return NextResponse.json({ review: reviewData, session_id: sessionId })
  } catch (err) {
    console.error('GET /api/exam/review error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
