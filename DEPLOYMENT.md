# Deploying GlobeTrotter to Vercel

Once connected, every push to `main` deploys automatically and pushes to other
branches get their own preview URL. No CI configuration is needed — Vercel's
GitHub integration handles it.

There is one thing you must do first, and it is not optional.

---

## 1. Get a hosted database

**Your current database is `localhost:5434`. Vercel cannot reach it.** Nothing
else in this guide matters until this is sorted — the build will succeed and
every page will 500.

Any hosted Postgres works. [Neon](https://neon.tech) is the easiest fit because
it is serverless-native and gives you both connection strings on the dashboard:

| Variable | Which string |
|---|---|
| `DATABASE_URL` | the **pooled** one (contains `-pooler`) |
| `DIRECT_URL` | the **direct** one |

Why two: serverless functions open far more connections than Postgres accepts,
so normal queries go through a pooler. Schema operations cannot run through a
pooler, so they use the direct connection. If your provider has no pooler, set
both to the same value.

### Load your schema and seed data

Run this **locally**, pointed at the hosted database — Vercel's build does not
touch your data:

```bash
# Temporarily point at production, in your shell only (do not edit .env)
export DATABASE_URL="<your pooled connection string>"
export DIRECT_URL="<your direct connection string>"

npx prisma db push
npm run db:seed
```

> `db:seed` **deletes all existing trips** before reseeding. It is for first-time
> setup only. Never run it against a database with real user data.

---

## 2. Set environment variables in Vercel

Project → Settings → Environment Variables. Add each to **Production**,
**Preview**, and **Development**:

| Variable | Value | Required |
|---|---|---|
| `DATABASE_URL` | Pooled connection string | Yes |
| `DIRECT_URL` | Direct connection string | Yes |
| `JWT_SECRET` | Fresh random value — **not** your local one | Yes |
| `GROQ_API_KEY` | From console.groq.com/keys | No — features disable cleanly without it |
| `NEXT_PUBLIC_APP_URL` | Your final URL, no trailing slash | No — falls back to the Vercel hostname |

Generate a production `JWT_SECRET`:

```bash
openssl rand -base64 48
```

Use a different secret from local. Sharing one means a session cookie minted on
your laptop authenticates against production.

> **Rotate the Groq key** before going live. The current one was pasted into a
> chat message, so treat it as compromised.

---

## 3. Connect the repository

1. [vercel.com/new](https://vercel.com/new) → import `DEV2705/Globe-Trotter`
2. Framework preset: **Next.js** (detected automatically)
3. Leave build and output settings alone — `vercel.json` and `package.json`
   already carry the right values
4. Add the environment variables from step 2 **before** the first deploy
5. Deploy

From then on: **push to `main` → production deploy. Push to any other branch →
preview deploy.** That is the auto-update behaviour you asked for; it needs no
further setup.

---

## What was configured, and why

| File | Change | Reason |
|---|---|---|
| `prisma/schema.prisma` | `binaryTargets = ["native", "rhel-openssl-3.0.x"]` | Vercel runs Amazon Linux. Without the second target the function cannot load a query engine and every database call fails at runtime. |
| `prisma/schema.prisma` | `directUrl` | Lets `prisma db push` bypass the connection pooler. |
| `package.json` | `postinstall: prisma generate` | Vercel caches `node_modules` between builds. Without this, a cached install ships a stale Prisma client. |
| `package.json` | `engines.node >= 20` | Pins the runtime so a Vercel default change cannot break the build. |
| `src/app/api/chat/route.ts` | `runtime = 'nodejs'`, `maxDuration = 30` | Prisma cannot run on the edge runtime. A streamed reply outlives the 10s default; 30s stays within the Hobby limit. |
| `src/lib/app-url.ts` | URL resolution helper | Share links resolve on preview deployments without configuration, and a custom domain still overrides. |
| `vercel.json` | `regions: ["bom1"]` | Mumbai. Put functions near your database — change this to match wherever you host Postgres. |

---

## Known limitations in production

**Rate limiting weakens.** `src/server/ai/rate-limit.ts` counts requests in
process memory. Vercel runs many short-lived instances, so each holds its own
counter and the effective limit is higher than the configured 5/10/30 per hour.
It still prevents a single runaway session, but it is not a hard cap. Moving to
a shared store (Upstash Redis fits the same interface) is the fix if abuse
becomes a real concern.

**Groq's free tier allows 8000 tokens per minute.** Concurrent users generating
itineraries will hit 429s. The code retries with backoff and degrades to a
catalogue-built trip rather than failing, but a paid tier is worth it before a
public demo.

**Base64 images.** Avatars and covers are stored as data URLs in Postgres rather
than object storage. Fine at demo scale; it will bloat the database and slow
queries under real usage. Blob storage is the eventual fix.

---

## Verifying a deployment

```bash
# Replace with your deployment URL
URL=https://your-app.vercel.app

curl -s -o /dev/null -w "%{http_code}\n" $URL          # 307 → redirects to /login
curl -s -o /dev/null -w "%{http_code}\n" $URL/login    # 200
curl -s -o /dev/null -w "%{http_code}\n" -X POST $URL/api/chat  # 401 when signed out
```

Then in a browser: sign in with a seeded account, generate an itinerary, open
the assistant, and generate a packing list. If pages load but data is missing,
the database variables are wrong. If the AI panels show "not configured",
`GROQ_API_KEY` did not reach the environment you are testing.
