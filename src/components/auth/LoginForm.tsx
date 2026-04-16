'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase' // Memanggil fungsi browser client
import { loginSchema, type LoginInput } from '@/lib/validations'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  // Ambil URL redirect setelah login (jika ada dari proxy/middleware)
  const nextRoute = searchParams.get('next') || '/dashboard'

  const [serverError, setServerError] = useState<string | null>(null)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  // --- Login Email & Password ---
  const onSubmit = async (data: LoginInput) => {
    setServerError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) {
        // Human-friendly error messages
        if (error.message.includes('Invalid login credentials')) {
          setServerError('Email atau password salah. Silakan coba lagi.')
        } else if (error.message.includes('Email not confirmed')) {
          setServerError('Email belum dikonfirmasi. Silakan cek inbox Anda.')
        } else {
          setServerError(error.message)
        }
        return
      }

      // Berhasil Login
      router.push(nextRoute)
      router.refresh()
    } catch (err) {
      setServerError('Terjadi kesalahan koneksi. Silakan coba lagi.')
    }
  }

  // --- Login Google OAuth ---
  const handleGoogleLogin = async () => {
    setServerError(null)
    setIsGoogleLoading(true)
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Dinamis: arahkan balik ke halaman asal jika ada parameter 'next'
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextRoute)}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      })

      if (error) throw error
      
      // Catatan: Browser akan dialihkan ke Google, loading state tidak perlu di-reset
      // karena halaman akan berganti.
    } catch (error: any) {
      setServerError(`Gagal masuk dengan Google: ${error.message}`)
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-8 text-center sm:text-left">
          <h1 className="text-2xl font-bold text-gray-900">Masuk ke Bravocademy</h1>
          <p className="text-gray-500 mt-1 text-sm">Lanjutkan persiapan SKD kamu</p>
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading || isSubmitting}
          className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGoogleLoading ? (
            <span className="h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
          )}
          {isGoogleLoading ? 'Menghubungkan...' : 'Masuk dengan Google'}
        </button>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Atau</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl px-4 py-3 flex items-start gap-2 animate-in fade-in slide-in-from-top-1">
              <span className="mt-0.5">⚠️</span>
              <p>{serverError}</p>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nama@email.com"
              {...register('email')}
              className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all
                ${errors.email
                  ? 'border-red-300 focus:border-red-400 bg-red-50'
                  : 'border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50'
                }`}
            />
            {errors.email && (
              <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.email.message}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Lupa password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register('password')}
              className={`w-full border rounded-xl px-4 py-3 text-sm outline-none transition-all
                ${errors.password
                  ? 'border-red-300 focus:border-red-400 bg-red-50'
                  : 'border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50'
                }`}
            />
            {errors.password && (
              <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isGoogleLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl py-3 text-sm transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
          >
            {isSubmitting ? (
              <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : 'Masuk ke Akun'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-8">
          Belum punya akun?{' '}
          <Link href="/register" className="text-blue-600 font-bold hover:underline">
            Daftar Gratis
          </Link>
        </p>
      </div>
    </div>
  )
}