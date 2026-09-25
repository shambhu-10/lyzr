-- Architect 2.0 schema. Every table is owner-scoped with RLS (security by default, not as an afterthought).

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  org_name text,
  role text,
  default_mode text not null default 'builder' check (default_mode in ('builder', 'developer')),
  onboarded boolean not null default false,
  connections jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  slug text not null unique,
  prompt text not null default '',
  kind text not null default 'app' check (kind in ('app', 'agent', 'import')),
  stage text not null default 'plan' check (stage in ('plan', 'connect', 'build', 'test', 'ship', 'live')),
  plan jsonb,
  connections jsonb not null default '{}',
  demo_data boolean not null default false,
  source jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  kind text not null default 'text',
  content text not null default '',
  meta jsonb,
  created_at timestamptz not null default now()
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  path text not null,
  content text not null default '',
  updated_at timestamptz not null default now(),
  unique (project_id, path)
);

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid references public.projects on delete set null,
  name text not null,
  role text not null default '',
  framework text not null default 'lyzr',
  instructions text not null default '',
  tools jsonb not null default '[]',
  model text not null default 'openai/gpt-oss-120b',
  created_at timestamptz not null default now()
);

create table public.versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  label text not null,
  snapshot jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.messages enable row level security;
alter table public.files enable row level security;
alter table public.agents enable row level security;
alter table public.versions enable row level security;

create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own projects" on public.projects for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own messages" on public.messages for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own files" on public.files for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own agents" on public.agents for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own versions" on public.versions for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Live apps are public by URL: expose only what the live page needs via a security-definer function.
create function public.live_project(p_slug text)
returns table (name text, plan jsonb, demo_data boolean)
language sql security definer set search_path = public as $$
  select name, plan, demo_data from projects where slug = p_slug and stage = 'live';
$$;
grant execute on function public.live_project(text) to anon, authenticated;

-- Auto-create a profile row on sign-up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
