// src/lib/audit.ts
import { createClient } from '@supabase/supabase-js'

// Gunakan service role key untuk bypass RLS saat insert log
// File ini HANYA dipakai di server-side (Route Handler / Server Action)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // JANGAN prefix NEXT_PUBLIC_
)

type AuditAction =
  | 'exam.start'
  | 'exam.submit'
  | 'exam.timeout'
  | 'module.purchase'
  | 'user.login'
  | 'user.logout'
  | 'user.role_change'
  | 'question.create'
  | 'question.delete'

interface AuditParams {
  userId:     string
  action:     AuditAction
  resource?:  string
  resourceId?: string
  ipAddress?: string
  userAgent?: string
  metadata?:  Record<string, unknown>
}

export async function auditLog(params: AuditParams) {
  const { error } = await supabaseAdmin
    .from('audit_logs')
    .insert({
      user_id:     params.userId,
      action:      params.action,
      resource:    params.resource,
      resource_id: params.resourceId,
      ip_address:  params.ipAddress,
      user_agent:  params.userAgent,
      metadata:    params.metadata,
    })

  // Log error ke console tapi jangan throw —
  // audit log tidak boleh mengganggu flow utama
  if (error) console.error('[audit]', error.message)
}