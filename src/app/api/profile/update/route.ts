// src/app/api/profile/update/route.ts
import { encrypt } from '@/lib/crypto'
import { createClient } from '@/lib/supabase'

export async function POST(req: Request) {
  const { userId, nik, phone } = await req.json()
  const supabase = createClient()

  const { error } = await supabase
    .from('profiles')
    .update({
      nik_encrypted:   encrypt(nik),
      phone_encrypted: encrypt(phone),
    })
    .eq('id', userId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}