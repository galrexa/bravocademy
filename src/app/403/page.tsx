import Link from 'next/link'

export default function ForbiddenPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-blue-600 mb-4">403</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Akses Ditolak</h1>
        <p className="text-gray-500 mb-8">
          Anda tidak memiliki izin untuk mengakses halaman ini.
        </p>
        <Link
          href="/dashboard"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl px-6 py-3 text-sm transition-colors"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    </main>
  )
}