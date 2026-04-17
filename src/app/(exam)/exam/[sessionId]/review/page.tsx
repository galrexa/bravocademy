// src/app/(exam)/exam/[sessionId]/review/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ExamSection, SECTION_CONFIG } from '@/lib/exam-utils'

interface ReviewItem {
  question_order: number
  id: string
  content: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  option_e: string
  correct_answer: string
  explanation?: string
  section: ExamSection
  points_correct: number
  points_wrong: number
  user_answer: string | null
  is_flagged: boolean
  is_correct: boolean
  answered_at: string | null
}

type FilterType = 'all' | 'correct' | 'wrong' | 'empty' | 'flagged'

const OPTIONS = ['A', 'B', 'C', 'D', 'E'] as const

export default function ReviewPage() {
  const params = useParams()
  const sessionId = params.sessionId as string

  const [items, setItems] = useState<ReviewItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sectionFilter, setSectionFilter] = useState<ExamSection | 'all'>('all')

  const fetchReview = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exam/review/${sessionId}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Gagal memuat review')
      }
      const data = await res.json()
      setItems(data.review ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  useEffect(() => { fetchReview() }, [fetchReview])

  // Statistik filter
  const stats = {
    all: items.length,
    correct: items.filter((i) => i.is_correct).length,
    wrong: items.filter((i) => !i.is_correct && i.user_answer !== null).length,
    empty: items.filter((i) => i.user_answer === null).length,
    flagged: items.filter((i) => i.is_flagged).length,
  }

  // Terapkan filter
  const filtered = items.filter((item) => {
    const matchSection = sectionFilter === 'all' || item.section === sectionFilter
    const matchStatus =
      filter === 'all' ? true
      : filter === 'correct' ? item.is_correct
      : filter === 'wrong' ? !item.is_correct && item.user_answer !== null
      : filter === 'empty' ? item.user_answer === null
      : filter === 'flagged' ? item.is_flagged
      : true
    return matchSection && matchStatus
  })

  const optionTexts = (item: ReviewItem): Record<string, string> => ({
    A: item.option_a, B: item.option_b, C: item.option_c,
    D: item.option_d, E: item.option_e,
  })

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-widest text-slate-500 uppercase">Bravocademy</span>
            <span className="text-slate-700">/</span>
            <span className="text-sm font-semibold text-slate-300">Review Jawaban</span>
          </div>
          <Link href={`/results/${sessionId}`} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
            ← Hasil
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">

        {/* Ringkasan statistik */}
        {!isLoading && items.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            <StatCard label="Benar" value={stats.correct} color="text-emerald-400" bg="bg-emerald-500/10 border-emerald-500/20" />
            <StatCard label="Salah" value={stats.wrong} color="text-red-400" bg="bg-red-500/10 border-red-500/20" />
            <StatCard label="Kosong" value={stats.empty} color="text-slate-400" bg="bg-slate-800/50 border-slate-700/50" />
            <StatCard label="Ragu-ragu" value={stats.flagged} color="text-amber-400" bg="bg-amber-500/10 border-amber-500/20" />
          </div>
        )}

        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 mb-4">
          {/* Filter seksi */}
          <div className="flex rounded-xl border border-slate-700/60 overflow-hidden text-xs font-semibold">
            {(['all', 'TWK', 'TIU', 'TKP'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSectionFilter(s)}
                className={`px-3 py-2 transition-colors ${
                  sectionFilter === s
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {s === 'all' ? 'Semua Seksi' : s}
              </button>
            ))}
          </div>

          {/* Filter status */}
          <div className="flex rounded-xl border border-slate-700/60 overflow-hidden text-xs font-semibold">
            {(
              [
                { key: 'all', label: `Semua (${stats.all})` },
                { key: 'correct', label: `✓ Benar (${stats.correct})` },
                { key: 'wrong', label: `✗ Salah (${stats.wrong})` },
                { key: 'empty', label: `— Kosong (${stats.empty})` },
                { key: 'flagged', label: `🚩 Ragu (${stats.flagged})` },
              ] as { key: FilterType; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-2 transition-colors ${
                  filter === key
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-slate-800/50 animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Daftar soal */}
        {!isLoading && !error && (
          <div className="flex flex-col gap-3">
            {filtered.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <p className="text-4xl mb-3">🔍</p>
                <p>Tidak ada soal untuk filter ini</p>
              </div>
            )}

            {filtered.map((item) => {
              const isExpanded = expandedId === item.id
              const sectionConfig = SECTION_CONFIG[item.section]
              const opts = optionTexts(item)

              return (
                <div
                  key={item.id}
                  className={`
                    rounded-xl border transition-all
                    ${item.is_correct
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : item.user_answer === null
                      ? 'border-slate-700/50 bg-slate-800/30'
                      : 'border-red-500/30 bg-red-500/5'
                    }
                  `}
                >
                  {/* Row header — klik untuk expand */}
                  <button
                    className="w-full flex items-start gap-3 p-4 text-left"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    {/* Status icon */}
                    <div className={`
                      flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm mt-0.5
                      ${item.is_correct
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : item.user_answer === null
                        ? 'bg-slate-700 text-slate-500'
                        : 'bg-red-500/20 text-red-400'
                      }
                    `}>
                      {item.is_correct ? '✓' : item.user_answer === null ? '—' : '✗'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-500">
                          Soal {item.question_order}
                        </span>
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: `${sectionConfig.color}20`, color: sectionConfig.color }}
                        >
                          {item.section}
                        </span>
                        {item.is_flagged && <span className="text-[10px] text-amber-400">🚩</span>}
                      </div>
                      <p className="text-sm text-slate-200 line-clamp-2">{item.content}</p>
                    </div>

                    {/* Jawaban user & kunci */}
                    <div className="flex-shrink-0 flex items-center gap-2 text-xs">
                      {item.user_answer && (
                        <span className={`
                          px-2 py-1 rounded-lg font-bold
                          ${item.is_correct ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}
                        `}>
                          {item.user_answer}
                        </span>
                      )}
                      {!item.is_correct && (
                        <span className="px-2 py-1 rounded-lg font-bold bg-emerald-500/20 text-emerald-400">
                          {item.correct_answer}
                        </span>
                      )}
                      <ChevronIcon className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-700/40 pt-4">
                      {/* Konten soal penuh */}
                      <p className="text-sm text-slate-200 leading-relaxed mb-4">{item.content}</p>

                      {/* Pilihan jawaban */}
                      <div className="flex flex-col gap-2 mb-4">
                        {OPTIONS.map((opt) => {
                          const text = opts[opt]
                          if (!text) return null
                          const isUserAnswer = item.user_answer === opt
                          const isCorrect = item.correct_answer === opt

                          return (
                            <div
                              key={opt}
                              className={`
                                flex items-start gap-3 p-3 rounded-xl border text-sm
                                ${isCorrect
                                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-100'
                                  : isUserAnswer && !isCorrect
                                  ? 'bg-red-500/15 border-red-500/50 text-red-200'
                                  : 'bg-slate-800/30 border-slate-700/30 text-slate-400'
                                }
                              `}
                            >
                              <div className={`
                                flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold
                                ${isCorrect
                                  ? 'bg-emerald-500 text-white'
                                  : isUserAnswer && !isCorrect
                                  ? 'bg-red-500 text-white'
                                  : 'bg-slate-700 text-slate-400'
                                }
                              `}>
                                {opt}
                              </div>
                              <span className="flex-1">{text}</span>
                              {isCorrect && <span className="text-emerald-400 text-xs font-bold flex-shrink-0">✓ Benar</span>}
                              {isUserAnswer && !isCorrect && <span className="text-red-400 text-xs font-bold flex-shrink-0">✗ Pilihanmu</span>}
                            </div>
                          )
                        })}
                      </div>

                      {/* Penjelasan */}
                      {item.explanation && (
                        <div className="rounded-xl bg-blue-500/10 border border-blue-500/30 p-4">
                          <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">
                            💡 Pembahasan
                          </p>
                          <p className="text-sm text-blue-100/90 leading-relaxed">{item.explanation}</p>
                        </div>
                      )}

                      {/* Poin */}
                      <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
                        <span>Poin benar: <strong className="text-emerald-400">+{item.points_correct}</strong></span>
                        {item.points_wrong !== 0 && (
                          <span>Poin salah: <strong className="text-red-400">{item.points_wrong}</strong></span>
                        )}
                        {item.answered_at && (
                          <span className="ml-auto">
                            Dijawab: {new Date(item.answered_at).toLocaleTimeString('id-ID')}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

function StatCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${bg}`}>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  )
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
