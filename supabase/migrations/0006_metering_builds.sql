-- Architect 2.0 · real credit metering + sandbox build runs.

-- ── Metering ─────────────────────────────────────────────────────────
-- usage_events is now a ledger: people read and add their own rows, but can't edit or delete them
-- (otherwise deleting a row would give credits back).
drop policy if exists "own usage" on public.usage_events;
create policy "read own usage" on public.usage_events for select using (owner_id = auth.uid());
create policy "log own usage" on public.usage_events for insert with check (owner_id = auth.uid());

-- What the signed-in user has spent, grouped for the Usage page. Runs as the caller, so RLS applies.
create function public.my_spend() returns table (project_id uuid, kind text, cost numeric, calls bigint)
language sql stable as $$
  select project_id, kind, coalesce(sum(cost_usd), 0), count(*) from public.usage_events
  where owner_id = auth.uid() group by project_id, kind;
$$;
grant execute on function public.my_spend() to authenticated;

-- ── Build runs ───────────────────────────────────────────────────────
-- One row per real build: the job record the agent loop resumes from (sandbox name, agent history, progress).
-- In production a queue worker would pick these up; here the browser drives the steps.
create table public.build_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  request text,                                 -- a change request; null for the first build
  sandbox text,                                 -- Vercel Sandbox name
  preview_url text,
  step int not null default 0,
  history jsonb not null default '[]',          -- the agent's conversation (old file contents trimmed)
  events jsonb not null default '[]',           -- what the UI shows: files written, commands, errors
  usage jsonb not null default '{}',            -- tokens and cost so far
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index build_runs_one_running on public.build_runs (project_id) where status = 'running';
alter table public.build_runs enable row level security;
create policy "people on the project read builds" on public.build_runs for select using (public.can_access(project_id));
create policy "editors start builds" on public.build_runs for insert with check (public.can_access(project_id, 'editor'));
create policy "editors update builds" on public.build_runs for update using (public.can_access(project_id, 'editor'));
