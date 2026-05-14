-- ============================================================
-- DAVED — Supabase Database Schema
-- Run this in your Supabase project: SQL Editor → New Query
-- ============================================================

-- Enable UUID extension (already enabled by default in Supabase)
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS (synced from Supabase Auth)
-- Supabase automatically manages auth.users — this is a public
-- profile table that mirrors it and stores extra app data.
-- ============================================================
create table if not exists public.profiles (
    id          uuid primary key references auth.users(id) on delete cascade,
    email       text,
    full_name   text,
    avatar_url  text,
    created_at  timestamptz default now(),
    updated_at  timestamptz default now()
);

-- Auto-create a profile row when a new user signs up via OAuth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email      = excluded.email,
    full_name  = excluded.full_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ============================================================
-- TASK SESSIONS
-- Each "session" = one decompose call (feeling + task prompt).
-- Stores the full AI response as JSONB for flexibility.
-- ============================================================
create table if not exists public.task_sessions (
    id            uuid primary key default uuid_generate_v4(),
    user_id       uuid not null references public.profiles(id) on delete cascade,

    -- What the user typed
    feeling       text,                    -- optional feeling context
    task_prompt   text not null,           -- the raw task description

    -- AI output stored as JSONB (flexible, queryable)
    energy_score  int,                     -- 0–100
    tasks         jsonb not null default '[]'::jsonb,
    -- tasks schema:
    -- [{ "step": string, "isMVE": bool, "points": int, "completed": bool }]

    -- Aggregate stats (computed on save / update)
    total_steps       int generated always as (jsonb_array_length(tasks)) stored,
    total_points      int,                 -- sum of all step points
    completed_steps   int default 0,       -- incremented client-side
    completed_points  int default 0,

    created_at    timestamptz default now(),
    updated_at    timestamptz default now()
);

-- Index for fast user history queries
create index if not exists idx_task_sessions_user_id
    on public.task_sessions(user_id, created_at desc);


-- ============================================================
-- USER STATS (denormalized for fast profile display)
-- Updated via trigger whenever a session is saved/updated.
-- ============================================================
create table if not exists public.user_stats (
    user_id             uuid primary key references public.profiles(id) on delete cascade,
    total_sessions      int default 0,
    total_steps         int default 0,
    total_points_earned int default 0,
    sessions_completed  int default 0,   -- sessions where all steps done
    updated_at          timestamptz default now()
);

-- Auto-create stats row when profile is created
create or replace function public.handle_new_profile()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_stats (user_id)
  values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created on public.profiles;
create trigger on_profile_created
  after insert on public.profiles
  for each row execute procedure public.handle_new_profile();

-- Update stats when a task session is inserted
create or replace function public.update_user_stats_on_insert()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_stats (user_id, total_sessions, total_steps, total_points_earned)
  values (new.user_id, 1, new.total_steps, coalesce(new.total_points, 0))
  on conflict (user_id) do update set
    total_sessions      = public.user_stats.total_sessions + 1,
    total_steps         = public.user_stats.total_steps + new.total_steps,
    total_points_earned = public.user_stats.total_points_earned + coalesce(new.total_points, 0),
    updated_at          = now();
  return new;
end;
$$;

drop trigger if exists on_session_insert on public.task_sessions;
create trigger on_session_insert
  after insert on public.task_sessions
  for each row execute procedure public.update_user_stats_on_insert();

-- Update stats when task progress is saved (UPDATE)
create or replace function public.update_user_stats_on_update()
returns trigger language plpgsql security definer as $$
declare
  delta_completed_points int := coalesce(new.completed_points, 0) - coalesce(old.completed_points, 0);
  was_completed bool := old.completed_steps = old.total_steps and old.total_steps > 0;
  is_completed  bool := new.completed_steps = new.total_steps and new.total_steps > 0;
begin
  update public.user_stats set
    total_points_earned = total_points_earned + delta_completed_points,
    sessions_completed  = sessions_completed + (case when (not was_completed and is_completed) then 1 else 0 end),
    updated_at          = now()
  where user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists on_session_update on public.task_sessions;
create trigger on_session_update
  after update on public.task_sessions
  for each row execute procedure public.update_user_stats_on_update();


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Users can only read/write their own data.
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.task_sessions enable row level security;
alter table public.user_stats    enable row level security;

-- Profiles
create policy "Users can view own profile"
    on public.profiles for select
    using (auth.uid() = id);

create policy "Users can update own profile"
    on public.profiles for update
    using (auth.uid() = id);

-- Task Sessions
create policy "Users can view own sessions"
    on public.task_sessions for select
    using (auth.uid() = user_id);

create policy "Users can insert own sessions"
    on public.task_sessions for insert
    with check (auth.uid() = user_id);

create policy "Users can update own sessions"
    on public.task_sessions for update
    using (auth.uid() = user_id);

create policy "Users can delete own sessions"
    on public.task_sessions for delete
    using (auth.uid() = user_id);

-- User Stats
create policy "Users can view own stats"
    on public.user_stats for select
    using (auth.uid() = user_id);

-- Stats are only written by triggers (security definer), not directly by users
-- so no insert/update policy needed for users.


-- ============================================================
-- DONE — tables created:
--   public.profiles       → user profile info
--   public.task_sessions  → task history with JSONB steps
--   public.user_stats     → aggregated stats per user
-- ============================================================

-- ============================================================
-- USER STREAKS
-- Tracks daily streak, longest streak, and freeze usage.
-- ============================================================
create table if not exists public.user_streaks (
    user_id           uuid primary key references public.profiles(id) on delete cascade,
    current_streak    int default 0,
    longest_streak    int default 0,
    last_active_date  date,
    freezes_used      int default 0,       -- freezes used this month
    freezes_month     text,                -- 'YYYY-MM' of current freeze count
    updated_at        timestamptz default now()
);

-- RLS
alter table public.user_streaks enable row level security;
create policy "Users can view own streak"
    on public.user_streaks for select
    using (auth.uid() = user_id);
create policy "Users can insert own streak"
    on public.user_streaks for insert
    with check (auth.uid() = user_id);
create policy "Users can update own streak"
    on public.user_streaks for update
    using (auth.uid() = user_id);
