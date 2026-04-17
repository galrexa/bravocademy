-- ============================================================
-- Bravocademy — Profiles Setup & Migration
-- Jalankan di: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Buat tabel profiles jika belum ada
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    TEXT        NOT NULL DEFAULT '',
  email        TEXT        NOT NULL DEFAULT '',
  phone_number TEXT,
  nik          TEXT,
  avatar_url   TEXT,
  role         user_role   NOT NULL DEFAULT 'student',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ
);

-- 2. Tambah kolom yang mungkin belum ada
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name    TEXT        NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email        TEXT        NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nik          TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url   TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- 3. Tambah nilai 'user' ke enum user_role
--    (ADD VALUE IF NOT EXISTS harus dijalankan di luar transaksi di PG < 14,
--     tapi Supabase sudah PG 15+ sehingga aman dalam blok DO)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'user';

-- 4. Migrate data lama: ganti 'student' → 'user'
UPDATE public.profiles SET role = 'user' WHERE role = 'student';

-- 5. Update default kolom role menjadi 'user'
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user';

-- 6. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 7. Drop policy lama agar idempotent
DROP POLICY IF EXISTS "profiles: user can read own"           ON public.profiles;
DROP POLICY IF EXISTS "profiles: user can update own"         ON public.profiles;
DROP POLICY IF EXISTS "profiles: admin can read all"          ON public.profiles;
DROP POLICY IF EXISTS "profiles: super_admin can update role" ON public.profiles;
DROP POLICY IF EXISTS "profiles: authenticated can read"      ON public.profiles;

-- 8. RLS Policies
CREATE POLICY "profiles: authenticated can read"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles: user can update own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 9. Trigger: auto-buat profil saat user baru daftar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, ''),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 10. Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
