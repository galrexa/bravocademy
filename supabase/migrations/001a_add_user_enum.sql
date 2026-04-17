-- ============================================================
-- STEP 1 — Jalankan ini DULU, lalu klik Run
-- Tambah nilai 'user' ke enum user_role
-- ============================================================
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'user';
