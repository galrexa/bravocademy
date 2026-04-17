// src/__tests__/unit/useAutoSave.test.ts
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutoSave } from '@/hooks/useAutoSave'

const PAYLOAD = {
  session_id:      'sess-uuid',
  question_id:     'q-uuid',
  selected_option: 'A' as const,
  is_flagged:      false,
}

describe('useAutoSave', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('status awal adalah idle', () => {
    const { result } = renderHook(() => useAutoSave())
    expect(result.current.saveStatus).toBe('idle')
    expect(result.current.lastSavedAt).toBeNull()
  })

  it('status berubah ke saving segera setelah saveAnswer dipanggil', () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    const { result } = renderHook(() => useAutoSave({ debounceMs: 300 }))
    act(() => { result.current.saveAnswer(PAYLOAD) })
    expect(result.current.saveStatus).toBe('saving')
  })

  it('debounce: hanya satu fetch untuk soal yang sama', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    global.fetch = fetchMock

    const { result } = renderHook(() => useAutoSave({ debounceMs: 300 }))
    act(() => {
      result.current.saveAnswer({ ...PAYLOAD, selected_option: 'A' })
      result.current.saveAnswer({ ...PAYLOAD, selected_option: 'B' })
      result.current.saveAnswer({ ...PAYLOAD, selected_option: 'C' })
    })

    await act(async () => { await vi.runAllTimersAsync() })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.selected_option).toBe('C')
  })

  it('status saved setelah fetch berhasil (sebelum timer idle 2 detik)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })

    const { result } = renderHook(() => useAutoSave({ debounceMs: 100 }))
    act(() => { result.current.saveAnswer(PAYLOAD) })

    // Maju hanya cukup untuk debounce (100ms) + fetch resolve
    // JANGAN maju 2000ms lebih karena hook punya setTimeout reset ke 'idle' setelah 2 detik
    await act(async () => {
      vi.advanceTimersByTime(150)   // lewati debounce 100ms
      await Promise.resolve()       // flush microtask (fetch resolve)
      await Promise.resolve()       // flush microtask kedua (setState dari fetch)
    })

    // Status harus 'saved' — timer reset-ke-idle belum jalan
    expect(result.current.saveStatus).toBe('saved')
    expect(result.current.lastSavedAt).not.toBeNull()
  })

  it('status error saat fetch gagal dan retry habis', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 500, json: async () => ({ error: 'Server Error' }),
    })

    const { result } = renderHook(() =>
      useAutoSave({ debounceMs: 100, retryCount: 1 })
    )
    act(() => { result.current.saveAnswer(PAYLOAD) })
    await act(async () => { await vi.runAllTimersAsync() })
    expect(result.current.saveStatus).toBe('error')
  })

  it('status 410 tidak retry — hanya 1 fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false, status: 410, json: async () => ({ error: 'Waktu habis' }),
    })
    global.fetch = fetchMock

    const { result } = renderHook(() =>
      useAutoSave({ debounceMs: 100, retryCount: 3 })
    )
    act(() => { result.current.saveAnswer(PAYLOAD) })
    await act(async () => { await vi.runAllTimersAsync() })

    expect(result.current.saveStatus).toBe('error')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('dua soal berbeda → dua fetch terpisah', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    global.fetch = fetchMock

    const { result } = renderHook(() => useAutoSave({ debounceMs: 100 }))
    act(() => {
      result.current.saveAnswer({ ...PAYLOAD, question_id: 'q-001' })
      result.current.saveAnswer({ ...PAYLOAD, question_id: 'q-002' })
    })

    await act(async () => { await vi.runAllTimersAsync() })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})