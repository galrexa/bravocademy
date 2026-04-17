# SETUP_FASE_B.ps1
# Jalankan dari ROOT project: .\SETUP_FASE_B.ps1
# PowerShell: klik kanan → "Run with PowerShell"
# atau di terminal: Set-ExecutionPolicy Bypass -Scope Process; .\SETUP_FASE_B.ps1

$root = $PSScriptRoot

Write-Host "=== Setup Fase B Bravocademy ===" -ForegroundColor Cyan
Write-Host "Root: $root"

function EnsureDir($path) {
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
        Write-Host "  Created: $path" -ForegroundColor DarkGray
    }
}

function WriteFile($relPath, $content) {
    $full = Join-Path $root $relPath
    EnsureDir (Split-Path $full -Parent)
    [System.IO.File]::WriteAllText($full, $content, [System.Text.Encoding]::UTF8)
    Write-Host "  OK: $relPath" -ForegroundColor Green
}

# ─── 1. vitest.config.ts ──────────────────────────────────────────────────────
Write-Host "`n[1/3] vitest.config.ts" -ForegroundColor Yellow
WriteFile "vitest.config.ts" @'
// vitest.config.ts
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/__tests__/**", "src/**/*.d.ts"],
    },
    testTimeout: 15000,
  },
})
'@

# ─── 2. src/lib/exam-utils.ts ─────────────────────────────────────────────────
Write-Host "`n[2/3] src/lib dan src/hooks" -ForegroundColor Yellow

WriteFile "src/lib/exam-utils.ts" @'
// src/lib/exam-utils.ts
export type ExamSection = "TWK" | "TIU" | "TKP"

export interface Question {
  id: string
  question_number: number
  content: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  option_e: string
  section: ExamSection
  correct_answer?: string
  explanation?: string
  points_correct?: number
  points_wrong?: number
}

export interface ExamSession {
  id: string
  user_id: string
  module_id: string
  module_name: string
  started_at: string
  expires_at: string
  submitted_at?: string
  status: "in_progress" | "submitted" | "expired"
}

export interface UserAnswer {
  question_id: string
  selected_option: string | null
  is_flagged: boolean
  answered_at?: string
}

export interface ExamResult {
  session_id: string
  user_id: string
  module_name: string
  total_score: number
  twk_score: number
  tiu_score: number
  tkp_score: number
  twk_correct: number
  tiu_correct: number
  tkp_correct: number
  twk_total: number
  tiu_total: number
  tkp_total: number
  duration_seconds: number
  rank?: number
  percentile?: number
  passed: boolean
}

export interface LeaderboardEntry {
  rank: number
  user_id: string
  display_name: string
  avatar_url?: string
  total_score: number
  twk_score: number
  tiu_score: number
  tkp_score: number
  duration_seconds: number
  submitted_at: string
  is_current_user?: boolean
}

export const PASSING_GRADES = {
  TWK: 65,
  TIU: 80,
  TKP: 166,
  TOTAL: 311,
}

export const SECTION_CONFIG: Record<
  ExamSection,
  { label: string; color: string; bgColor: string; questions: number; timeMinutes: number }
> = {
  TWK: { label: "Tes Wawasan Kebangsaan",    color: "#3b82f6", bgColor: "#eff6ff", questions: 30, timeMinutes: 30 },
  TIU: { label: "Tes Intelegensia Umum",     color: "#8b5cf6", bgColor: "#f5f3ff", questions: 35, timeMinutes: 35 },
  TKP: { label: "Tes Karakteristik Pribadi", color: "#10b981", bgColor: "#ecfdf5", questions: 45, timeMinutes: 30 },
}

