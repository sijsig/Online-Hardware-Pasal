# Supabase development

The linked Supabase project was inspected with `supabase db pull --declarative`.
Its public schema contains no marketplace tables, and the remote migration list
was empty before the local baseline was prepared. The original supplied SQL
does not match the requested hyperlocal marketplace model; the earlier draft
is preserved under `archive/` for reference.

`migrations/20261008150000_hyperlocal_foundation.sql` creates the marketplace
schema. `migrations/20261008153000_seed_hardware_categories.sql` adds the real
hardware category hierarchy using stable slugs, so it is safe to apply to a
hosted project. `seed.sql` contains clearly labeled synthetic products,
vendors, and inventory for local development only. `supabase db push` does not
apply the local seed file. Never run `supabase db reset` against a linked
project.

`migrations/20261008154500_expand_nearby_product_search.sql` lets the location
search match product names, brands, models, and database category branches.

`migrations/20261008160000_customer_address_rpc.sql` adds the authenticated,
server-validated address function used by checkout. The following migration
restricts address and order creation to the authenticated customer role at the
database layer. New customer accounts use Supabase email magic links; in
Supabase Auth URL Configuration, allow
`http://localhost:3000/auth/callback` and
`https://hardwareonlinepasal.com/auth/callback` (plus the `www` hostname if it
will serve the site). Enable email sign-in before testing authentication.

Run the local stack with Docker Desktop running, then validate the migrations
and seed with `supabase start` and `supabase db reset` (local database only).
Before applying migrations to a hosted project, check `supabase migration list
--linked` and preview with `supabase db push --linked --dry-run`. The latest
remote migration status must be checked in the linked project rather than
assumed from the local files.

Copy `.env.example` to `.env.local` for the app. Keep secret keys out of
browser-visible variables; no service-role key belongs in client code.
