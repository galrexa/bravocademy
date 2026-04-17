import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase'
import { auditLog } from '@/lib/audit'

const VALID_ROLES = ['user', 'mentor', 'admin', 'super_admin'] as const
type Role = typeof VALID_ROLES[number]

// Service role client — bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PATCH(req: NextRequest) {
  // 1. Autentikasi
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Pastikan hanya super_admin yang boleh
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (callerProfile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Parse & validasi body
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { userId, newRole } = body as { userId?: string; newRole?: string }

  if (!userId || !newRole) {
    return NextResponse.json({ error: 'userId dan newRole wajib diisi' }, { status: 400 })
  }
  if (!VALID_ROLES.includes(newRole as Role)) {
    return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 })
  }
  if (userId === user.id) {
    return NextResponse.json({ error: 'Tidak bisa mengubah role sendiri' }, { status: 400 })
  }

  // 4. Update role — pakai admin client agar bypass RLS
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 5. Audit log
  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
  await auditLog({
    userId:     user.id,
    action:     'user.role_change',
    resource:   'profiles',
    resourceId: userId,
    ipAddress:  ip,
    userAgent:  req.headers.get('user-agent') ?? undefined,
    metadata:   { newRole },
  })

  return NextResponse.json({ ok: true })
}
