import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type Role = 'student' | 'mentor' | 'admin' | 'super_admin'

/**
 * RBAC Configuration
 * Menggunakan Record untuk memetakan route ke role yang diizinkan.
 */
const ROUTE_ROLES: Record<string, Role[]> = {
  '/admin/users':     ['super_admin'],
  '/admin/questions': ['mentor', 'admin', 'super_admin'],
  '/admin':           ['admin', 'super_admin'],
  '/exam':            ['student', 'super_admin'],
  '/modules':         ['student', 'mentor', 'admin', 'super_admin'],
  '/dashboard':       ['student', 'mentor', 'admin', 'super_admin'],
}

/**
 * Auth Routes
 * Route yang tidak boleh diakses jika user sudah login (Guest Only).
 */
const AUTH_ONLY_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password']

/**
 * Proxy Function (Next.js 16+ Replacement for Middleware)
 */
export async function proxy(req: NextRequest) {
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  const { pathname } = req.nextUrl

  // 1. Inisialisasi Supabase Client untuk Edge Runtime
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 2. Ambil User Session secara aman
  // Gunakan getUser() (Server-side check) bukan getSession() untuk keamanan lebih tinggi
  const { data: { user } } = await supabase.auth.getUser()

  // 3. Logic: Redirect jika sudah login tapi akses halaman Login/Register
  if (user && AUTH_ONLY_ROUTES.some(r => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // 4. Cari role yang dibutuhkan untuk route saat ini
  // Sorting dilakukan agar route paling spesifik (misal /admin/users) dicek lebih dulu daripada /admin
  const matchedEntry = Object.entries(ROUTE_ROLES)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([route]) => pathname.startsWith(route))

  const allowedRoles = matchedEntry?.[1]

  // Jika route tidak ada di daftar ROUTE_ROLES, anggap sebagai Public Route
  if (!allowedRoles) return res

  // 5. Proteksi: Belum login tapi akses Private Route
  if (!user) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('next', pathname) // Simpan tujuan asal untuk redirect pasca-login
    return NextResponse.redirect(loginUrl)
  }

  // 6. Cek Role via Database (Profile Table)
  // Tips CTO: Pastikan tabel 'profiles' memiliki RLS yang benar
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const userRole = (profile?.role ?? 'student') as Role

  // 7. Proteksi: Role tidak mencukupi (403 Forbidden)
  if (!allowedRoles.includes(userRole)) {
    return NextResponse.redirect(new URL('/403', req.url))
  }

  return res
}

/**
 * Konfigurasi Matcher
 * Memasukkan semua route kecuali file statis, api, dan callback auth.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes)
     * - auth/callback (Supabase OAuth callback)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|auth/callback).*)',
  ],
}