'use client'

import { useState } from 'react'

type User = {
  id: string
  full_name: string
  email: string
  role: string
  created_at: string
  last_seen_at: string | null
}

const ROLES = ['user', 'mentor', 'admin', 'super_admin']

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  user:        { label: 'User',        color: 'bg-gray-100 text-gray-700' },
  mentor:      { label: 'Mentor',      color: 'bg-blue-100 text-blue-700' },
  admin:       { label: 'Admin',       color: 'bg-amber-100 text-amber-700' },
  super_admin: { label: 'Super Admin', color: 'bg-purple-100 text-purple-700' },
}

export function AdminUsersTable({
  users: initialUsers,
  currentUserId,
}: {
  users: User[]
  currentUserId: string
}) {
  const [users, setUsers] = useState(initialUsers)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const filtered = users.filter((u) => {
    const matchSearch =
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    const matchRole = filterRole === 'all' || u.role === filterRole
    return matchSearch && matchRole
  })

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (userId === currentUserId) return
    setUpdatingId(userId)
    const res = await fetch('/api/admin/role', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, newRole }),
    })
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      )
    }
    setUpdatingId(null)
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="search"
          placeholder="Cari nama atau email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400"
        />
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 bg-white"
        >
          <option value="all">Semua role</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r].label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Pengguna
                </th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Role
                </th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Daftar
                </th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-gray-400">
                    Tidak ada pengguna ditemukan
                  </td>
                </tr>
              )}
              {filtered.map((u) => {
                const roleConfig = ROLE_LABELS[u.role] ?? ROLE_LABELS.user
                const isSelf = u.id === currentUserId
                return (
                  <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">{u.full_name || '—'}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{u.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${roleConfig.color}`}>
                        {roleConfig.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      {new Date(u.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-4">
                      {isSelf ? (
                        <span className="text-xs text-gray-400 italic">Akun ini</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            disabled={updatingId === u.id}
                            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-blue-400 bg-white disabled:opacity-50"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r].label}</option>
                            ))}
                          </select>
                          {updatingId === u.id && (
                            <span className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Menampilkan {filtered.length} dari {users.length} pengguna · Perubahan role dicatat di audit log
      </p>
    </div>
  )
}