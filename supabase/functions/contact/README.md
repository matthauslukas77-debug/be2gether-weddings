# Contact form Edge Function

Wires the Kontakt page form to Supabase. Receives a JSON POST, writes to `contact_submissions`, and (optionally) sends an email notification via Resend.

## One-time setup

### 1. Schema
Run [`../../../supabase-setup.sql`](../../../supabase-setup.sql) in Supabase SQL Editor. The Phase-6 block at the bottom creates `contact_submissions` with RLS locked down (only service-role can read/write — the Edge Function uses that).

### 2. Deploy the function
```bash
# from the project root (b2together_ak/)
supabase functions deploy contact
```

You'll need the Supabase CLI logged into the project:
```bash
supabase login
supabase link --project-ref fbckyuxwxngfbhivhotv
```

### 3. Environment variables
The function reads three env vars. Set them in Supabase:

```bash
# Required: gives email notifications
supabase secrets set RESEND_API_KEY=re_xxx_yyyy

# Optional: the From address. Default is the Resend sandbox.
# Use a domain you've verified in Resend (e.g. mail@be2gether-weddings.de) to reach inboxes reliably.
supabase secrets set RESEND_FROM='be2gether <mail@be2gether-weddings.de>'
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by the platform — no need to set them.

### 4. Get a Resend API key
1. Sign up at https://resend.com
2. Add and verify the `be2gether-weddings.de` domain (DNS TXT/MX records)
3. Create an API key, paste into the `secrets set` command above

If you skip Resend, the function still **stores** every submission to the table — you just won't get an email until the key is added. You can review submissions in Supabase Dashboard → Table Editor → `contact_submissions`.

## Endpoint
```
POST https://fbckyuxwxngfbhivhotv.supabase.co/functions/v1/contact
Headers:
  Content-Type: application/json
  apikey: <anon key>
  Authorization: Bearer <anon key>
Body (JSON):
  {
    "name": "...",
    "email": "...",
    "phone": "...",          // optional
    "weddingDate": "...",    // optional
    "weddingPlace": "...",   // optional
    "message": "...",        // optional
    "source": "...",         // optional
    "submittedAt": "ISO",
    "userAgent": "...",
    "referer": "..."
  }
```

The frontend code at [`b2together_ak/js/contact-form.js`](../../../js/contact-form.js) handles this.

## Notification email
Goes to **info@be2gether-weddings.de** (hardcoded — change `NOTIFY_TO` in `index.ts` to redirect).

`reply_to` is set to the submitter's email so Miri can reply directly.
