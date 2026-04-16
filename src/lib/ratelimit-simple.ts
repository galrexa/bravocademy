// Alternatif: rate limit in-memory (tanpa Redis, untuk dev lokal)
// src/lib/ratelimit-simple.ts

const store = new Map<string, { count: number; reset: number }>()

export function checkRateLimit(ip: string, limit = 60, windowMs = 60_000) {
  const now = Date.now()
  const rec = store.get(ip) ?? { count: 0, reset: now + windowMs }

  if (now > rec.reset) {
    rec.count = 0
    rec.reset = now + windowMs
  }

  rec.count++
  store.set(ip, rec)

  return {
    success: rec.count <= limit,
    remaining: Math.max(0, limit - rec.count),
    reset: rec.reset,
  }
}