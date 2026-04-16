// src/lib/validations.ts
import { z } from 'zod'

// Schema registrasi user
export const registerSchema = z.object({
  name: z.string()
    .min(2, 'Nama minimal 2 karakter')
    .max(100, 'Nama maksimal 100 karakter')
    .regex(/^[a-zA-Z\s]+$/, 'Nama hanya boleh huruf dan spasi'),

  email: z.string()
    .email('Format email tidak valid'),

  password: z.string()
    .min(8, 'Password minimal 8 karakter')
    .regex(/[A-Z]/, 'Harus ada huruf kapital')
    .regex(/[0-9]/, 'Harus ada angka'),
})

// Schema submit jawaban ujian
export const submitAnswerSchema = z.object({
  examId:     z.number().int().positive(),
  questionId: z.number().int().positive(),
  answer:     z.enum(['A', 'B', 'C', 'D', 'E']),
})

// Schema update profil
export const updateProfileSchema = z.object({
  name:  z.string().min(2).max(100).optional(),
  phone: z.string()
    .regex(/^08[0-9]{8,11}$/, 'Format nomor HP tidak valid')
    .optional(),
  nik: z.string()
    .regex(/^[0-9]{16}$/, 'NIK harus 16 digit angka')
    .optional(),
})

export type RegisterInput      = z.infer<typeof registerSchema>
export type SubmitAnswerInput  = z.infer<typeof submitAnswerSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>