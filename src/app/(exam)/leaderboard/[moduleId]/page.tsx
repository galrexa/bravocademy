// src/app/(exam)/leaderboard/[moduleId]/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { LeaderboardTable } from '@/components/exam/LeaderboardTable'
import { LeaderboardEntry } from '@/lib/exam-utils'

interface LeaderboardData {
  leaderboard: LeaderboardEntry[]
  user_entry: LeaderboardEntry | null
  total: number
  page: number
  limit: number
}

export default function LeaderboardPage() {
  const params = useParams()
  const moduleId = params.moduleId as string

  const [data, setData] = useState<LeaderboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const LIMIT = 20

  const fetchLeaderboard = useCallback(async (p: number) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exam/leaderboard/${moduleId}?page=${p}&limit=${LIMIT}`)
      if (!res.ok) throw new Error('Gagal memuat leaderboard')
      const json = await res.json()
      setData(json)
      setPage(p)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setIsLoading(false)
    }
  }, [moduleId])

  useEffect(() => {
    fetchLeaderboard(1)
  }, [fetchLeaderboard])

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 0

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-widest text-slate-500 uppercase">Bravocademy</span>
            <span className="text-slate-700">/</span>
            <span className="text-sm font-semibold text-slate-300">Leaderboard</span>
          </div>
          <Link href="/dashboard" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-8">
          <p className="text-5xl mb-3">🏆</p>
          <h1 className="text-2xl font-bold text-slate-100">Papan Peringkat</h1>
          {data && (
            <p className="text-sm text-slate-400 mt-1">
              {data.total.toLocaleString('id-ID')} peserta telah mengikuti ujian ini
            </p>
          )}
        </div>

        {/* Posisi kamu (jika tidak di halaman ini) */}
        {data?.user_entry && !data.leaderboard.some((e) => e.is_current_user) && (
          <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">
              Posisimu
            </p>
            <div className="flex items-center justify-between">
              <span className="text-slate-200 font-semibold">
                Peringkat #{data.user_entry.rank}
              </span>
              <span className="text-2xl font-bold text-blue-300 tabular-nums">
                {data.user_entry.total_score}
              </span>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 mb-6 text-sm text-red-400">
            {error}
            <button onClick={() => fetchLeaderboard(page)} className="ml-3 underline hover:no-underline">
              Coba lagi
            </button>
          </div>
        )}

        {/* Tabel */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4">
          <LeaderboardTable
            entries={data?.leaderboard ?? []}
            userEntry={data?.user_entry}
            isLoading={isLoading}
          />
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => fetchLeaderboard(page - 1)}
              disabled={page <= 1 || isLoading}
              className="px-4 py-2 rounded-lg border border-slate-700 text-sm text-slate-400
                         hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              ← Prev
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                return (
                  <button
                    key={p}
                    onClick={() => fetchLeaderboard(p)}
                    disabled={isLoading}
                    className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all
                      ${p === page
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:bg-slate-800 border border-slate-700'
                      }`}
                  >
                    {p}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => fetchLeaderboard(page + 1)}
              disabled={page >= totalPages || isLoading}
              className="px-4 py-2 rounded-lg border border-slate-700 text-sm text-slate-400
                         hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
