// src/app/api/exam/leaderboard/[moduleId]/route.ts
// GET /api/exam/leaderboard/:moduleId?page=1&limit=20

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const { moduleId } = await params
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20'))
    const offset = (page - 1) * limit

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

    // Ambil top scores untuk modul ini
    // JOIN dengan profiles untuk nama & avatar
    const { data: entries, error, count } = await supabase
      .from('exam_results')
      .select(
        `
        id, user_id, total_score, twk_score, tiu_score, tkp_score,
        duration_seconds, submitted_at,
        profiles ( full_name, name, avatar_url )
      `,
        { count: 'exact' }
      )
      .eq('module_id', moduleId)
      .order('total_score', { ascending: false })
      .order('duration_seconds', { ascending: true }) // tiebreaker: lebih cepat lebih baik
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: 'Gagal memuat leaderboard' }, { status: 500 })
    }

    // Cari posisi user sendiri jika tidak ada di halaman ini
    let userEntry = null
    const isUserOnPage = entries?.some((e) => e.user_id === user.id)

    if (!isUserOnPage) {
      const { data: userResult } = await supabase
        .from('exam_results')
        .select('total_score, duration_seconds')
        .eq('module_id', moduleId)
        .eq('user_id', user.id)
        .order('total_score', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (userResult) {
        // Hitung rank user
        const { count: betterCount } = await supabase
          .from('exam_results')
          .select('*', { count: 'exact', head: true })
          .eq('module_id', moduleId)
          .or(
            `total_score.gt.${userResult.total_score},and(total_score.eq.${userResult.total_score},duration_seconds.lt.${userResult.duration_seconds})`
          )

        userEntry = {
          ...userResult,
          user_id: user.id,
          rank: (betterCount ?? 0) + 1,
          is_current_user: true,
        }
      }
    }

    const leaderboard = (entries ?? []).map((e, i) => ({
      rank: offset + i + 1,
      user_id: e.user_id,
      display_name: (e.profiles as any)?.full_name ?? (e.profiles as any)?.name ?? 'Peserta',
      avatar_url: (e.profiles as any)?.avatar_url ?? null,
      total_score: e.total_score,
      twk_score: e.twk_score,
      tiu_score: e.tiu_score,
      tkp_score: e.tkp_score,
      duration_seconds: e.duration_seconds,
      submitted_at: e.submitted_at,
      is_current_user: e.user_id === user.id,
    }))

    return NextResponse.json({
      leaderboard,
      user_entry: userEntry,
      total: count ?? 0,
      page,
      limit,
    })
  } catch (err) {
    console.error('GET /api/exam/leaderboard error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
