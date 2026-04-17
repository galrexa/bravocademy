// src/__tests__/unit/exam-utils.test.ts
// Unit test untuk lib/exam-utils.ts — tidak butuh network/database

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  formatTime,
  formatDuration,
  getSecondsRemaining,
  calcProgress,
  getTimerColor,
  getQuestionStatus,
  PASSING_GRADES,
  SECTION_CONFIG,
} from '@/lib/exam-utils'
import type { UserAnswer } from '@/lib/exam-utils'

// ── formatTime ────────────────────────────────────────────────────────────────
describe('formatTime', () => {
  it('format 0 detik → 00:00', () => {
    expect(formatTime(0)).toBe('00:00')
  })

  it('format negatif → 00:00', () => {
    expect(formatTime(-5)).toBe('00:00')
  })

  it('format 90 detik → 01:30', () => {
    expect(formatTime(90)).toBe('01:30')
  })

  it('format 3600 detik → 60:00', () => {
    expect(formatTime(3600)).toBe('60:00')
  })

  it('format 6000 detik (100 menit) → 100:00', () => {
    expect(formatTime(6000)).toBe('100:00')
  })

  it('padding nol di detik → 01:05', () => {
    expect(formatTime(65)).toBe('01:05')
  })
})

// ── formatDuration ────────────────────────────────────────────────────────────
describe('formatDuration', () => {
  it('kurang dari 1 menit', () => {
    expect(formatDuration(45)).toBe('45 detik')
  })

  it('tepat 1 menit', () => {
    expect(formatDuration(60)).toBe('1 menit')
  })

  it('menit dan detik', () => {
    expect(formatDuration(125)).toBe('2 menit 5 detik')
  })
})

// ── getSecondsRemaining ───────────────────────────────────────────────────────
describe('getSecondsRemaining', () => {
  beforeEach(() => {
    // Freeze time ke 2024-01-01T00:00:00Z
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('expires_at di masa depan → sisa detik positif', () => {
    const expiresAt = new Date('2024-01-01T00:10:00Z').toISOString() // +10 menit
    expect(getSecondsRemaining(expiresAt)).toBe(600)
  })

  it('expires_at sudah lewat → 0', () => {
    const expiresAt = new Date('2023-12-31T23:59:00Z').toISOString()
    expect(getSecondsRemaining(expiresAt)).toBe(0)
  })

  it('expires_at tepat sekarang → 0', () => {
    const expiresAt = new Date('2024-01-01T00:00:00Z').toISOString()
    expect(getSecondsRemaining(expiresAt)).toBe(0)
  })
})

// ── calcProgress ──────────────────────────────────────────────────────────────
describe('calcProgress', () => {
  const makeAnswer = (opt: string | null, flagged = false): UserAnswer => ({
    question_id: 'q1',
    selected_option: opt,
    is_flagged: flagged,
  })

  it('semua belum dijawab', () => {
    const result = calcProgress({}, 10)
    expect(result).toEqual({ answered: 0, flagged: 0, unanswered: 10, percentage: 0 })
  })

  it('sebagian dijawab', () => {
    const answers = {
      q1: makeAnswer('A'),
      q2: makeAnswer('B'),
      q3: makeAnswer(null),
    }
    const result = calcProgress(answers, 5)
    expect(result.answered).toBe(2)
    expect(result.unanswered).toBe(3)
    expect(result.percentage).toBe(40)
  })

  it('semua dijawab', () => {
    const answers = {
      q1: makeAnswer('A'),
      q2: makeAnswer('B'),
    }
    const result = calcProgress(answers, 2)
    expect(result.percentage).toBe(100)
  })

  it('hitung flagged', () => {
    const answers = {
      q1: makeAnswer('A', true),
      q2: makeAnswer(null, true),
      q3: makeAnswer('C', false),
    }
    const result = calcProgress(answers, 5)
    expect(result.flagged).toBe(2)
  })
})

// ── getTimerColor ─────────────────────────────────────────────────────────────
describe('getTimerColor', () => {
  it('>50% sisa waktu → hijau', () => {
    expect(getTimerColor(600, 1000)).toBe('text-emerald-400')
  })

  it('25–50% sisa waktu → kuning', () => {
    expect(getTimerColor(300, 1000)).toBe('text-amber-400')
  })

  it('<25% sisa waktu → merah', () => {
    expect(getTimerColor(100, 1000)).toBe('text-red-400')
  })

  it('tepat 50% → masih hijau', () => {
    expect(getTimerColor(500, 1000)).toBe('text-emerald-400')
  })
})

// ── getQuestionStatus ─────────────────────────────────────────────────────────
describe('getQuestionStatus', () => {
  it('undefined → unanswered', () => {
    expect(getQuestionStatus(undefined)).toBe('unanswered')
  })

  it('tidak ada jawaban, tidak di-flag → unanswered', () => {
    const answer: UserAnswer = { question_id: 'q1', selected_option: null, is_flagged: false }
    expect(getQuestionStatus(answer)).toBe('unanswered')
  })

  it('ada jawaban, tidak di-flag → answered', () => {
    const answer: UserAnswer = { question_id: 'q1', selected_option: 'A', is_flagged: false }
    expect(getQuestionStatus(answer)).toBe('answered')
  })

  it('tidak ada jawaban, di-flag → flagged', () => {
    const answer: UserAnswer = { question_id: 'q1', selected_option: null, is_flagged: true }
    expect(getQuestionStatus(answer)).toBe('flagged')
  })

  it('ada jawaban + di-flag → answered_flagged', () => {
    const answer: UserAnswer = { question_id: 'q1', selected_option: 'B', is_flagged: true }
    expect(getQuestionStatus(answer)).toBe('answered_flagged')
  })
})

// ── Konstanta ─────────────────────────────────────────────────────────────────
describe('PASSING_GRADES', () => {
  it('nilai TWK benar', () => expect(PASSING_GRADES.TWK).toBe(65))
  it('nilai TIU benar', () => expect(PASSING_GRADES.TIU).toBe(80))
  it('nilai TKP benar', () => expect(PASSING_GRADES.TKP).toBe(166))
  it('nilai TOTAL benar', () => expect(PASSING_GRADES.TOTAL).toBe(311))
})

describe('SECTION_CONFIG', () => {
  it('TWK punya 30 soal', () => expect(SECTION_CONFIG.TWK.questions).toBe(30))
  it('TIU punya 35 soal', () => expect(SECTION_CONFIG.TIU.questions).toBe(35))
  it('TKP punya 45 soal', () => expect(SECTION_CONFIG.TKP.questions).toBe(45))
  it('total soal = 110', () => {
    const total = Object.values(SECTION_CONFIG).reduce((acc, s) => acc + s.questions, 0)
    expect(total).toBe(110)
  })
})
