# AGENTS.md — event-platform

## モノレポ構造

pnpm workspaces + Turborepo によるモノレポ。Node >= 24、pnpm 10.x。

| パス | 責務 |
|------|------|
| `apps/api` | Hono on Cloudflare Workers。REST API・認証・決済・Durable Objects (chat/check-in) |
| `apps/web` | Astro 7 + React 19 + Tailwind 4。Cloudflare Pages/Workers へ SSR デプロイ |
| `apps/worker-email` | Cloudflare Worker。メール送信処理 |
| `apps/worker-notification` | Cloudflare Worker。通知配信処理 |
| `packages/shared` | Zod スキーマ・TypeScript 型・定数。全アプリ共通のスキーマ契約 |
| `packages/api-client` | Hono RPC クライアント + TanStack Query フック。web → api の型安全呼び出し |

## 起動手順・検証コマンド

```bash
# 依存インストール
pnpm install

# 開発サーバ起動（全アプリ並列）
pnpm dev          # = turbo dev

# 検証（CI と同一）
pnpm typecheck    # = turbo typecheck（各パッケージ tsc --noEmit）
pnpm lint         # = turbo lint（ESLint 9）
pnpm test         # = turbo test（Vitest）
```

単一パッケージのみ実行: `pnpm --filter @event-platform/api typecheck`

## コア境界

- **ビジネスロジック**: `apps/api/src/services/` — ルートハンドラ (`routes/`) はバリデーションとレスポンス整形のみを行い、ドメインロジックは services に委譲する。
- **スキーマ契約**: `packages/shared/src/schemas/` — API 入出力の Zod スキーマを一元管理。api は `@hono/zod-validator` で、web は api-client 経由で消費する。
- **型定義**: `packages/shared/src/types/` — DB レコード・API レスポンスの TypeScript 型。
- **ミドルウェア**: `apps/api/src/middleware/auth.ts` — JWT 認証・ロール制御。
- **Durable Objects**: `apps/api/src/durable-objects/` — リアルタイム chat / check-in 状態管理。

### 変更時の制約

1. スキーマ変更は `packages/shared` を先に変更 → api / web 側を適合させる。
2. `routes/` にビジネスロジックを書かない。必ず `services/` に切り出す。
3. 環境変数は `wrangler.jsonc` の vars / secrets で管理し、`.env` をコミットしない。
4. 型チェック・リントを通してから PR を作成する (`pnpm typecheck && pnpm lint`)。

## 推奨スキル

このプロジェクトで作業する際に活用すべきエージェントスキル:

| スキル | 用途 |
|--------|------|
| `cloudflare` | Workers / Pages / KV / D1 / R2 / Durable Objects 全般 |
| `workers-best-practices` | Workers コードレビュー・アンチパターン検出 |
| `durable-objects` | Durable Objects 設計・RPC・SQLite・WebSocket |
| `wrangler` | wrangler CLI 操作・デプロイ・シークレット管理 |
| `supabase` | Supabase Auth / Database / RLS / Edge Functions |
| `supabase-postgres-best-practices` | Postgres クエリ最適化・スキーマ設計 |
