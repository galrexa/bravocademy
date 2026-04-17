// src/app/(exam)/results/[sessionId]/page.tsx
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ScoreBreakdown } from '@/components/exam/ScoreBreakdown'
import { AnswerDistributionChart } from '@/components/exam/AnswerDistributionChart'
import { formatDuration, PASSING_GRADES } from '@/lib/exam-utils'

interface ResultsPageProps {
  params: Promise<{ sessionId: string }>
}

export default async function ResultsPage({ params }: ResultsPageProps) {
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

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Ambil data hasil
  const { data: result, error } = await supabase
    .from('exam_results')
    .select(`
      *,
      exam_sessions (
        id, module_id, started_at, submitted_at,
        exam_modules ( name )
      )
    `)
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (error || !result) {
    // Mungkin ujian belum di-submit — cek status session
    const { data: session } = await supabase
      .from('exam_sessions')
      .select('status')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (session?.status === 'in_progress') redirect(`/exam/${sessionId}`)
    notFound()
  }

  // Hitung rank
  const moduleId = (result.exam_sessions as any)?.module_id
  const { count: betterCount } = await supabase
    .from('exam_results')
    .select('*', { count: 'exact', head: true })
    .eq('module_id', moduleId)
    .gt('total_score', result.total_score)

  const { count: totalParticipants } = await supabase
    .from('exam_results')
    .select('*', { count: 'exact', head: true })
    .eq('module_id', moduleId)

  const rank = (betterCount ?? 0) + 1
  const percentile = totalParticipants && totalParticipants > 0
    ? Math.round((1 - (betterCount ?? 0) / totalParticipants) * 100)
    : 100

  const moduleName = (result.exam_sessions as any)?.exam_modules?.name ?? 'SKD CPNS'
  const duration = result.duration_seconds ?? 0

  const examResult = {
    session_id: sessionId,
    user_id: user.id,
    module_name: moduleName,
    total_score: result.total_score,
    twk_score: result.twk_score,
    tiu_score: result.tiu_score,
    tkp_score: result.tkp_score,
    twk_correct: result.twk_correct,
    tiu_correct: result.tiu_correct,
    tkp_correct: result.tkp_correct,
    twk_total: result.twk_total ?? 30,
    tiu_total: result.tiu_total ?? 35,
    tkp_total: result.tkp_total ?? 45,
    duration_seconds: duration,
    rank,
    percentile,
    passed: result.passed,
  }

  const stats = [
    {
      section: 'TWK' as const,
      correct: result.twk_correct,
      wrong: (result.twk_total ?? 30) - result.twk_correct - (result.twk_empty ?? 0),
      empty: result.twk_empty ?? 0,
      total: result.twk_total ?? 30,
    },
    {
      section: 'TIU' as const,
      correct: result.tiu_correct,
      wrong: (result.tiu_total ?? 35) - result.tiu_correct - (result.tiu_empty ?? 0),
      empty: result.tiu_empty ?? 0,
      total: result.tiu_total ?? 35,
    },
    {
      section: 'TKP' as const,
      correct: result.tkp_correct,
      wrong: (result.tkp_total ?? 45) - result.tkp_correct - (result.tkp_empty ?? 0),
      empty: result.tkp_empty ?? 0,
      total: result.tkp_total ?? 45,
    },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-widest text-slate-500 uppercase">Bravocademy</span>
            <span className="text-slate-700">/</span>
            <span className="text-sm font-semibold text-slate-300">Hasil Ujian</span>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero skor */}
        <div className={`
          rounded-2xl border p-8 mb-8 text-center relative overflow-hidden
          ${result.passed
            ? 'border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 to-transparent'
            : 'border-red-500/30 bg-gradient-to-b from-red-500/10 to-transparent'
          }
        `}>
          <p className="text-6xl mb-3">{result.passed ? '🎉' : '📚'}</p>
          <h1 className="text-2xl font-bold text-slate-100 mb-1">{moduleName}</h1>
          <p className={`text-5xl font-black tabular-nums my-4 ${result.passed ? 'text-emerald-400' : 'text-red-400'}`}>
            {result.total_score}
          </p>
          <p className={`text-lg font-bold ${result.passed ? 'text-emerald-400' : 'text-red-400'}`}>
            {result.passed ? '✓ LULUS SKD' : '✗ BELUM LULUS SKD'}
          </p>
          <p className="text-sm text-slate-400 mt-1">Passing grade total: {PASSING_GRADES.TOTAL}</p>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-700/50">
            <div>
              <p className="text-2xl font-bold text-slate-100">#{rank}</p>
              <p className="text-xs text-slate-500 mt-0.5">Peringkat</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-100">{percentile}%</p>
              <p className="text-xs text-slate-500 mt-0.5">Lebih baik dari</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-100">{formatDuration(duration)}</p>
              <p className="text-xs text-slate-500 mt-0.5">Durasi</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Breakdown skor per seksi */}
          <section className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6">
            <h2 className="text-base font-bold text-slate-200 mb-4">Rincian Skor per Seksi</h2>
            <ScoreBreakdown result={examResult} />
          </section>

          {/* Distribusi jawaban */}
          <section className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6">
            <h2 className="text-base font-bold text-slate-200 mb-4">Distribusi Jawaban</h2>
            <AnswerDistributionChart stats={stats} />
          </section>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <Link
            href={`/exam/${sessionId}/review`}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl
                       border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white
                       font-semibold text-sm transition-all"
          >
            📋 Review Jawaban
          </Link>
          <Link
            href={`/leaderboard/${moduleId}`}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl
                       border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white
                       font-semibold text-sm transition-all"
          >
            🏆 Leaderboard
          </Link>
          <Link
            href="/dashboard"
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl
                       bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all"
          >
            Coba Lagi
          </Link>
        </div>
      </main>
    </div>
  )
}
