create extension if not exists pgcrypto;
create extension if not exists postgis;
create extension if not exists citext;

do $$
begin
  create type public.item_category as enum ('documentos', 'eletronicos', 'chaves', 'vestuario', 'outros');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.item_type as enum ('found', 'lost');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.item_status as enum ('draft', 'published', 'claimed', 'returned', 'blocked', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.chat_review_status as enum ('clear', 'pending', 'reviewing', 'resolved');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  password_hash text not null,
  display_name text not null,
  phone_encrypted bytea,
  home_address_encrypted bytea,
  home_area geography(Point, 4326),
  reputation_score integer not null default 0 check (reputation_score >= 0),
  is_moderator boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  item_type public.item_type not null default 'found',
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 10 and 2000),
  category public.item_category not null,
  status public.item_status not null default 'published',
  image_url text,
  image_blurhash text,
  location_label text,
  approx_location geography(Point, 4326) not null,
  location_radius_meters integer not null default 500 check (location_radius_meters between 300 and 1500),
  location_mask_strategy text not null default 'radius_500m',
  filter_status text not null default 'clear',
  filter_reasons jsonb not null default '[]'::jsonb,
  is_premium boolean not null default false,
  premium_until timestamptz,
  boost_region_key text,
  search_vector tsvector generated always as (
    to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  returned_at timestamptz,
  archived_at timestamptz
);

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  claimant_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'open',
  extortion_flagged boolean not null default false,
  human_review_status public.chat_review_status not null default 'clear',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, claimant_id),
  check (owner_id <> claimant_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  scan_status text not null default 'clear',
  scan_reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.extortion_reports (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  reporter_id uuid not null references public.users(id) on delete cascade,
  message_id uuid references public.chat_messages(id) on delete set null,
  reason text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.lost_boost_orders (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  currency char(3) not null default 'BRL',
  pix_reference text not null unique,
  status text not null default 'pending',
  boost_days integer not null default 3 check (boost_days between 1 and 7),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  expires_at timestamptz
);

create table if not exists public.item_matches (
  id uuid primary key default gen_random_uuid(),
  lost_item_id uuid not null references public.items(id) on delete cascade,
  found_item_id uuid not null references public.items(id) on delete cascade,
  score numeric(5,4) not null check (score >= 0 and score <= 1),
  model_version text not null default 'manual-v0',
  status text not null default 'candidate',
  created_at timestamptz not null default now(),
  unique (lost_item_id, found_item_id),
  check (lost_item_id <> found_item_id)
);

create index if not exists users_email_idx on public.users (email);
create index if not exists users_home_area_gix on public.users using gist (home_area);
create index if not exists items_location_gix on public.items using gist (approx_location);
create index if not exists items_status_category_created_idx on public.items (status, category, created_at desc);
create index if not exists items_premium_idx on public.items (is_premium, premium_until desc) where premium_until is not null;
create index if not exists items_search_vector_idx on public.items using gin (search_vector);
create index if not exists chat_rooms_participants_idx on public.chat_rooms (owner_id, claimant_id, updated_at desc);
create index if not exists chat_messages_room_created_idx on public.chat_messages (room_id, created_at);
create index if not exists extortion_reports_status_idx on public.extortion_reports (status, created_at desc);
create index if not exists item_matches_lost_score_idx on public.item_matches (lost_item_id, score desc);
create index if not exists item_matches_found_score_idx on public.item_matches (found_item_id, score desc);

alter table public.users enable row level security;
alter table public.items enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_messages enable row level security;
alter table public.extortion_reports enable row level security;
alter table public.lost_boost_orders enable row level security;
alter table public.item_matches enable row level security;

revoke all on table public.users from anon, authenticated;
revoke all on table public.chat_rooms from anon, authenticated;
revoke all on table public.chat_messages from anon, authenticated;
revoke all on table public.extortion_reports from anon, authenticated;
revoke all on table public.lost_boost_orders from anon, authenticated;
revoke all on table public.item_matches from anon, authenticated;

create or replace view public.item_feed
with (security_invoker = true)
as
select
  id,
  item_type,
  title,
  description,
  category,
  status,
  image_url,
  image_blurhash,
  location_label,
  location_radius_meters,
  is_premium,
  premium_until,
  st_y(approx_location::geometry) as latitude,
  st_x(approx_location::geometry) as longitude,
  created_at
from public.items
where status = 'published';

grant select on public.item_feed to anon, authenticated;
grant select (
  id,
  item_type,
  title,
  description,
  category,
  status,
  image_url,
  image_blurhash,
  location_label,
  location_radius_meters,
  is_premium,
  premium_until,
  approx_location,
  created_at
) on public.items to anon, authenticated;

drop policy if exists "Feed publico mostra apenas itens publicados" on public.items;
create policy "Feed publico mostra apenas itens publicados"
on public.items for select
using (status = 'published');

drop policy if exists "Usuario le apenas o proprio perfil" on public.users;
create policy "Usuario le apenas o proprio perfil"
on public.users for select
using (auth.uid() = id);

drop policy if exists "Participantes leem suas salas" on public.chat_rooms;
create policy "Participantes leem suas salas"
on public.chat_rooms for select
using (auth.uid() = owner_id or auth.uid() = claimant_id);

drop policy if exists "Participantes leem mensagens da sala" on public.chat_messages;
create policy "Participantes leem mensagens da sala"
on public.chat_messages for select
using (
  exists (
    select 1
    from public.chat_rooms room
    where room.id = chat_messages.room_id
      and (auth.uid() = room.owner_id or auth.uid() = room.claimant_id)
  )
);
