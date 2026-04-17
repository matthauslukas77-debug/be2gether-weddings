-- ════════════════════════════════════════════════════════════
-- be2gether CMS — Supabase Schema (run once in SQL Editor)
-- ════════════════════════════════════════════════════════════

create table if not exists public.cms_content (
  page_id    text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.cms_content enable row level security;

drop policy if exists "cms_content_read_all"  on public.cms_content;
drop policy if exists "cms_content_write_auth" on public.cms_content;

-- Public read: cms-loader.js fetches with anon key on every page load.
create policy "cms_content_read_all"
  on public.cms_content
  for select
  to anon, authenticated
  using (true);

-- Authenticated write: only the logged-in admin can mutate content.
create policy "cms_content_write_auth"
  on public.cms_content
  for all
  to authenticated
  using (true)
  with check (true);

-- Auto-bump updated_at on every UPDATE.
create or replace function public.cms_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists cms_content_touch on public.cms_content;
create trigger cms_content_touch
  before update on public.cms_content
  for each row
  execute function public.cms_touch_updated_at();
