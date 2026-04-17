// src/app/api/exam/results/[sessionId]/route.ts
// GET /api/exam/results/:sessionId — ambil hasil ujian lengkap

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

    // Ambil hasil dari exam_results (tabel yang diisi saat submit)
    const { data: result, error } = await supabase
      .from('exam_results')
      .select(`
        *,
        exam_sessions (
          id, module_id, started_at, submitted_at, expires_at,
          exam_modules ( name, description )
        )
      `)
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (error || !result) {
      return NextResponse.json({ error: 'Hasil tidak ditemukan' }, { status: 404 })
    }

    // Hitung rank user di modul ini
    const { count: betterCount } = await supabase
      .from('exam_results')
      .select('*', { count: 'exact', head: true })
      .eq('module_id', result.module_id)
      .gt('total_score', result.total_score)

    const { count: totalParticipants } = await supabase
      .from('exam_results')
      .select('*', { count: 'exact', head: true })
      .eq('module_id', result.module_id)

    const rank = (betterCount ?? 0) + 1
    const percentile =
      totalParticipants && totalParticipants > 0
        ? Math.round((1 - (betterCount ?? 0) / totalParticipants) * 100)
        : 100

    return NextResponse.json({
      ...result,
      rank,
      percentile,
      total_participants: totalParticipants ?? 1,
      module_name: result.exam_sessions?.exam_modules?.name ?? 'SKD CPNS',
    })
  } catch (err) {
    console.error('GET /api/exam/results error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
