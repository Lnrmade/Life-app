-- Life app: everything a person logs lives in one table, one row per item,
-- and every row belongs to exactly one signed-in user.
-- Safe to run more than once.

create table if not exists public.entries (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('gym','sport','sleep','work','finance','savings','grocery','wish','trip','settings')),
  id         text not null check (char_length(id) between 1 and 80),
  data       jsonb,
  deleted    boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, kind, id),
  check (deleted or data is not null),
  check (data is null or pg_column_size(data) <= 20000)
);

create index if not exists entries_user_updated_idx on public.entries (user_id, updated_at);

-- Row level security: a user can only see and change their own rows.
alter table public.entries enable row level security;

drop policy if exists "Read own entries" on public.entries;
drop policy if exists "Add own entries" on public.entries;
drop policy if exists "Change own entries" on public.entries;

create policy "Read own entries" on public.entries
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Add own entries" on public.entries
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Change own entries" on public.entries
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Only signed-in users may touch the table through the API. Rows are never
-- hard-deleted by the app (it marks them deleted), so there is no delete grant.
revoke all on public.entries from anon, authenticated;
grant select, insert, update on public.entries to authenticated;

-- The server decides when a row changed, so devices with wrong clocks cannot confuse syncing.
create or replace function public.entries_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

revoke all on function public.entries_touch() from public, anon, authenticated;

drop trigger if exists entries_touch on public.entries;
create trigger entries_touch
  before insert or update on public.entries
  for each row execute function public.entries_touch();

-- "Delete my account": removes the login and, through the cascade, every row.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
