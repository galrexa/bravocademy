// src/proxy.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type Role = 'student' | 'mentor' | 'admin' | 'super_admin'

const ROUTE_ROLES: Record<string, Role[]> = {
  '/dashboard':       ['student', 'mentor', 'admin', 'super_admin'],
  '/exam':            ['student', 'super_admin'],
  '/modules':         ['student', 'mentor', 'admin', 'super_admin'],
  '/admin/users':     ['super_admin'],
  '/admin/questions': ['mentor', 'admin', 'super_admin'],
  '/admin':           ['admin', 'super_admin'],
}

export async function proxy(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([key, value]) =>
            res.headers.set(key, value)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const path = req.nextUrl.pathname

  // Cari route yang cocok — sort dari paling spesifik
  const matchedRoles = Object.entries(ROUTE_ROLES)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([route]) => path.startsWith(route))?.[1]

  if (!matchedRoles) return res  // route publik

  if (!session) {
    const url = new URL('/login', req.url)
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  const role = (profile?.role ?? 'student') as Role

  if (!matchedRoles.includes(role)) {
    return NextResponse.redirect(new URL('/403', req.url))
  }

  return res
}

export const config = {
  matcher: ['/dashboard/:path*', '/exam/:path*', '/modules/:path*', '/admin/:path*'],
}
