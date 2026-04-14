// src/lib/crypto.ts
import { gcm } from '@noble/ciphers/aes.js'
import { utf8ToBytes, bytesToHex, hexToBytes, randomBytes } from '@noble/ciphers/utils.js'

function getKey(): Uint8Array {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64)
    throw new Error('ENCRYPTION_KEY harus 64 karakter hex')
  return hexToBytes(hex)
}

// Output: hex(nonce 12 byte) + hex(ciphertext + GCM tag 16 byte)
export function encrypt(plaintext: string): string {
  const key   = getKey()
  const nonce = randomBytes(12)
  const ct    = gcm(key, nonce).encrypt(utf8ToBytes(plaintext))
  return bytesToHex(nonce) + bytesToHex(ct)
}

export function decrypt(cipherHex: string): string {
  const key   = getKey()
  const nonce = hexToBytes(cipherHex.slice(0, 24))
  const ct    = hexToBytes(cipherHex.slice(24))
  return new TextDecoder().decode(gcm(key, nonce).decrypt(ct))
}

export const isEncrypted = (v: string) => /^[0-9a-f]{64,}$/.test(v)