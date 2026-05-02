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

-- ════════════════════════════════════════════════════════════
-- Contact form submissions (Phase 6)
-- Used by the `contact` Edge Function (supabase/functions/contact)
-- ════════════════════════════════════════════════════════════
create table if not exists public.contact_submissions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null,
  email         text not null,
  phone         text,
  wedding_date  text,
  wedding_place text,
  message       text,
  source        text,
  user_agent    text,
  referer       text
);

alter table public.contact_submissions enable row level security;

-- The Edge Function uses the service-role key, which bypasses RLS.
-- Block all direct anon/authenticated access; nobody reads/writes from the client.
drop policy if exists contact_submissions_no_anon on public.contact_submissions;
create policy contact_submissions_no_anon
  on public.contact_submissions
  for all
  to anon, authenticated
  using (false)
  with check (false);
