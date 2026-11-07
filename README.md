# Keystone Web

[![Deployment Status](https://img.shields.io/badge/deployment-ready-brightgreen)](https://keystoneweb.vercel.app)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org)

A scalable, cost-effective multi-tenant CMS platform that serves unlimited websites from a single Next.js instance and shared PostgreSQL database.

## ✨ Features

- **Single Codebase, Infinite Sites**: One Next.js app + Middleware routing = 1,000,000+ websites
- **99% Cost Reduction**: $0.05-5/month per site vs $20-100 competitors
- **Zero Redeployment**: Add new customer sites with a database row (no code changes)
- **Server-Side Rendering**: Fast, SEO-friendly, secure HTML generation
- **Domain-Based Routing**: Each domain gets its own theme & content from the database
- **Production-Ready**: TypeScript, fully tested, deployed to Vercel

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## 🗄️ Database migrations

Schema changes go in `migrations/` as `NNN_description.sql` (next free number).
When the file is merged to `main`, the **Migrate prod DB** GitHub Action
([`.github/workflows/migrate-prod.yml`](.github/workflows/migrate-prod.yml)) applies
it to the prod Supabase DB. No manual SQL editor step.

- Each file runs once, in its own transaction, recorded in `public.schema_migrations`.
- Don't add `BEGIN`/`COMMIT` to the file. For `CREATE INDEX CONCURRENTLY` and similar,
  put `-- migrate:no-transaction` in the first 5 lines.
- Don't edit a migration after it has run; add a new one.
- Keep migrations additive (`ADD COLUMN IF NOT EXISTS`, new tables). Vercel deploys the
  same push in parallel, so old code may briefly run against the new schema.
- If a migration fails, the Action fails and later files are not run. Fix it in a new
  commit and the next push (or a manual **apply** run) picks it up.
- Preview what would run: Actions → Migrate prod DB → Run workflow → `dry-run`.
- Staging catches up on its own via the nightly prod → staging sync.

The runner is [`scripts/migrate.sh`](scripts/migrate.sh) and needs `DATABASE_URL` and `psql`.




