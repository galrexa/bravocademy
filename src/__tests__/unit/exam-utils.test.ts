// src/__tests__/unit/exam-utils.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  formatTime, formatDuration, getSecondsRemaining,
  calcProgress, getTimerColor, getQuestionStatus,
  PASSING_GRADES, SECTION_CONFIG,
} from '@/lib/exam-utils'
import type { UserAnswer } from '@/lib/exam-utils'

describe('formatTime', () => {
  it('format 0 detik → 00:00',            () => expect(formatTime(0)).toBe('00:00'))
  it('format negatif → 00:00',            () => expect(formatTime(-5)).toBe('00:00'))
  it('format 90 detik → 01:30',           () => expect(formatTime(90)).toBe('01:30'))
  it('format 3600 detik → 60:00',         () => expect(formatTime(3600)).toBe('60:00'))
  it('format 6000 detik (100 menit) → 100:00', () => expect(formatTime(6000)).toBe('100:00'))
  it('padding nol di detik → 01:05',      () => expect(formatTime(65)).toBe('01:05'))
})

describe('formatDuration', () => {
  it('kurang dari 1 menit',  () => expect(formatDuration(45)).toBe('45 detik'))
  it('tepat 1 menit',        () => expect(formatDuration(60)).toBe('1 menit'))
  it('menit dan detik',      () => expect(formatDuration(125)).toBe('2 menit 5 detik'))
})

describe('getSecondsRemaining', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2024-01-01T00:00:00Z')) })
  afterEach(() => vi.useRealTimers())

  it('expires_at di masa depan → sisa detik positif', () => {
    expect(getSecondsRemaining(new Date('2024-01-01T00:10:00Z').toISOString())).toBe(600)
  })
  it('expires_at sudah lewat → 0', () => {
    expect(getSecondsRemaining(new Date('2023-12-31T23:59:00Z').toISOString())).toBe(0)
  })
  it('expires_at tepat sekarang → 0', () => {
    expect(getSecondsRemaining(new Date('2024-01-01T00:00:00Z').toISOString())).toBe(0)
  })
})

describe('calcProgress', () => {
  const a = (opt: string | null, flagged = false): UserAnswer =>
    ({ question_id: 'q1', selected_option: opt, is_flagged: flagged })

  it('semua belum dijawab', () =>
    expect(calcProgress({}, 10)).toEqual({ answered: 0, flagged: 0, unanswered: 10, percentage: 0 }))

  it('sebagian dijawab', () => {
    const r = calcProgress({ q1: a('A'), q2: a('B'), q3: a(null) }, 5)
    expect(r.answered).toBe(2)
    expect(r.unanswered).toBe(3)
    expect(r.percentage).toBe(40)
  })

  it('semua dijawab', () =>
    expect(calcProgress({ q1: a('A'), q2: a('B') }, 2).percentage).toBe(100))

  it('hitung flagged', () =>
    expect(calcProgress({ q1: a('A', true), q2: a(null, true), q3: a('C') }, 5).flagged).toBe(2))
})

describe('getTimerColor', () => {
  it('>50% sisa waktu → hijau',    () => expect(getTimerColor(600, 1000)).toBe('text-emerald-400'))
  it('25–50% sisa waktu → kuning', () => expect(getTimerColor(300, 1000)).toBe('text-amber-400'))
  it('<25% sisa waktu → merah',    () => expect(getTimerColor(100, 1000)).toBe('text-red-400'))
  // tepat 50% — ratio === 0.5, masuk kondisi >= 0.5 → hijau
  it('tepat 50% → masih hijau',    () => expect(getTimerColor(500, 1000)).toBe('text-emerald-400'))
})

describe('getQuestionStatus', () => {
  it('undefined → unanswered', () => expect(getQuestionStatus(undefined)).toBe('unanswered'))
  it('null answer, not flagged → unanswered', () =>
    expect(getQuestionStatus({ question_id: 'q', selected_option: null, is_flagged: false })).toBe('unanswered'))
  it('answered, not flagged → answered', () =>
    expect(getQuestionStatus({ question_id: 'q', selected_option: 'A', is_flagged: false })).toBe('answered'))
  it('null answer, flagged → flagged', () =>
    expect(getQuestionStatus({ question_id: 'q', selected_option: null, is_flagged: true })).toBe('flagged'))
  it('answered + flagged → answered_flagged', () =>
    expect(getQuestionStatus({ question_id: 'q', selected_option: 'B', is_flagged: true })).toBe('answered_flagged'))
})

describe('PASSING_GRADES', () => {
  it('TWK',   () => expect(PASSING_GRADES.TWK).toBe(65))
  it('TIU',   () => expect(PASSING_GRADES.TIU).toBe(80))
  it('TKP',   () => expect(PASSING_GRADES.TKP).toBe(166))
  it('TOTAL', () => expect(PASSING_GRADES.TOTAL).toBe(311))
})

describe('SECTION_CONFIG', () => {
  it('TWK 30 soal',   () => expect(SECTION_CONFIG.TWK.questions).toBe(30))
  it('TIU 35 soal',   () => expect(SECTION_CONFIG.TIU.questions).toBe(35))
  it('TKP 45 soal',   () => expect(SECTION_CONFIG.TKP.questions).toBe(45))
  it('total 110',     () =>
    expect(Object.values(SECTION_CONFIG).reduce((s, c) => s + c.questions, 0)).toBe(110))
})