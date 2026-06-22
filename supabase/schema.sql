create table if not exists stop_picks (
  id uuid default gen_random_uuid() primary key,
  branch_id text not null,
  stop_id text not null,
  restaurant_place_id text,
  restaurant_name text,
  restaurant_address text,
  restaurant_rating numeric(2, 1),
  visited boolean not null default false,
  visited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, stop_id)
);

-- open RLS for this shared personal app (no auth)
alter table stop_picks enable row level security;

create policy "allow all"
  on stop_picks
  for all
  using (true)
  with check (true);

-- Migration: add visit photo support
alter table stop_picks add column if not exists visit_photo_url text;

-- Reviews: one row per (stop, reviewer); run this in the SQL editor
create table if not exists stop_reviews (
  id uuid default gen_random_uuid() primary key,
  branch_id text not null,
  stop_id text not null,
  reviewer text not null check (reviewer in ('Emme', 'John')),
  rating integer not null check (rating between 1 and 5),
  review text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, stop_id, reviewer)
);

alter table stop_reviews enable row level security;

create policy "allow all reviews"
  on stop_reviews
  for all
  using (true)
  with check (true);

-- Storage: run after creating the "visit-photos" bucket in the Supabase dashboard
-- (set the bucket to Public, or add these policies manually)
--
-- insert policy — allow uploads:
--   create policy "allow uploads" on storage.objects
--     for insert with check (bucket_id = 'visit-photos');
--
-- select policy — allow public reads:
--   create policy "allow public reads" on storage.objects
--     for select using (bucket_id = 'visit-photos');
