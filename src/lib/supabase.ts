import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ─── Browser client (digunakan di Client Components) ──────────────────────────
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ─── Server client (digunakan di Server Components & Route Handlers) ──────────
// cookies() dipanggil secara lazy di dalam adapter agar tidak crash karena
// Next.js 16 mengembalikan decorated Promise dari cookies() di dev mode.
export function createServer() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          return (await cookies()).getAll()
        },
        async setAll(cookiesToSet) {
          try {
            const store = await cookies()
            cookiesToSet.forEach(({ name, value, options }) =>
              store.set(name, value, options)
            )
          } catch {
            // setAll dipanggil dari Server Component → abaikan
          }
        },
      },
    }
  )
}

// Alias untuk backward compatibility
export const createServerSupabaseClient = createServer
