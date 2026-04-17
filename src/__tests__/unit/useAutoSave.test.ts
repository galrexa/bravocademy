// src/__tests__/unit/useAutoSave.test.ts
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAutoSave } from '@/hooks/useAutoSave'

const PAYLOAD = {
  session_id: 'sess-uuid',
  question_id: 'q-uuid',
  selected_option: 'A' as const,
  is_flagged: false,
}

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('status awal adalah idle', () => {
    const { result } = renderHook(() => useAutoSave())
    expect(result.current.saveStatus).toBe('idle')
    expect(result.current.lastSavedAt).toBeNull()
  })

  it('status berubah ke saving setelah saveAnswer dipanggil', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, saved_at: new Date().toISOString() }),
    })

    const { result } = renderHook(() => useAutoSave({ debounceMs: 300 }))

    act(() => { result.current.saveAnswer(PAYLOAD) })
    expect(result.current.saveStatus).toBe('saving')
  })

  it('debounce: hanya satu request yang dikirim untuk soal yang sama', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, saved_at: new Date().toISOString() }),
    })
    global.fetch = fetchMock

    const { result } = renderHook(() => useAutoSave({ debounceMs: 300 }))

    // Panggil 3x dengan cepat untuk soal yang sama
    act(() => {
      result.current.saveAnswer({ ...PAYLOAD, selected_option: 'A' })
      result.current.saveAnswer({ ...PAYLOAD, selected_option: 'B' })
      result.current.saveAnswer({ ...PAYLOAD, selected_option: 'C' })
    })

    // Jalankan timer debounce
    await act(async () => { vi.advanceTimersByTime(400) })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    // Hanya satu panggilan dengan nilai terakhir ('C')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.selected_option).toBe('C')
  })

  it('status berubah ke saved setelah fetch berhasil', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, saved_at: new Date().toISOString() }),
    })

    const { result } = renderHook(() => useAutoSave({ debounceMs: 100 }))

    act(() => { result.current.saveAnswer(PAYLOAD) })

    await act(async () => { vi.advanceTimersByTime(200) })
    await waitFor(() => expect(result.current.saveStatus).toBe('saved'))
    expect(result.current.lastSavedAt).not.toBeNull()
  })

  it('status berubah ke error saat fetch gagal permanen', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    })

    const { result } = renderHook(() =>
      useAutoSave({ debounceMs: 100, retryCount: 1 })
    )

    act(() => { result.current.saveAnswer(PAYLOAD) })

    // Debounce + retry delays
    await act(async () => { vi.advanceTimersByTime(5000) })
    await waitFor(() => expect(result.current.saveStatus).toBe('error'), {
      timeout: 3000,
    })
  })

  it('status 410 (waktu habis) → error, tidak retry', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 410,
      json: async () => ({ error: 'Waktu ujian sudah habis' }),
    })
    global.fetch = fetchMock

    const { result } = renderHook(() =>
      useAutoSave({ debounceMs: 100, retryCount: 3 })
    )

    act(() => { result.current.saveAnswer(PAYLOAD) })
    await act(async () => { vi.advanceTimersByTime(200) })
    await waitFor(() => expect(result.current.saveStatus).toBe('error'))

    // Tidak ada retry — hanya 1 panggilan
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('dua soal berbeda masing-masing dikirim sekali', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, saved_at: new Date().toISOString() }),
    })
    global.fetch = fetchMock

    const { result } = renderHook(() => useAutoSave({ debounceMs: 100 }))

    act(() => {
      result.current.saveAnswer({ ...PAYLOAD, question_id: 'q-1' })
      result.current.saveAnswer({ ...PAYLOAD, question_id: 'q-2' })
    })

    await act(async () => { vi.advanceTimersByTime(200) })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })
})
