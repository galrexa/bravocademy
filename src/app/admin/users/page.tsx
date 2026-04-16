import { createServerSupabaseClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { AdminUsersTable } from './AdminUsersTable'

export default async function AdminUsersPage() {
  const supabase = await createServerSupabaseClient()

  // Cek apakah user adalah super_admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') redirect('/dashboard')

  // Ambil semua user
  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, created_at, last_seen_at')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kelola Pengguna</h1>
          <p className="text-gray-500 text-sm mt-1">
            Total {users?.length ?? 0} pengguna terdaftar
          </p>
        </div>
      </div>
      <AdminUsersTable users={users ?? []} currentUserId={user.id} />
    </div>
  )
}