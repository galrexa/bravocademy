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