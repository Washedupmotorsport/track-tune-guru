
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles are viewable by everyone" on public.profiles for select using (true);
create policy "users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- Cars
create table public.cars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  make text,
  model text,
  year int,
  discipline text not null default 'circuit',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cars enable row level security;
create policy "users view own cars" on public.cars for select using (auth.uid() = user_id);
create policy "users insert own cars" on public.cars for insert with check (auth.uid() = user_id);
create policy "users update own cars" on public.cars for update using (auth.uid() = user_id);
create policy "users delete own cars" on public.cars for delete using (auth.uid() = user_id);
create trigger cars_updated before update on public.cars for each row execute function public.set_updated_at();

-- Setups
create table public.setups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  car_id uuid not null references public.cars(id) on delete cascade,
  name text not null,
  discipline text not null default 'circuit',
  track text,
  conditions text,
  setup_data jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.setups enable row level security;
create policy "users view own setups" on public.setups for select using (auth.uid() = user_id);
create policy "users insert own setups" on public.setups for insert with check (auth.uid() = user_id);
create policy "users update own setups" on public.setups for update using (auth.uid() = user_id);
create policy "users delete own setups" on public.setups for delete using (auth.uid() = user_id);
create trigger setups_updated before update on public.setups for each row execute function public.set_updated_at();

create index setups_car_id_idx on public.setups(car_id);
create index setups_user_id_idx on public.setups(user_id);
create index cars_user_id_idx on public.cars(user_id);
