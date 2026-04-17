// src/app/api/exam/answer/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { z } from "zod"

const AnswerSchema = z.object({
  session_id:      z.string().uuid(),
  question_id:     z.string().uuid(),
  selected_option: z.enum(["A","B","C","D","E"]).nullable(),
  is_flagged:      z.boolean().default(false),
})

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body   = await req.json()
    const parsed = AnswerSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Validasi gagal", details: parsed.error.flatten() }, { status: 400 })

    const { session_id, question_id, selected_option, is_flagged } = parsed.data

    const { data: session, error: sessionError } = await supabase
      .from("exam_sessions").select("id, expires_at, status")
      .eq("id", session_id).eq("user_id", user.id).single()

    if (sessionError || !session) return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 })
    if (session.status !== "in_progress") return NextResponse.json({ error: "Sesi ujian sudah berakhir" }, { status: 409 })
    if (new Date(session.expires_at) < new Date()) {
      await supabase.from("exam_sessions").update({ status: "expired", submitted_at: new Date().toISOString() }).eq("id", session_id)
      return NextResponse.json({ error: "Waktu ujian sudah habis" }, { status: 410 })
    }

    const { error: upsertError } = await supabase.from("exam_answers").upsert(
      { session_id, question_id, user_id: user.id, selected_option, is_flagged, answered_at: new Date().toISOString() },
      { onConflict: "session_id,question_id", ignoreDuplicates: false }
    )
    if (upsertError) return NextResponse.json({ error: "Gagal menyimpan jawaban" }, { status: 500 })

    return NextResponse.json({ success: true, saved_at: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}