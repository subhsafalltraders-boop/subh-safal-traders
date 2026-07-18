# Cash Denomination Calculator

Standalone app — no PWA/service worker, so it stays separate from the main
Subh Safal Traders app when that one is installed/downloaded.

## Deploy as its own Vercel project (same GitHub repo)

1. In Vercel: **Add New → Project**, pick this same GitHub repo again.
2. Under **Root Directory**, set it to `money-app`.
3. Add environment variables (same values as the main app's Supabase project):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.
5. In the new Vercel project's **Settings → Domains**, add `money.subhsafaltraders.in`
   and follow Vercel's DNS instructions (usually a CNAME record).
6. Run `supabase-migration.sql` once in your Supabase SQL editor (skip this if
   you already ran the equivalent migration for the main app).

That's it — this becomes a fully separate deployment from the main app, sharing
only the Supabase database.