export function formatTime(seconds: number): string {
  if (seconds <= 0) return "00:00"
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s} detik`
  if (s === 0) return `${m} menit`
  return `${m} menit ${s} detik`
}

export function getSecondsRemaining(expiresAt: string): number {
  const expiresMs = new Date(expiresAt).getTime()
  const nowMs = Date.now()
  return Math.max(0, Math.floor((expiresMs - nowMs) / 1000))
}

export function calcProgress(answers: Record<string, UserAnswer>, totalQuestions: number) {
  const answered = Object.values(answers).filter((a) => a.selected_option !== null).length
  const flagged  = Object.values(answers).filter((a) => a.is_flagged).length
  const unanswered = totalQuestions - answered
  return { answered, flagged, unanswered, percentage: Math.round((answered / totalQuestions) * 100) }
}

export function getTimerColor(secondsLeft: number, totalSeconds: number): string {
  const ratio = secondsLeft / totalSeconds
  if (ratio > 0.5) return "text-emerald-400"
  if (ratio > 0.25) return "text-amber-400"
  return "text-red-400"
}

export type QuestionStatus = "unanswered" | "answered" | "flagged" | "answered_flagged"

export function getQuestionStatus(answer?: UserAnswer): QuestionStatus {
  if (!answer) return "unanswered"
  const hasAnswer = answer.selected_option !== null
  const isFlagged = answer.is_flagged
  if (hasAnswer && isFlagged) return "answered_flagged"
  if (hasAnswer) return "answered"
  if (isFlagged) return "flagged"
  return "unanswered"
}
'@

# ─── 3. src/hooks/ ────────────────────────────────────────────────────────────
WriteFile "src/hooks/useServerTimer.ts" @'
// src/hooks/useServerTimer.ts
import { useState, useEffect, useRef, useCallback } from "react"
import { getSecondsRemaining } from "@/lib/exam-utils"

interface UseServerTimerOptions {
  expiresAt: string
  onExpire?: () => void
  onWarning?: (seconds: number) => void
  warningThreshold?: number
}

interface TimerState {
  secondsLeft: number
  isExpired: boolean
  isWarning: boolean
}

export function useServerTimer({
  expiresAt,
  onExpire,
  onWarning,
  warningThreshold = 300,
}: UseServerTimerOptions): TimerState {
  const [secondsLeft, setSecondsLeft] = useState<number>(() => getSecondsRemaining(expiresAt))
  const intervalRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const onExpireRef      = useRef(onExpire)
  const onWarningRef     = useRef(onWarning)
  const warningFiredRef  = useRef(false)

  useEffect(() => { onExpireRef.current  = onExpire  }, [onExpire])
  useEffect(() => { onWarningRef.current = onWarning }, [onWarning])

  const tick = useCallback(() => {
    const remaining = getSecondsRemaining(expiresAt)
    setSecondsLeft(remaining)
    if (remaining <= 0) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      onExpireRef.current?.()
      return
    }
    if (!warningFiredRef.current && remaining <= warningThreshold) {
      warningFiredRef.current = true
      onWarningRef.current?.(remaining)
    }
  }, [expiresAt, warningThreshold])

  useEffect(() => {
    warningFiredRef.current = false
    const initial = getSecondsRemaining(expiresAt)
    setSecondsLeft(initial)

    if (initial <= 0) {
      onExpireRef.current?.()
      return
    }
    if (initial <= warningThreshold) {
      warningFiredRef.current = true
      onWarningRef.current?.(initial)
    }

    intervalRef.current = setInterval(tick, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [expiresAt, tick, warningThreshold])

  return { secondsLeft, isExpired: secondsLeft <= 0, isWarning: secondsLeft > 0 && secondsLeft <= warningThreshold }
}
'@

WriteFile "src/hooks/useAutoSave.ts" @'
// src/hooks/useAutoSave.ts
import { useState, useEffect, useRef, useCallback } from "react"

export type SaveStatus = "idle" | "saving" | "saved" | "error"

interface SavePayload {
  session_id: string
  question_id: string
  selected_option: string | null
  is_flagged: boolean
}

interface UseAutoSaveOptions {
  debounceMs?: number
  retryCount?: number
}

interface UseAutoSaveReturn {
  saveStatus: SaveStatus
  lastSavedAt: Date | null
  saveAnswer: (payload: SavePayload) => void
  pendingCount: number
}

export function useAutoSave({ debounceMs = 300, retryCount = 3 }: UseAutoSaveOptions = {}): UseAutoSaveReturn {
  const [saveStatus,   setSaveStatus]   = useState<SaveStatus>("idle")
  const [lastSavedAt,  setLastSavedAt]  = useState<Date | null>(null)
  const [pendingCount, setPendingCount] = useState(0)

  const pendingRef = useRef<Map<string, SavePayload>>(new Map())
  const timerRef   = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const retryRef   = useRef<Map<string, number>>(new Map())

  const doSave = useCallback(async (payload: SavePayload) => {
    const key = payload.question_id
    setSaveStatus("saving")
    setPendingCount((c) => c + 1)
    try {
      const res = await fetch("/api/exam/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 410) {
          setSaveStatus("error")
          pendingRef.current.delete(key)
          setPendingCount((c) => Math.max(0, c - 1))
          return
        }
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      pendingRef.current.delete(key)
      retryRef.current.delete(key)
      setLastSavedAt(new Date())
      setSaveStatus("saved")
      setPendingCount((c) => Math.max(0, c - 1))
      setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2000)
    } catch (err) {
      const attempts = retryRef.current.get(key) ?? 0
      if (attempts < retryCount) {
        retryRef.current.set(key, attempts + 1)
        const delay = Math.pow(2, attempts) * 500
        setTimeout(() => doSave(payload), delay)
      } else {
        retryRef.current.delete(key)
        pendingRef.current.delete(key)
        setSaveStatus("error")
        setPendingCount((c) => Math.max(0, c - 1))
      }
    }
  }, [retryCount])

  const saveAnswer = useCallback((payload: SavePayload) => {
    const key = payload.question_id
    pendingRef.current.set(key, payload)
    const existingTimer = timerRef.current.get(key)
    if (existingTimer) clearTimeout(existingTimer)
    const timer = setTimeout(() => {
      const latestPayload = pendingRef.current.get(key)
      if (latestPayload) { timerRef.current.delete(key); doSave(latestPayload) }
    }, debounceMs)
    timerRef.current.set(key, timer)
    setSaveStatus("saving")
  }, [debounceMs, doSave])

  useEffect(() => {
    return () => { timerRef.current.forEach((timer) => clearTimeout(timer)) }
  }, [])

  return { saveStatus, lastSavedAt, saveAnswer, pendingCount }
}
'@

WriteFile "src/hooks/useExamSession.ts" @'
// src/hooks/useExamSession.ts
import { useState, useCallback } from "react"
import { Question, UserAnswer, ExamSession } from "@/lib/exam-utils"

interface UseExamSessionProps {
  session: ExamSession
  questions: Question[]
  initialAnswers?: Record<string, UserAnswer>
  onAnswerChange?: (questionId: string, answer: UserAnswer) => void
  onSubmit?: () => void
}

interface UseExamSessionReturn {
  currentIndex: number
  currentQuestion: Question | null
  answers: Record<string, UserAnswer>
  isSubmitting: boolean
  showSubmitConfirm: boolean
  goToQuestion: (index: number) => void
  goNext: () => void
  goPrev: () => void
  selectAnswer: (option: string) => void
  toggleFlag: () => void
  triggerSubmit: () => void
  cancelSubmit: () => void
  confirmSubmit: () => Promise<void>
  answeredCount: number
  flaggedCount: number
  unansweredCount: number
}

export function useExamSession({
  session, questions, initialAnswers = {}, onAnswerChange, onSubmit,
}: UseExamSessionProps): UseExamSessionReturn {
  const [currentIndex,      setCurrentIndex]      = useState(0)
  const [answers,           setAnswers]            = useState<Record<string, UserAnswer>>(initialAnswers)
  const [isSubmitting,      setIsSubmitting]       = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm]  = useState(false)

  const currentQuestion = questions[currentIndex] ?? null

  const goToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < questions.length) setCurrentIndex(index)
  }, [questions.length])

  const goNext = useCallback(() => setCurrentIndex((i) => Math.min(i + 1, questions.length - 1)), [questions.length])
  const goPrev = useCallback(() => setCurrentIndex((i) => Math.max(i - 1, 0)), [])

  const selectAnswer = useCallback((option: string) => {
    if (!currentQuestion) return
    setAnswers((prev) => {
      const current = prev[currentQuestion.id] ?? { question_id: currentQuestion.id, selected_option: null, is_flagged: false }
      const newOption = current.selected_option === option ? null : option
      const updated: UserAnswer = { ...current, selected_option: newOption, answered_at: new Date().toISOString() }
      onAnswerChange?.(currentQuestion.id, updated)
      return { ...prev, [currentQuestion.id]: updated }
    })
  }, [currentQuestion, onAnswerChange])

  const toggleFlag = useCallback(() => {
    if (!currentQuestion) return
    setAnswers((prev) => {
      const current = prev[currentQuestion.id] ?? { question_id: currentQuestion.id, selected_option: null, is_flagged: false }
      const updated: UserAnswer = { ...current, is_flagged: !current.is_flagged }
      onAnswerChange?.(currentQuestion.id, updated)
      return { ...prev, [currentQuestion.id]: updated }
    })
  }, [currentQuestion, onAnswerChange])

  const triggerSubmit  = useCallback(() => setShowSubmitConfirm(true), [])
  const cancelSubmit   = useCallback(() => setShowSubmitConfirm(false), [])

  const confirmSubmit = useCallback(async () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setShowSubmitConfirm(false)
    try {
      const res = await fetch("/api/exam/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session.id }),
      })
      if (!res.ok) throw new Error("Submit gagal")
      onSubmit?.()
    } catch (err) {
      console.error("confirmSubmit error:", err)
      setIsSubmitting(false)
    }
  }, [isSubmitting, session.id, onSubmit])

  const answeredCount  = Object.values(answers).filter((a) => a.selected_option !== null).length
  const flaggedCount   = Object.values(answers).filter((a) => a.is_flagged).length
  const unansweredCount = questions.length - answeredCount

  return {
    currentIndex, currentQuestion, answers, isSubmitting, showSubmitConfirm,
    goToQuestion, goNext, goPrev, selectAnswer, toggleFlag,
    triggerSubmit, cancelSubmit, confirmSubmit,
    answeredCount, flaggedCount, unansweredCount,
  }
}
'@

# ─── 4. API routes ────────────────────────────────────────────────────────────
Write-Host "`n[3/3] src/app/api/exam/ routes" -ForegroundColor Yellow

