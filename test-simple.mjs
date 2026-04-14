import { config } from 'dotenv'
console.log('dotenv imported')

config({ path: '.env.local' })
console.log('ENCRYPTION_KEY ada?', !!process.env.ENCRYPTION_KEY)
console.log('Panjang key:', process.env.ENCRYPTION_KEY?.length)