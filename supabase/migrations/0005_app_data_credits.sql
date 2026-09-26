-- Architect 2.0 · real app data (rows your generated apps save) and admin-granted bonus credits.

-- ── Bonus credits ────────────────────────────────────────────────────
-- Balance = $20 on sign-up + bonus_credits − spend. Only the database admin can change the bonus:
-- people can update their own profile (RLS), so a trigger blocks this one column for signed-in users.
alter table public.profiles add column bonus_credits numeric(10,2) not null default 0;

create function public.protect_bonus_credits() returns trigger language plpgsql as $$
begin
  if new.bonus_credits is distinct from old.bonus_credits and current_user in ('authenticated', 'anon') then
    raise exception 'Credits are managed by Architect';
  end if;
  return new;
end $$;
create trigger profiles_protect_bonus before update on public.profiles for each row execute function public.protect_bonus_credits();

-- One-off: +$20 for the project owner's account.
update public.profiles set bonus_credits = bonus_credits + 20
where id = (select id from auth.users where email = 'officialshambhu10@gmail.com');

-- ── App data ─────────────────────────────────────────────────────────
-- Rows saved by generated apps (forms in the preview and on the live URL), one store per project.
create table public.app_rows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  table_name text not null check (table_name ~ '^[a-z][a-z0-9_]{0,39}$'),
  data jsonb not null default '{}' check (pg_column_size(data) < 8000),
  source text not null default 'app' check (source in ('app', 'seed', 'live')),
  created_at timestamptz not null default now()
);
create index on public.app_rows (project_id, table_name, created_at desc);
alter table public.app_rows enable row level security;

-- People on the project read; editors (and the owner) write. can_access() comes from migration 0004.
create policy "people on the project read app rows" on public.app_rows for select using (public.can_access(project_id));
create policy "editors add app rows" on public.app_rows for insert with check (public.can_access(project_id, 'editor'));
create policy "editors delete app rows" on public.app_rows for delete using (public.can_access(project_id, 'editor'));

-- Visitors of a live app submit forms only through this function (live apps only, size-capped).
-- ponytail: per-project cap instead of real rate limiting; add a per-IP limiter before real traffic.
create function public.live_insert_row(p_slug text, p_table text, p_data jsonb) returns void
language sql security definer set search_path = public as $$
  insert into app_rows (project_id, table_name, data, source)
  select p.id, p_table, p_data, 'live' from projects p
  where p.slug = p_slug and p.stage = 'live'
    and p_table ~ '^[a-z][a-z0-9_]{0,39}$' and pg_column_size(p_data) < 8000
    and (select count(*) from app_rows r where r.project_id = p.id) < 5000;
$$;
grant execute on function public.live_insert_row(text, text, jsonb) to anon, authenticated;
