// src/__tests__/unit/useExamSession.test.ts
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useExamSession } from '@/hooks/useExamSession'
import type { Question, ExamSession } from '@/lib/exam-utils'

const mockSession: ExamSession = {
  id: 'sess-001',
  user_id: 'user-001',
  module_id: 'mod-001',
  module_name: 'SKD CPNS Test',
  started_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 6_000_000).toISOString(),
  status: 'in_progress',
}

const makeQ = (n: number, section: 'TWK' | 'TIU' | 'TKP' = 'TWK'): Question => ({
  id: `q-${n}`, question_number: n, content: `Pertanyaan ${n}`,
  option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D', option_e: 'E', section,
})

const questions: Question[] = [makeQ(1, 'TWK'), makeQ(2, 'TWK'), makeQ(3, 'TIU')]

describe('useExamSession — navigasi', () => {
  it('mulai dari soal pertama (index 0)', () => {
    const { result } = renderHook(() => useExamSession({ session: mockSession, questions }))
    expect(result.current.currentIndex).toBe(0)
    expect(result.current.currentQuestion?.id).toBe('q-1')
  })

  it('goNext pindah ke soal berikutnya', () => {
    const { result } = renderHook(() => useExamSession({ session: mockSession, questions }))
    act(() => result.current.goNext())
    expect(result.current.currentIndex).toBe(1)
  })

  it('goPrev tidak bisa kurang dari 0', () => {
    const { result } = renderHook(() => useExamSession({ session: mockSession, questions }))
    act(() => result.current.goPrev())
    expect(result.current.currentIndex).toBe(0)
  })

  it('goNext tidak bisa melebihi soal terakhir', () => {
    const { result } = renderHook(() => useExamSession({ session: mockSession, questions }))
    act(() => result.current.goNext())
    act(() => result.current.goNext())
    act(() => result.current.goNext()) // sudah di akhir
    expect(result.current.currentIndex).toBe(2)
  })

  it('goToQuestion lompat ke index tertentu', () => {
    const { result } = renderHook(() => useExamSession({ session: mockSession, questions }))
    act(() => result.current.goToQuestion(2))
    expect(result.current.currentIndex).toBe(2)
    expect(result.current.currentQuestion?.id).toBe('q-3')
  })

  it('goToQuestion index invalid diabaikan', () => {
    const { result } = renderHook(() => useExamSession({ session: mockSession, questions }))
    act(() => result.current.goToQuestion(-1))
    expect(result.current.currentIndex).toBe(0)
    act(() => result.current.goToQuestion(99))
    expect(result.current.currentIndex).toBe(0)
  })
})

describe('useExamSession — memilih jawaban', () => {
  it('selectAnswer menyimpan opsi yang dipilih', () => {
    const { result } = renderHook(() => useExamSession({ session: mockSession, questions }))
    act(() => result.current.selectAnswer('B'))
    expect(result.current.answers['q-1']?.selected_option).toBe('B')
  })

  it('selectAnswer dengan opsi sama → toggle (batalkan)', () => {
    const { result } = renderHook(() => useExamSession({ session: mockSession, questions }))
    act(() => result.current.selectAnswer('B'))
    act(() => result.current.selectAnswer('B'))
    expect(result.current.answers['q-1']?.selected_option).toBeNull()
  })

  it('selectAnswer opsi berbeda → ganti jawaban', () => {
    const { result } = renderHook(() => useExamSession({ session: mockSession, questions }))
    act(() => result.current.selectAnswer('A'))
    act(() => result.current.selectAnswer('C'))
    expect(result.current.answers['q-1']?.selected_option).toBe('C')
  })

  it('memanggil onAnswerChange callback', () => {
    const onAnswerChange = vi.fn()
    const { result } = renderHook(() =>
      useExamSession({ session: mockSession, questions, onAnswerChange }))
    act(() => result.current.selectAnswer('D'))
    expect(onAnswerChange).toHaveBeenCalledWith('q-1', expect.objectContaining({ selected_option: 'D' }))
  })
})

describe('useExamSession — flagging', () => {
  it('toggleFlag menandai soal sebagai ragu-ragu', () => {
    const { result } = renderHook(() => useExamSession({ session: mockSession, questions }))
    act(() => result.current.toggleFlag())
    expect(result.current.answers['q-1']?.is_flagged).toBe(true)
  })

  it('toggleFlag dua kali → kembali tidak di-flag', () => {
    const { result } = renderHook(() => useExamSession({ session: mockSession, questions }))
    act(() => result.current.toggleFlag())
    act(() => result.current.toggleFlag())
    expect(result.current.answers['q-1']?.is_flagged).toBe(false)
  })

  it('flag tidak menghapus jawaban yang sudah ada', () => {
    const { result } = renderHook(() => useExamSession({ session: mockSession, questions }))
    act(() => result.current.selectAnswer('E'))
    act(() => result.current.toggleFlag())
    expect(result.current.answers['q-1']?.selected_option).toBe('E')
    expect(result.current.answers['q-1']?.is_flagged).toBe(true)
  })
})

describe('useExamSession — statistik', () => {
  it('answeredCount dihitung dengan benar', () => {
    const { result } = renderHook(() => useExamSession({ session: mockSession, questions }))
    expect(result.current.answeredCount).toBe(0)

    // act() TERPISAH untuk setiap state update — goNext harus selesai sebelum selectAnswer berikutnya
    act(() => result.current.selectAnswer('A'))   // jawab q-1
    act(() => result.current.goNext())             // pindah ke q-2
    act(() => result.current.selectAnswer('B'))   // jawab q-2

    expect(result.current.answeredCount).toBe(2)
  })

  it('unansweredCount benar', () => {
    const { result } = renderHook(() => useExamSession({ session: mockSession, questions }))
    act(() => result.current.selectAnswer('A'))
    expect(result.current.unansweredCount).toBe(2)
  })

  it('flaggedCount benar', () => {
    const { result } = renderHook(() => useExamSession({ session: mockSession, questions }))

    // act() TERPISAH — goNext harus selesai sebelum toggleFlag di soal berikutnya
    act(() => result.current.toggleFlag())         // flag q-1
    act(() => result.current.goNext())             // pindah ke q-2
    act(() => result.current.toggleFlag())         // flag q-2

    expect(result.current.flaggedCount).toBe(2)
  })
})

describe('useExamSession — submit flow', () => {
  it('triggerSubmit menampilkan confirm dialog', () => {
    const { result } = renderHook(() => useExamSession({ session: mockSession, questions }))
    expect(result.current.showSubmitConfirm).toBe(false)
    act(() => result.current.triggerSubmit())
    expect(result.current.showSubmitConfirm).toBe(true)
  })

  it('cancelSubmit menutup confirm dialog', () => {
    const { result } = renderHook(() => useExamSession({ session: mockSession, questions }))
    act(() => result.current.triggerSubmit())
    act(() => result.current.cancelSubmit())
    expect(result.current.showSubmitConfirm).toBe(false)
  })

  it('initialAnswers di-load ke state', () => {
    const initialAnswers = {
      'q-1': { question_id: 'q-1', selected_option: 'C', is_flagged: true },
      'q-2': { question_id: 'q-2', selected_option: 'A', is_flagged: false },
    }
    const { result } = renderHook(() =>
      useExamSession({ session: mockSession, questions, initialAnswers }))
    expect(result.current.answers['q-1']?.selected_option).toBe('C')
    expect(result.current.answers['q-1']?.is_flagged).toBe(true)
    expect(result.current.answeredCount).toBe(2)
  })
})