# Deployment Guide

## Prerequisites

- Node.js >= 24.0.0
- pnpm 11.18.0
- Cloudflare account
- Supabase account

## Local Development

```bash
# Install dependencies
pnpm install

# Start all services
pnpm dev

# Start specific service
pnpm --filter @event-platform/api dev
pnpm --filter @event-platform/web dev
```

## Supabase Setup

```bash
# Start local Supabase
npx supabase start

# Run migrations
npx supabase db reset

# Apply to production
npx supabase db push --linked
```

## Deploy API (Cloudflare Workers)

```bash
cd apps/api
pnpm deploy
```

## Deploy Web (Cloudflare Pages)

```bash
cd apps/web
pnpm build
# Or connect repo to Cloudflare Pages for auto-deploy
```

## Deploy Workers

```bash
cd apps/worker-email
pnpm deploy

cd apps/worker-notification
pnpm deploy
```

## Environment Variables

### API Worker
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_JWT_SECRET` - Supabase JWT secret

### Email Worker
- Email templates in KV
- D1 database for email log

### Notification Worker
- D1 database for notifications
