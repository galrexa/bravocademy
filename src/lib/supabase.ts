import { createBrowserClient, createServerClient } from '@supabase/ssr'

// ─── BROWSER CLIENT (Aman untuk Client Components) ──────────────────────────
// Gunakan ini di file dengan direktif 'use client'
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ─── SERVER CLIENT (Khusus Server Components / Server Actions / Route Handlers) ──
// Kita gunakan teknik 'lazy loading' untuk cookies agar tidak crash di client
export function createServer() {
  // Hanya import next/headers SAAT fungsi ini dipanggil di server
  const { cookies } = require('next/headers')
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Abaikan error jika dipanggil di Server Component yang bersifat read-only
          }
        },
      },
    }
  )
}