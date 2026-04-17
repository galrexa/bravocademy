// src/app/api/exam/submit/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { z } from "zod"

const SubmitSchema = z.object({
  session_id: z.string().uuid(),
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
    const parsed = SubmitSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "session_id tidak valid" }, { status: 400 })

    const { session_id } = parsed.data

    const { data: session } = await supabase
      .from("exam_sessions").select("id, status, expires_at, user_id")
      .eq("id", session_id).eq("user_id", user.id).single()

    if (!session) return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 })
    if (session.status === "submitted") return NextResponse.json({ session_id, already_submitted: true })

    const { data: result, error: submitError } = await supabase.rpc("submit_exam_session", { p_session_id: session_id, p_user_id: user.id })
    if (submitError) return NextResponse.json({ error: "Gagal submit ujian", detail: submitError.message }, { status: 500 })

    return NextResponse.json({ success: true, session_id, result_id: result?.result_id })
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}