-- Staff roles (separate table; never derived from user-editable metadata)
create type public.app_role as enum ('admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy "user_roles_read_own" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

comment on function public.has_role(uuid, public.app_role) is
  'SECURITY DEFINER by design: reads user_roles past RLS for policy checks. Executable by authenticated users; takes only the caller-supplied id.';

grant execute on function public.has_role(uuid, public.app_role) to authenticated;
revoke execute on function public.has_role(uuid, public.app_role) from anon, public;

-- Support messages: stored for the owner, never readable by anonymous visitors
create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid,
  email text not null,
  name text,
  category text not null default 'other',
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_at timestamptz,
  resolved_by uuid,
  source text not null default 'web',
  user_agent text
);

grant select, update on public.support_messages to authenticated;
grant all on public.support_messages to service_role;

alter table public.support_messages enable row level security;

create policy "support_admin_read_all" on public.support_messages
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "support_owner_read_own" on public.support_messages
  for select to authenticated
  using (user_id is not null and auth.uid() = user_id);

create policy "support_admin_update" on public.support_messages
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create index support_messages_status_idx on public.support_messages (status, created_at desc);
create index support_messages_email_idx on public.support_messages (lower(email), created_at desc);
create index support_messages_user_idx on public.support_messages (user_id);