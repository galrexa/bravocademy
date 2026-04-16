// src/app/api/exam/answer/route.ts
import { examLimiter } from '@/lib/ratelimit'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // Ambil IP dari header (Vercel/Cloudflare forward IP asli)
  const ip = req.headers.get('x-forwarded-for')
    ?? req.headers.get('x-real-ip')
    ?? '127.0.0.1'

  const { success, limit, remaining, reset } = await examLimiter.limit(ip)

  if (!success) {
    return NextResponse.json(
      { error: 'Terlalu banyak request. Coba lagi dalam beberapa saat.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit':     String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset':     String(reset),
          'Retry-After':           String(Math.ceil((reset - Date.now()) / 1000)),
        },
      }
    )
  }

  // Lanjut proses jawaban ujian...
  const body = await req.json()
  // ...
  return NextResponse.json({ ok: true })
}