-- Architect 2.0 · encrypted secrets (API keys / env vars).
-- Values are AES-256-GCM encrypted on the server with SECRETS_KEY before they reach the database;
-- the browser only ever sees the name and last 4 characters.

create table public.secrets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid references public.projects on delete cascade,   -- null = workspace vault
  env text not null default 'all' check (env in ('all', 'development', 'preview', 'production')),
  name text not null check (name ~ '^[A-Z][A-Z0-9_]{0,63}$'),
  ciphertext text not null,
  iv text not null,
  tag text not null,
  last4 text not null default '',
  updated_at timestamptz not null default now()
);

create unique index secrets_scope_name on public.secrets (owner_id, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), env, name);

alter table public.secrets enable row level security;
create policy "own secrets" on public.secrets for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
