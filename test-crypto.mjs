// test-crypto.mjs — jalankan: node test-crypto.mjs
import { config } from 'dotenv'
config({ path: '.env.local' })

const { encrypt, decrypt, isEncrypted } = await import('./src/lib/crypto.ts')

const cases = ['3271234567890001','08123456789','Nama Lengkap','A'.repeat(500)]
let pass = 0

for (const tc of cases) {
  const enc = encrypt(tc)
  const dec = decrypt(enc)
  const ok  = dec === tc && isEncrypted(enc) && enc !== tc
  console.log(ok ? '[PASS]' : '[FAIL]', tc.slice(0,30))
  if (ok) pass++
}

console.log(`\n${pass}/${cases.length} test passed`)