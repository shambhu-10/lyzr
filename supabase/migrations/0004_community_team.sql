-- Architect 2.0 · community gallery (opt-in), remix + view counts, and team sharing.

-- ── Community gallery ────────────────────────────────────────────────
alter table public.projects
  add column showcase boolean not null default false,
  add column showcase_author text,
  add column views int not null default 0,
  add column remixes int not null default 0;

-- Only live, opted-in apps; never owner ids, prompts or connection state. (The plan is already public via /live.)
create function public.showcase_projects(p_limit int default 12)
returns table (slug text, name text, tagline text, plan jsonb, author text, views int, remixes int, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select slug, name, plan->>'tagline', plan, showcase_author, views, remixes, updated_at
  from projects where stage = 'live' and showcase
  order by remixes desc, views desc, updated_at desc
  limit least(greatest(p_limit, 1), 48);
$$;

create function public.bump_view(p_slug text) returns void
language sql security definer set search_path = public as $$
  update projects set views = views + 1 where slug = p_slug and stage = 'live';
$$;

create function public.record_remix(p_slug text) returns void
language sql security definer set search_path = public as $$
  update projects set remixes = remixes + 1 where slug = p_slug and stage = 'live';
$$;

grant execute on function public.showcase_projects(int) to anon, authenticated;
grant execute on function public.bump_view(text) to anon, authenticated;
grant execute on function public.record_remix(text) to authenticated;

-- ── Team sharing ─────────────────────────────────────────────────────
create table public.project_members (
  project_id uuid not null references public.projects on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('viewer', 'editor')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.project_invites (
  token uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  role text not null check (role in ('viewer', 'editor')),
  created_by uuid not null default auth.uid() references auth.users on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);

alter table public.project_members enable row level security;
alter table public.project_invites enable row level security;

-- Owner, or a member with at least the needed role. Security definer so policies on projects don't recurse.
create function public.can_access(p_project uuid, p_need text default 'viewer') returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects where id = p_project and owner_id = auth.uid())
      or exists (select 1 from project_members where project_id = p_project and user_id = auth.uid()
                 and (p_need = 'viewer' or role = 'editor'));
$$;
grant execute on function public.can_access(uuid, text) to authenticated;

create function public.is_owner(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects where id = p_project and owner_id = auth.uid());
$$;
grant execute on function public.is_owner(uuid) to authenticated;

-- Owners manage members and invites; members can see who else is on the project (via project_people) and leave.
create policy "owner manages members" on public.project_members for all using (public.is_owner(project_id)) with check (public.is_owner(project_id));
create policy "member leaves" on public.project_members for delete using (user_id = auth.uid());
create policy "owner manages invites" on public.project_invites for all using (public.is_owner(project_id)) with check (public.is_owner(project_id));

-- Accepting an invite adds the caller; the owner never becomes a member of their own project.
create function public.accept_invite(p_token uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv project_invites;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into inv from project_invites where token = p_token and expires_at > now();
  if not found then raise exception 'This invite link is invalid or has expired'; end if;
  if not exists (select 1 from projects where id = inv.project_id and owner_id = auth.uid()) then
    insert into project_members (project_id, user_id, role) values (inv.project_id, auth.uid(), inv.role)
    on conflict (project_id, user_id) do update set role = excluded.role;
  end if;
  return inv.project_id;
end $$;
grant execute on function public.accept_invite(uuid) to authenticated;

-- Names and roles of everyone on a project, visible only to people on it.
create function public.project_people(p_project uuid)
returns table (user_id uuid, name text, role text, is_you boolean)
language sql stable security definer set search_path = public as $$
  select p.owner_id, coalesce(pr.full_name, 'Owner'), 'owner', p.owner_id = auth.uid()
  from projects p left join profiles pr on pr.id = p.owner_id
  where p.id = p_project and public.can_access(p_project)
  union all
  select m.user_id, coalesce(pr.full_name, 'Teammate'), m.role, m.user_id = auth.uid()
  from project_members m left join profiles pr on pr.id = m.user_id
  where m.project_id = p_project and public.can_access(p_project);
$$;
grant execute on function public.project_people(uuid) to authenticated;

-- Extra permissive policies: members read; editors write. Owner-only policies (incl. delete) stay as they are.
create policy "members read project" on public.projects for select using (public.can_access(id));
create policy "editors update project" on public.projects for update using (public.can_access(id, 'editor')) with check (public.can_access(id, 'editor'));

create policy "members read messages" on public.messages for select using (public.can_access(project_id));
create policy "editors write messages" on public.messages for insert with check (public.can_access(project_id, 'editor'));

create policy "members read files" on public.files for select using (public.can_access(project_id));
create policy "editors insert files" on public.files for insert with check (public.can_access(project_id, 'editor'));
create policy "editors update files" on public.files for update using (public.can_access(project_id, 'editor')) with check (public.can_access(project_id, 'editor'));
create policy "editors delete files" on public.files for delete using (public.can_access(project_id, 'editor')); -- revert rewrites files

create policy "members read versions" on public.versions for select using (public.can_access(project_id));
create policy "editors write versions" on public.versions for insert with check (public.can_access(project_id, 'editor'));

create policy "members read comments" on public.comments for select using (public.can_access(project_id));
create policy "editors write comments" on public.comments for insert with check (public.can_access(project_id, 'editor'));
create policy "editors update comments" on public.comments for update using (public.can_access(project_id, 'editor')) with check (public.can_access(project_id, 'editor'));

create policy "members read project agents" on public.agents for select using (project_id is not null and public.can_access(project_id));
create policy "editors update project agents" on public.agents for update using (project_id is not null and public.can_access(project_id, 'editor')) with check (project_id is not null and public.can_access(project_id, 'editor'));

-- Editors can update a project but never take ownership of it.
create function public.keep_owner() returns trigger language plpgsql as $$
begin
  if new.owner_id <> old.owner_id then raise exception 'Project ownership cannot be changed'; end if;
  return new;
end $$;
create trigger projects_keep_owner before update on public.projects for each row execute function public.keep_owner();
