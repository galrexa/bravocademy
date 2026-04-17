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