WriteFile "src/app/api/exam/answer/route.ts" @'
// src/app/api/exam/answer/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { z } from "zod"

const AnswerSchema = z.object({
  session_id:      z.string().uuid(),
  question_id:     z.string().uuid(),
  selected_option: z.enum(["A","B","C","D","E"]).nullable(),
  is_flagged:      z.boolean().default(false),
})

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body   = await req.json()
    const parsed = AnswerSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Validasi gagal", details: parsed.error.flatten() }, { status: 400 })

    const { session_id, question_id, selected_option, is_flagged } = parsed.data

    const { data: session, error: sessionError } = await supabase
      .from("exam_sessions").select("id, expires_at, status")
      .eq("id", session_id).eq("user_id", user.id).single()

    if (sessionError || !session) return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 })
    if (session.status !== "in_progress") return NextResponse.json({ error: "Sesi ujian sudah berakhir" }, { status: 409 })
    if (new Date(session.expires_at) < new Date()) {
      await supabase.from("exam_sessions").update({ status: "expired", submitted_at: new Date().toISOString() }).eq("id", session_id)
      return NextResponse.json({ error: "Waktu ujian sudah habis" }, { status: 410 })
    }

    const { error: upsertError } = await supabase.from("exam_answers").upsert(
      { session_id, question_id, user_id: user.id, selected_option, is_flagged, answered_at: new Date().toISOString() },
      { onConflict: "session_id,question_id", ignoreDuplicates: false }
    )
    if (upsertError) return NextResponse.json({ error: "Gagal menyimpan jawaban" }, { status: 500 })

    return NextResponse.json({ success: true, saved_at: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
'@

WriteFile "src/app/api/exam/start/route.ts" @'
// src/app/api/exam/start/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { z } from "zod"

const StartSchema = z.object({
  module_id: z.string().uuid("module_id harus berupa UUID valid"),
})

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body   = await req.json()
    const parsed = StartSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Validasi gagal", details: parsed.error.flatten() }, { status: 400 })

    const { module_id } = parsed.data

    const { data: access, error: accessError } = await supabase
      .from("user_module_access").select("id, expires_at")
      .eq("user_id", user.id).eq("module_id", module_id).maybeSingle()

    if (accessError) return NextResponse.json({ error: "Gagal verifikasi akses modul" }, { status: 500 })
    if (!access)     return NextResponse.json({ error: "Kamu tidak memiliki akses ke modul ini" }, { status: 403 })

    const { data: existingSession } = await supabase
      .from("exam_sessions").select("id, expires_at, status")
      .eq("user_id", user.id).eq("module_id", module_id).eq("status", "in_progress").maybeSingle()

    if (existingSession && new Date(existingSession.expires_at) > new Date()) {
      return NextResponse.json({ session_id: existingSession.id, expires_at: existingSession.expires_at, resumed: true })
    }

    const { data: sessionData, error: sessionError } = await supabase.rpc("start_exam_session", { p_user_id: user.id, p_module_id: module_id })
    if (sessionError) return NextResponse.json({ error: "Gagal memulai sesi ujian", detail: sessionError.message }, { status: 500 })

    return NextResponse.json({ session_id: sessionData.session_id, expires_at: sessionData.expires_at, resumed: false })
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
'@

WriteFile "src/app/api/exam/submit/route.ts" @'
// src/app/api/exam/submit/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { z } from "zod"

const SubmitSchema = z.object({
  session_id: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body   = await req.json()
    const parsed = SubmitSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "session_id tidak valid" }, { status: 400 })

    const { session_id } = parsed.data

    const { data: session } = await supabase
      .from("exam_sessions").select("id, status, expires_at, user_id")
      .eq("id", session_id).eq("user_id", user.id).single()

    if (!session) return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 })
    if (session.status === "submitted") return NextResponse.json({ session_id, already_submitted: true })

    const { data: result, error: submitError } = await supabase.rpc("submit_exam_session", { p_session_id: session_id, p_user_id: user.id })
    if (submitError) return NextResponse.json({ error: "Gagal submit ujian", detail: submitError.message }, { status: 500 })

    return NextResponse.json({ success: true, session_id, result_id: result?.result_id })
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
'@

Write-Host "`n=== Selesai! ===" -ForegroundColor Cyan
Write-Host "File yang dibuat/diupdate:" -ForegroundColor Cyan
Write-Host "  vitest.config.ts"
Write-Host "  src/lib/exam-utils.ts"
Write-Host "  src/hooks/useServerTimer.ts"
Write-Host "  src/hooks/useAutoSave.ts"
Write-Host "  src/hooks/useExamSession.ts"
Write-Host "  src/app/api/exam/answer/route.ts"
Write-Host "  src/app/api/exam/start/route.ts"
Write-Host "  src/app/api/exam/submit/route.ts"
Write-Host "`nJalankan: npm test" -ForegroundColor Green
