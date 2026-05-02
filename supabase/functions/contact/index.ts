// be2gether — Contact form Edge Function
// Receives POST { name, email, phone, weddingDate, weddingPlace, message, source, ... }
// 1. Inserts into contact_submissions table (always)
// 2. Sends notification email via Resend (if RESEND_API_KEY set)
// 3. Returns 200 if storage succeeded; email failure is non-blocking but logged

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const NOTIFY_TO = "info@be2gether-weddings.de";
const NOTIFY_FROM = Deno.env.get("RESEND_FROM") ?? "be2gether <onboarding@resend.dev>";
const RESEND_KEY = Deno.env.get("RESEND_API_KEY");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escape(str: string | undefined | null): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

async function sendEmail(submission: Record<string, unknown>): Promise<void> {
  if (!RESEND_KEY) {
    console.warn("RESEND_API_KEY not set — skipping email notification.");
    return;
  }
  const name = String(submission.name ?? "");
  const email = String(submission.email ?? "");

  const html = `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#2C2C2C;line-height:1.6">
      <h2 style="font-style:italic;color:#A88B66">Neue Kennenlerngespräch-Anfrage</h2>
      <table style="border-collapse:collapse;width:100%;margin-top:1.5rem">
        <tr><td style="padding:.5rem 0;color:#888;width:160px">Name</td><td style="padding:.5rem 0">${escape(name)}</td></tr>
        <tr><td style="padding:.5rem 0;color:#888">E-Mail</td><td style="padding:.5rem 0"><a href="mailto:${escape(email)}">${escape(email)}</a></td></tr>
        <tr><td style="padding:.5rem 0;color:#888">Telefon</td><td style="padding:.5rem 0">${escape(submission.phone as string)}</td></tr>
        <tr><td style="padding:.5rem 0;color:#888">Hochzeitsdatum</td><td style="padding:.5rem 0">${escape(submission.weddingDate as string)}</td></tr>
        <tr><td style="padding:.5rem 0;color:#888">Hochzeitsort</td><td style="padding:.5rem 0">${escape(submission.weddingPlace as string)}</td></tr>
        <tr><td style="padding:.5rem 0;color:#888">Gefunden über</td><td style="padding:.5rem 0">${escape(submission.source as string)}</td></tr>
      </table>
      <h3 style="margin-top:2rem;font-style:italic;color:#A88B66">Nachricht</h3>
      <p style="white-space:pre-wrap;background:#FDF8F0;padding:1rem;border-left:3px solid #C5A47E">${escape(submission.message as string) || "<em>(keine Nachricht)</em>"}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:2rem 0">
      <p style="color:#888;font-size:.85rem">Eingegangen: ${escape(submission.submittedAt as string)}</p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: NOTIFY_FROM,
      to: [NOTIFY_TO],
      reply_to: email && isValidEmail(email) ? email : undefined,
      subject: `Neue Anfrage von ${name || "Anonymous"}`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Resend send failed:", res.status, body);
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const name = String(payload.name ?? "").trim();
  const email = String(payload.email ?? "").trim();

  if (!name || !email || !isValidEmail(email)) {
    return new Response(JSON.stringify({ error: "Name and valid email required" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const submission = {
    name,
    email,
    phone: String(payload.phone ?? "").trim() || null,
    wedding_date: String(payload.weddingDate ?? "").trim() || null,
    wedding_place: String(payload.weddingPlace ?? "").trim() || null,
    message: String(payload.message ?? "").trim() || null,
    source: String(payload.source ?? "").trim() || null,
    user_agent: String(payload.userAgent ?? "").slice(0, 500),
    referer: String(payload.referer ?? "").slice(0, 500),
  };

  // 1. Insert into Supabase table
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { error: dbErr } = await sb.from("contact_submissions").insert(submission);
  if (dbErr) {
    console.error("DB insert failed:", dbErr);
    return new Response(JSON.stringify({ error: "Storage failed", detail: dbErr.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // 2. Send email (non-blocking on error — submission already stored)
  try {
    await sendEmail({ ...payload, ...submission });
  } catch (err) {
    console.error("Email send failed (submission still stored):", err);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
