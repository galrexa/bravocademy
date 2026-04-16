// src/hooks/useRole.ts
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export type Role = 'student' | 'mentor' | 'admin' | 'super_admin'

export function useRole() {
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setLoading(false); return }
      const { data: p } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()
      setRole((p?.role as Role) ?? 'student')
      setLoading(false)
    })
  }, [])

  return {
    role,
    loading,
    isStudent:    role === 'student',
    isMentor:     role === 'mentor',
    isAdmin:      role === 'admin' || role === 'super_admin',
    isSuperAdmin: role === 'super_admin',
    can: (allowed: Role[]) => role !== null && allowed.includes(role),
  }
}