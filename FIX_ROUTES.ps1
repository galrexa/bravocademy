# FIX_ROUTES.ps1 — Overwrite 3 API route dengan versi yang auth-first
# Jalankan dari ROOT project: .\FIX_ROUTES.ps1

$root = $PSScriptRoot
function W($rel, $content) {
    $full = Join-Path $root $rel
    [System.IO.File]::WriteAllText($full, $content, [System.Text.UTF8Encoding]::new($false))
    Write-Host "OK: $rel" -ForegroundColor Green
}

W "src/app/api/exam/answer/route.ts" @'
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

    // AUTH FIRST
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
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
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
'@

W "src/app/api/exam/submit/route.ts" @'
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { z } from "zod"

const SubmitSchema = z.object({ session_id: z.string().uuid() })

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
    )

    // AUTH FIRST
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
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
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
'@

W "src/app/api/exam/start/route.ts" @'
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { z } from "zod"

const StartSchema = z.object({ module_id: z.string().uuid() })

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
    )

    // AUTH FIRST
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const parsed = StartSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Validasi gagal", details: parsed.error.flatten() }, { status: 400 })

    const { module_id } = parsed.data

    const { data: access, error: accessError } = await supabase
      .from("user_module_access").select("id, expires_at")
      .eq("user_id", user.id).eq("module_id", module_id).maybeSingle()

    if (accessError) return NextResponse.json({ error: "Gagal verifikasi akses modul" }, { status: 500 })
    if (!access) return NextResponse.json({ error: "Kamu tidak memiliki akses ke modul ini" }, { status: 403 })

    const { data: existingSession } = await supabase
      .from("exam_sessions").select("id, expires_at, status")
      .eq("user_id", user.id).eq("module_id", module_id).eq("status", "in_progress").maybeSingle()

    if (existingSession && new Date(existingSession.expires_at) > new Date())
      return NextResponse.json({ session_id: existingSession.id, expires_at: existingSession.expires_at, resumed: true })

    const { data: sessionData, error: sessionError } = await supabase.rpc("start_exam_session", { p_user_id: user.id, p_module_id: module_id })
    if (sessionError) return NextResponse.json({ error: "Gagal memulai sesi ujian", detail: sessionError.message }, { status: 500 })

    return NextResponse.json({ session_id: sessionData.session_id, expires_at: sessionData.expires_at, resumed: false })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
'@

Write-Host "`nDone! Jalankan: npm test" -ForegroundColor Cyan