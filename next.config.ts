// next.config.js
/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Cegah clickjacking — halaman tidak bisa di-embed di iframe
  { key: 'X-Frame-Options', value: 'DENY' },

  // Cegah MIME sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },

  // Kontrol info referrer saat navigasi
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

  // Nonaktifkan fitur browser yang tidak dipakai
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },

  // HSTS — paksa HTTPS (aktifkan setelah deploy ke domain)
  // { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },

  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
    ].join('; ')
  },
]

const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

module.exports = nextConfig