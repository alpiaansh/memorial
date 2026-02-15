-- Memoflix DB Schema (Akun + Komentar + Like + Secret Message Sender)
-- Jalankan di Supabase SQL Editor.

create extension if not exists pgcrypto;

-- 1) Secret messages (existing-safe)
create table if not exists public.secret_messages (
  id uuid primary key default gen_random_uuid(),
  to_name text not null,
  title text not null,
  from_name text,
  music_url text,
  message_text text not null,
  sender_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '3 months')
);

alter table public.secret_messages
add column if not exists sender_user_id uuid references auth.users(id) on delete set null;

alter table public.secret_messages
add column if not exists expires_at timestamptz;

update public.secret_messages
set expires_at = coalesce(expires_at, created_at + interval '3 months');

alter table public.secret_messages
alter column expires_at set not null;

-- 2) Profile user (1:1 dengan auth.users)
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

-- 3) Komentar memorial
create table if not exists public.memorial_comments (
  id uuid primary key default gen_random_uuid(),
  memorial_key text not null,
  content text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text not null,
  created_at timestamptz not null default now()
);

-- 4) Like memorial (1 user 1 like per memorial)
create table if not exists public.memorial_likes (
  id uuid primary key default gen_random_uuid(),
  memorial_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (memorial_key, user_id)
);

create index if not exists idx_memorial_comments_memorial_key on public.memorial_comments(memorial_key);
create index if not exists idx_memorial_comments_user_id on public.memorial_comments(user_id);
create index if not exists idx_memorial_likes_memorial_key on public.memorial_likes(memorial_key);
create index if not exists idx_memorial_likes_user_id on public.memorial_likes(user_id);
create index if not exists idx_secret_messages_sender_user_id on public.secret_messages(sender_user_id);

-- ======================
-- RLS + POLICY
-- ======================
alter table public.secret_messages enable row level security;
alter table public.user_profiles enable row level security;
alter table public.memorial_comments enable row level security;
alter table public.memorial_likes enable row level security;

-- secret_messages
drop policy if exists "allow public read secret_messages" on public.secret_messages;
drop policy if exists "allow auth insert secret_messages" on public.secret_messages;
drop policy if exists "allow public delete expired secret_messages" on public.secret_messages;

create policy "allow public read secret_messages"
on public.secret_messages
for select
to anon, authenticated
using (true);

create policy "allow auth insert secret_messages"
on public.secret_messages
for insert
to authenticated
with check (auth.uid() = sender_user_id or sender_user_id is null);

create policy "allow public delete expired secret_messages"
on public.secret_messages
for delete
to anon, authenticated
using (expires_at < now());

-- user_profiles
drop policy if exists "allow own profile read" on public.user_profiles;
drop policy if exists "allow own profile insert" on public.user_profiles;
drop policy if exists "allow own profile update" on public.user_profiles;

create policy "allow own profile read"
on public.user_profiles
for select
to authenticated
using (auth.uid() = user_id);

create policy "allow own profile insert"
on public.user_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "allow own profile update"
on public.user_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- memorial_comments
drop policy if exists "allow public read memorial_comments" on public.memorial_comments;
drop policy if exists "allow auth insert memorial_comments" on public.memorial_comments;
drop policy if exists "allow own delete memorial_comments" on public.memorial_comments;

create policy "allow public read memorial_comments"
on public.memorial_comments
for select
to anon, authenticated
using (true);

create policy "allow auth insert memorial_comments"
on public.memorial_comments
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "allow own delete memorial_comments"
on public.memorial_comments
for delete
to authenticated
using (auth.uid() = user_id);

-- memorial_likes
drop policy if exists "allow public read memorial_likes" on public.memorial_likes;
drop policy if exists "allow auth insert memorial_likes" on public.memorial_likes;
drop policy if exists "allow own delete memorial_likes" on public.memorial_likes;

create policy "allow public read memorial_likes"
on public.memorial_likes
for select
to anon, authenticated
using (true);

create policy "allow auth insert memorial_likes"
on public.memorial_likes
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "allow own delete memorial_likes"
on public.memorial_likes
for delete
to authenticated
using (auth.uid() = user_id);

-- 5) View statistik profile
create or replace view public.user_profile_stats as
select
  u.id as user_id,
  coalesce(p.display_name, u.email) as display_name,
  u.email as email,
  (
    select count(*)::int
    from public.memorial_comments c
    where c.user_id = u.id
  ) as total_comments,
  (
    select count(*)::int
    from public.memorial_likes l
    where l.user_id = u.id
  ) as total_likes,
  (
    select count(*)::int
    from public.secret_messages s
    where s.sender_user_id = u.id
  ) as total_secret_messages
from auth.users u
left join public.user_profiles p on p.user_id = u.id;

grant select on public.user_profile_stats to authenticated;
