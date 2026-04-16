'use client'

import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase'
import { profileSchema, type ProfileInput } from '@/lib/validations'

type Profile = {
  id: string
  full_name: string
  email: string
  phone_number: string | null
  nik: string | null
  avatar_url: string | null
  role: string
}

export default function ProfilePage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileInput>({ resolver: zodResolver(profileSchema) })

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (data) {
        setProfile(data)
        reset({
          full_name: data.full_name ?? '',
          phone_number: data.phone_number ?? '',
          nik: data.nik ?? '',
        })
      }
      setLoading(false)
    }
    fetchProfile()
  }, [supabase, reset])

  const onSubmit = async (data: ProfileInput) => {
    if (!profile) return
    setSaveStatus('saving')
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: data.full_name,
        // phone_number dan NIK dienkripsi di sisi server (trigger/function)
        phone_number: data.phone_number || null,
        nik: data.nik || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    if (error) {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } else {
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
      reset(data)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran foto maksimal 2MB')
      return
    }
    setAvatarUploading(true)
    const ext = file.name.split('.').pop()
    const path = `avatars/${profile.id}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('public')
      .upload(path, file, { upsert: true })
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage
        .from('public')
        .getPublicUrl(path)
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id)
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null)
    }
    setAvatarUploading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Profil saya</h1>

      {/* Avatar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 flex items-center gap-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-gray-100 overflow-hidden">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Foto profil" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                </svg>
              </div>
            )}
          </div>
          {avatarUploading && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <div>
          <p className="font-semibold text-gray-900">{profile?.full_name}</p>
          <p className="text-sm text-gray-500">{profile?.email}</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Ganti foto profil
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarChange}
            className="hidden"
          />
          <p className="text-xs text-gray-400 mt-0.5">JPG, PNG atau WebP. Maks. 2MB.</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nama lengkap
            </label>
            <input
              type="text"
              {...register('full_name')}
              className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition-colors
                ${errors.full_name
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-200 focus:border-blue-400 bg-white'
                }`}
            />
            {errors.full_name && (
              <p className="mt-1.5 text-xs text-red-600">{errors.full_name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nomor HP
            </label>
            <input
              type="tel"
              placeholder="08123456789"
              {...register('phone_number')}
              className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition-colors
                ${errors.phone_number
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-200 focus:border-blue-400 bg-white'
                }`}
            />
            {errors.phone_number && (
              <p className="mt-1.5 text-xs text-red-600">{errors.phone_number.message}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">Dienkripsi dan tidak ditampilkan kepada pihak lain</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              NIK (Nomor Induk Kependudukan)
            </label>
            <input
              type="text"
              placeholder="16 digit NIK sesuai KTP"
              maxLength={16}
              {...register('nik')}
              className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition-colors
                ${errors.nik
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-200 focus:border-blue-400 bg-white'
                }`}
            />
            {errors.nik && (
              <p className="mt-1.5 text-xs text-red-600">{errors.nik.message}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">Dienkripsi AES-256-GCM. Digunakan untuk verifikasi identitas.</p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          <span className="text-sm">
            {saveStatus === 'saved' && <span className="text-green-600 font-medium">✓ Perubahan tersimpan</span>}
            {saveStatus === 'error' && <span className="text-red-600">Gagal menyimpan. Coba lagi.</span>}
          </span>
          <button
            type="submit"
            disabled={!isDirty || saveStatus === 'saving'}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-2.5 px-6 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saveStatus === 'saving' && (
              <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Simpan perubahan
          </button>
        </div>
      </form>
    </div>
  )
}