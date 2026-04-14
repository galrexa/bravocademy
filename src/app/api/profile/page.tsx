// src/app/profile/page.tsx  ← Server Component
import { decrypt } from '@/lib/crypto'
import { createClient } from '@/lib/supabase'

export default async function ProfilePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('profiles')
    .select('nik_encrypted, phone_encrypted')
    .eq('id', user!.id)
    .single()

  // Dekripsi di server — jangan kirim plaintext ke client
  const nik   = data?.nik_encrypted   ? decrypt(data.nik_encrypted)   : ''
  const phone = data?.phone_encrypted ? decrypt(data.phone_encrypted) : ''

  // Tampilkan dengan masking
  return (
    <div>
      <p>NIK: {nik.slice(0,4)}****{nik.slice(-4)}</p>
      <p>HP:  {phone}</p>
    </div>
  )
}