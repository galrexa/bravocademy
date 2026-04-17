// src/__tests__/setup.ts
import { vi } from 'vitest'

// next/navigation mock
vi.mock('next/navigation', () => ({
  useRouter:       () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useParams:       () => ({}),
  useSearchParams: () => new URLSearchParams(),
  redirect:        vi.fn(),
  notFound:        vi.fn(),
}))

// next/headers mock
vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll: () => [],
    set:    vi.fn(),
    get:    vi.fn(),
  }),
}))

// ENV variables minimal
process.env.NEXT_PUBLIC_SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL      ?? 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY     ?? 'test-service-key'