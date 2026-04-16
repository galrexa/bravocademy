// src/app/403/page.tsx
export default function ForbiddenPage() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <h1>403 — Akses Ditolak</h1>
      <p>Anda tidak memiliki izin untuk mengakses halaman ini.</p>
      <a href="/dashboard">Kembali ke Dashboard</a>
    </div>
  )
}