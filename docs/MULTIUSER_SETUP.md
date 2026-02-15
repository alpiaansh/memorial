# Multi-User Setup (Supabase)

Setup ini bikin fitur berikut benar-benar multi-user:
- akun user
- komentar memorial
- like memorial
- secret message sender tracking
- statistik profile (`komentar`, `like`, `secret message terkirim`)

## 1) Buat project Supabase
1. Login ke `https://supabase.com`
2. Buat project baru
3. Ambil:
- `Project URL`
- `anon public key`

## 2) Jalankan SQL schema lengkap
1. Buka `SQL Editor` di Supabase
2. Copy isi file `docs/DB_SCHEMA_PROFILE.sql`
3. Run sekali

File ini sudah `idempotent`:
- aman dijalankan ulang
- tidak bentrok policy lama (`drop policy if exists`)
- tetap isi kolom lama yang belum ada (mis. `expires_at`)

## 3) Isi config project
Edit `supabase-config.js`:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY"
};
```

## 3.1) Aktifkan Email Auth
1. Buka `Authentication` -> `Providers` -> `Email`
2. Pastikan provider `Email` aktif
3. Untuk test cepat, kamu bisa matikan `Confirm email` dulu supaya user langsung bisa login setelah daftar

Catatan:
- Frontend sekarang pakai Supabase Auth (`/auth/v1/signup` dan `/auth/v1/token?grant_type=password`)
- Insert komentar/like/secret message pakai role `authenticated` sesuai policy RLS

## 4) Tabel yang dipakai
- `public.user_profiles`
- `public.memorial_comments`
- `public.memorial_likes`
- `public.secret_messages` (dengan `sender_user_id`)
- `public.user_profile_stats` (view statistik profile)

## 5) Catatan integrasi frontend
- Kalau mau statistik profile real-time lintas device, frontend sebaiknya query `public.user_profile_stats`.
- Untuk komentar/like/message insert, kirim `user_id = auth.uid()` saat user login lewat Supabase Auth.
- Kalau masih pakai localStorage login, data belum lintas device.
