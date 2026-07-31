# Event Platform

Cloudflare Workers + Supabaseで構築されたイベント管理プラットフォーム。Luma、connpass、TECH PLAY、forteeと同等以上の機能を提供。

## 機能

- **イベント管理**: 作成・編集・公開・複数イベント同時管理
- **参加登録**: フォーム・定員管理・ウェイトリスト
- **決済**: Stripe統合（チケット購入・返金）
- **QRコードチェックイン**: 固有QR生成・リアルタイム出席管理
- **メール/通知**: CF Email Service・プッシュ通知・SMS（Twilio）
- **問い合わせ**: チケット管理・リアルタイムチャット（WebSocket）
- **アンケート**: カスタム質問・回答集計・分析
- **ブログ**: WYSIWYGエディタ（TipTap）・SEO対応
- **公開API**: APIキー認証・Webhook配信
- **コミュニティ**: 主催者プロフィール・フォロワー・イベントシリーズ
- **タイムテーブル**: セッション管理・トラック分割・CfP

## 技術スタック

| 層 | 技術 |
|---|------|
| Frontend | Astro 7 + React 19 + Tailwind CSS v4 |
| Backend | Hono v4 on Cloudflare Workers |
| Database | Supabase PostgreSQL (RLS + Auth) |
| Storage | Cloudflare R2 |
| Cache | KV + Cache API |
| Realtime | Durable Objects WebSocket |
| Queue | Cloudflare Queues |
| Payment | Stripe SDK |
| Email | Cloudflare Email Service |
| Monorepo | Turborepo + pnpm v11 |

## セットアップ

### 前提条件

- Node.js v24 LTS
- pnpm v11
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/ozekimasaki/event-platform.git
cd event-platform

# 依存関係のインストール
pnpm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集（Supabase URL/Key、Stripe Key等）
```

### 開発

```bash
# 開発サーバー起動
pnpm run dev

# ビルド
pnpm run build

# リント
pnpm run lint

# テスト
pnpm run test
```

### デプロイ

```bash
# Supabaseマイグレーション
npx supabase db push

# API Worker デプロイ
cd apps/api && wrangler deploy

# Web デプロイ
cd apps/web && wrangler deploy
```

## プロジェクト構造

```
├── packages/
│   ├── shared/          # 共有型定義・Zodスキーマ
│   └── api-client/      # Hono RPCクライアント
├── apps/
│   ├── api/             # Hono on CF Workers (API)
│   ├── web/             # Astro 7 + React 19 (Frontend)
│   └── worker-email/    # メール送信Worker
├── supabase/
│   └── migrations/      # DBマイグレーション
├── .github/workflows/   # CI/CD
└── docs/               # ドキュメント
```

## ドキュメント

- [API仕様書](docs/api-spec.md)
- [デプロイ手順書](docs/deploy.md)
- [技術仕様書](docs/architecture.md)

## ライセンス

MIT
