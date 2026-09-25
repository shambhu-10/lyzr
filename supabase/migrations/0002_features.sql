-- Architect 2.0 · feature batch: real AI usage metering, preview comments, agent evals.

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid references public.projects on delete cascade,
  kind text not null,              -- questions | plan | revise | screen | agent | eval | change
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  ms int not null default 0,
  cost_usd numeric(12, 6),         -- null when the model's list price isn't published
  created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  screen text not null,
  target text not null default '',  -- which block the comment points at
  body text not null,
  status text not null default 'open' check (status in ('open', 'sent', 'resolved')),
  created_at timestamptz not null default now()
);

alter table public.agents add column evals jsonb not null default '[]';

alter table public.usage_events enable row level security;
alter table public.comments enable row level security;
create policy "own usage" on public.usage_events for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own comments" on public.comments for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create index on public.usage_events (owner_id, created_at desc);
create index on public.comments (project_id, created_at);
