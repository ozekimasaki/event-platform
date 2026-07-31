# Event Platform - Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Cloudflare CDN                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Web (Astro)  │    │  API (Hono)  │    │  Email Worker │  │
│  │  CF Workers   │    │  CF Workers  │    │  CF Workers   │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                    │                    │          │
│         └────────┬───────────┘                    │          │
│                  │                                │          │
│  ┌───────────────┼────────────────────────────────┼─────┐   │
│  │          Cloudflare Platform                     │    │   │
│  │                                                   │    │   │
│  │  ┌─────┐ ┌────┐ ┌────┐ ┌───────┐ ┌──────────┐  │    │   │
│  │  │ KV  │ │ R2 │ │ DO │ │ Queues│ │Email Svc │  │    │   │
│  │  └─────┘ └────┘ └────┘ └───────┘ └──────────┘  │    │   │
│  └───────────────────────────────────────────────────┘    │   │
│                                                          │   │
│  ┌──────────────────────┐                                │   │
│  │     Supabase          │                                │   │
│  │  PostgreSQL + Auth    │                                │   │
│  │  + RLS + Realtime     │                                │   │
│  └──────────────────────┘                                │   │
│                                                          │   │
│  ┌──────────┐  ┌──────────┐                              │   │
│  │  Stripe  │  │  Twilio  │                              │   │
│  └──────────┘  └──────────┘                              │   │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Astro + React Islands | v7.1.6 / v19.2.8 |
| CSS | Tailwind CSS | v4.3.3 |
| Backend | Hono on CF Workers | v4.12.32 |
| Database | Supabase PostgreSQL | JS v2.111.0 |
| Auth | Supabase Auth (JWT) | jose |
| Storage | Cloudflare R2 | - |
| Cache | KV + Cache API | - |
| Realtime | Durable Objects WebSocket | Hibernation API |
| Queue | Cloudflare Queues | - |
| Payment | Stripe SDK | v22.3.2 |
| Email | CF Email Service | Beta |
| SMS | Twilio API | - |
| Monorepo | Turborepo + pnpm | v11.18.0 |
| Testing | Vitest | v4.1.10 |
| TypeScript | TypeScript | v7.0.2 |

## Project Structure

```
event-platform/
├── turbo.json
├── pnpm-workspace.yaml
├── packages/
│   ├── shared/          # Shared types, Zod schemas, constants
│   └── api-client/      # Hono RPC client + TanStack Query hooks
├── apps/
│   ├── api/             # Hono on Cloudflare Workers
│   │   ├── src/
│   │   │   ├── routes/       # API route handlers
│   │   │   ├── services/     # Business logic
│   │   │   ├── middleware/   # Auth, CORS, rate limiting
│   │   │   └── durable-objects/  # CheckIn, Chat
│   │   └── wrangler.jsonc
│   ├── web/             # Astro 7 + React 19
│   │   ├── src/
│   │   │   ├── pages/        # Routing (SSG/SSR)
│   │   │   ├── components/   # UI components + React islands
│   │   │   ├── layouts/      # Layout templates
│   │   │   └── styles/       # Theme CSS + Tailwind
│   │   └── astro.config.ts
│   ├── worker-email/    # Email sender worker
│   └── worker-notification/  # Notification worker
├── supabase/
│   ├── migrations/      # DB migrations
│   └── seed/           # Seed data
├── .github/workflows/   # CI/CD
└── docs/               # Documentation
```

## Database Schema (Core Tables)

- **profiles** - User profiles (linked to Supabase Auth)
- **organizers** - Event organizer entities
- **events** - Events (title, slug, dates, venue, status, capacity)
- **tickets** - Ticket types per event
- **registrations** - Participant registrations with QR tokens
- **payments** - Stripe payment records
- **sessions** - Event sessions/timetable
- **articles** - Blog articles
- **surveys** - Event surveys with JSONB questions
- **survey_responses** - Survey answers
- **chat_messages** - Real-time chat messages
- **support_tickets** - Support ticket system
- **notifications** - Multi-channel notifications
- **api_keys** - Public API key management
- **webhooks** - Webhook configurations
- **email_log** - Email delivery tracking

## Design System

- **KASHIYAMA-based** dual theme (light/dark)
- CSS Custom Properties + `data-theme` attribute
- Tailwind CSS v4 `@custom-variant` for dark mode
- 4px grid spacing system
- WCAG AA compliant contrast ratios
- `font-feature-settings: "palt"` for Japanese text

## Security

- JWT verification via jose library
- Supabase RLS for data isolation
- API key authentication (SHA-256 hashed)
- Webhook HMAC-SHA256 signatures
- CORS configuration
- Rate limiting (CF Workers Rate Limiting API)
