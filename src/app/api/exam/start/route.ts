// src/app/api/exam/start/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { z } from "zod"

const StartSchema = z.object({
  module_id: z.string().uuid("module_id harus berupa UUID valid"),
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
    const parsed = StartSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Validasi gagal", details: parsed.error.flatten() }, { status: 400 })

    const { module_id } = parsed.data

    const { data: access, error: accessError } = await supabase
      .from("user_module_access").select("id, expires_at")
      .eq("user_id", user.id).eq("module_id", module_id).maybeSingle()

    if (accessError) return NextResponse.json({ error: "Gagal verifikasi akses modul" }, { status: 500 })
    if (!access)     return NextResponse.json({ error: "Kamu tidak memiliki akses ke modul ini" }, { status: 403 })

    const { data: existingSession } = await supabase
      .from("exam_sessions").select("id, expires_at, status")
      .eq("user_id", user.id).eq("module_id", module_id).eq("status", "in_progress").maybeSingle()

    if (existingSession && new Date(existingSession.expires_at) > new Date()) {
      return NextResponse.json({ session_id: existingSession.id, expires_at: existingSession.expires_at, resumed: true })
    }

    const { data: sessionData, error: sessionError } = await supabase.rpc("start_exam_session", { p_user_id: user.id, p_module_id: module_id })
    if (sessionError) return NextResponse.json({ error: "Gagal memulai sesi ujian", detail: sessionError.message }, { status: 500 })

    return NextResponse.json({ session_id: sessionData.session_id, expires_at: sessionData.expires_at, resumed: false })
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}