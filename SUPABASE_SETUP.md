# Supabase Setup — be2gether CMS

Two one-time steps in the Supabase dashboard before the admin panel works.

Project: `fbckyuxwxngfbhivhotv` (URL is in [js/cms-config.js](js/cms-config.js)).

---

## 1. Create the database schema

Open **SQL Editor** in Supabase → paste the contents of [supabase-setup.sql](supabase-setup.sql) → **Run**.

Creates:
- table `public.cms_content (page_id, data jsonb, updated_at)`
- RLS policies: anon can SELECT, authenticated can INSERT/UPDATE/DELETE
- trigger to auto-bump `updated_at`

---

## 2. Create the admin user

Open **Authentication → Users → Add user → Create new user**.

| Field           | Value                    |
| --------------- | ------------------------ |
| Email           | `admin@be2gether.local`  |
| Password        | `demo`                   |
| Auto Confirm    | ☑ yes                    |

The email is hardcoded in [js/cms-config.js](js/cms-config.js#L5) (`adminEmail`). The login form only asks for the password — the email is sent silently.

---

## How it works

- **cms-loader.js** (on every public page) fetches all rows from `cms_content` with the anon key and merges them on top of the base JSON in `data/*.json`.
- **admin.js** signs in via `signInWithPassword({ email: adminEmail, password: <input> })`. On save, it `upsert`s a row into `cms_content` keyed by page_id.
- The base JSON in `data/*.json` is the source of truth; Supabase only stores **diffs** that override fields.

## Changing the admin password

Either update the user in Supabase **Authentication → Users**, or have the admin reset via Supabase email link (only if you swap `admin@be2gether.local` for a real address).
