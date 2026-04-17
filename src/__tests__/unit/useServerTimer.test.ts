// src/__tests__/unit/useServerTimer.test.ts
// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useServerTimer } from '@/hooks/useServerTimer'

describe('useServerTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('menghitung detik awal dengan benar', () => {
    const expiresAt = new Date('2024-01-01T00:05:00Z').toISOString() // +5 menit
    const { result } = renderHook(() =>
      useServerTimer({ expiresAt, onExpire: vi.fn() })
    )
    expect(result.current.secondsLeft).toBe(300)
    expect(result.current.isExpired).toBe(false)
    expect(result.current.isWarning).toBe(false)
  })

  it('countdown berkurang setiap detik', () => {
    const expiresAt = new Date('2024-01-01T00:05:00Z').toISOString()
    const { result } = renderHook(() =>
      useServerTimer({ expiresAt, onExpire: vi.fn() })
    )

    expect(result.current.secondsLeft).toBe(300)

    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.secondsLeft).toBe(297)
  })

  it('memanggil onExpire saat waktu habis', () => {
    const onExpire = vi.fn()
    const expiresAt = new Date('2024-01-01T00:00:03Z').toISOString() // +3 detik

    renderHook(() => useServerTimer({ expiresAt, onExpire }))

    act(() => { vi.advanceTimersByTime(4000) })
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('isExpired true saat waktu habis', () => {
    const expiresAt = new Date('2024-01-01T00:00:02Z').toISOString()
    const { result } = renderHook(() =>
      useServerTimer({ expiresAt, onExpire: vi.fn() })
    )

    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.isExpired).toBe(true)
    expect(result.current.secondsLeft).toBe(0)
  })

  it('isWarning true saat sisa ≤ warningThreshold (default 300)', () => {
    const expiresAt = new Date('2024-01-01T00:04:59Z').toISOString() // 299 detik
    const { result } = renderHook(() =>
      useServerTimer({ expiresAt, onExpire: vi.fn() })
    )
    expect(result.current.isWarning).toBe(true)
  })

  it('isWarning false saat sisa > warningThreshold', () => {
    const expiresAt = new Date('2024-01-01T00:10:00Z').toISOString() // 600 detik
    const { result } = renderHook(() =>
      useServerTimer({ expiresAt, onExpire: vi.fn() })
    )
    expect(result.current.isWarning).toBe(false)
  })

  it('memanggil onWarning tepat sekali saat threshold tercapai', () => {
    const onWarning = vi.fn()
    // Mulai dari 302 detik → akan lewati threshold 300
    const expiresAt = new Date('2024-01-01T00:05:02Z').toISOString()

    renderHook(() =>
      useServerTimer({ expiresAt, onExpire: vi.fn(), onWarning, warningThreshold: 300 })
    )

    act(() => { vi.advanceTimersByTime(3000) }) // maju 3 detik → sisa 299
    expect(onWarning).toHaveBeenCalledTimes(1)

    act(() => { vi.advanceTimersByTime(10_000) }) // maju lagi — tidak boleh dipanggil lagi
    expect(onWarning).toHaveBeenCalledTimes(1)
  })

  it('sudah expired sejak awal → langsung panggil onExpire', () => {
    const onExpire = vi.fn()
    const expiresAt = new Date('2023-12-31T23:59:00Z').toISOString() // masa lalu

    renderHook(() => useServerTimer({ expiresAt, onExpire }))
    expect(onExpire).toHaveBeenCalledTimes(1)
  })
})
