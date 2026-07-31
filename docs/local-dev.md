# ローカル開発環境セットアップ

## 前提条件

| ツール | バージョン | 備考 |
|--------|-----------|------|
| Node.js | >= 24.0.0 | `engines` 指定 |
| pnpm | >= 10 | `corepack enable` で有効化 |
| Docker | 最新 | Supabase ローカルスタック用 |
| Supabase CLI | 最新 | `npm i -g supabase` または `brew install supabase/tap/supabase` |

## 起動手順

### 1. 依存パッケージのインストール

```bash
pnpm install
```

### 2. Supabase ローカルスタックの起動

```bash
cd supabase
supabase start
```

起動成功後、以下のような出力が表示されます:

```
API URL: http://127.0.0.1:54321
anon key: eyJ...
service_role key: eyJ...
JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
```

### 3. 環境変数の設定

プロジェクトルートに `.env` を作成し、`.env.example` をコピーして値を埋めます:

```bash
cp .env.example .env
```

`supabase start` の出力を `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` に設定してください。

### 4. データベースのマイグレーション適用

```bash
cd supabase
supabase db reset
```

`supabase/migrations/` 配下の SQL がローカル DB に適用されます。

### 5. 開発サーバーの起動

プロジェクトルートに戻り:

```bash
pnpm dev
```

`turbo dev` が実行され、以下のサービスが同時起動します:

| サービス | URL | 説明 |
|---------|-----|------|
| API (wrangler dev) | http://localhost:8787 | Hono + Cloudflare Workers |
| Web (astro dev) | http://localhost:4321 | Astro フロントエンド |
| worker-email (wrangler dev) | http://localhost:8788 | メール送信 Worker |
| worker-notification (wrangler dev) | http://localhost:8789 | 通知 Worker |

### 6. 動作確認

- http://localhost:8787/api/health → `{ "success": true }` が返れば API 正常
- http://localhost:4321 → フロントエンド表示
- http://localhost:54323 → Supabase Studio (DB 管理画面)

## データベースのリセット

スキーマ変更やテストデータ初期化が必要な場合:

```bash
cd supabase
supabase db reset
```

`supabase/migrations/` の全マイグレーションが再適用され、データが初期状態に戻ります。

## Supabase の停止

```bash
cd supabase
supabase stop
```

## トラブルシューティング

### Docker が起動していない

`supabase start` は Docker に依存します。Docker Desktop が起動していることを確認してください。

### ポート競合

既定ポート (54321–54324, 8787, 4321) が使用中の場合は、`supabase/config.toml` または各 `wrangler.jsonc` のポート設定を変更してください。

### wrangler の認証エラー

```bash
npx wrangler login
```

で Cloudflare にログインしてください。ローカル開発 (`wrangler dev`) では認証不要ですが、KV/R2/Queue などのリモートリソースにアクセスする場合はログインが必要です。
