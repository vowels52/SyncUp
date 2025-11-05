-- Schema for migrating from OnSpace backend to a real Supabase project
-- Run this in your Supabase project's SQL Editor (or psql)

-- Enable pgcrypto for gen_random_uuid()
create extension if not exists pgcrypto;

-- user_profiles
create table if not exists public.user_profiles (
  id uuid primary key,
  email text,
  username text,
  full_name text,
  major text,
  year text,
  bio text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- interests master list
create table if not exists public.interests (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
);

-- user_interests mapping
create table if not exists public.user_interests (
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  interest_id uuid not null references public.interests(id) on delete cascade,
  primary key (user_id, interest_id)
);

-- groups
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  creator_id uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- group_members
create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  role text default 'member',
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

-- events
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  start_time timestamptz not null,
  end_time timestamptz,
  creator_id uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- event_attendees
create table if not exists public.event_attendees (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  status text default 'going',
  rsvp_at timestamptz default now(),
  primary key (event_id, user_id)
);

-- connections (peer-to-peer)
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  connected_user_id uuid not null references public.user_profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz default now()
);

-- Helpful indexes
create index if not exists idx_user_profiles_username on public.user_profiles (username);
create index if not exists idx_groups_creator_id on public.groups (creator_id);
create index if not exists idx_events_start_time on public.events (start_time);
create index if not exists idx_connections_user_pair on public.connections (user_id, connected_user_id);

-- Seed interests (optional; skip if you'll import from OnSpace)
-- insert into public.interests(name) values
--   ('Computer Science'), ('Engineering'), ('Business'), ('Mathematics'), ('Physics'),
--   ('Biology'), ('Psychology'), ('Art & Design'), ('Music'), ('Sports'),
--   ('Entrepreneurship'), ('Research'), ('Photography'), ('Writing'), ('Public Speaking')
-- on conflict (name) do nothing;


