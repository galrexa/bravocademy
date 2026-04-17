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