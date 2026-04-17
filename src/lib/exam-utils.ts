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
  if (ratio >= 0.5) return "text-emerald-400"
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