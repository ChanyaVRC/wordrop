# Wordrop

[![CI](https://github.com/ChanyaVRC/wordrop/actions/workflows/ci.yml/badge.svg)](https://github.com/ChanyaVRC/wordrop/actions/workflows/ci.yml)
[![Deploy](https://github.com/ChanyaVRC/wordrop/actions/workflows/deploy.yml/badge.svg)](https://github.com/ChanyaVRC/wordrop/actions/workflows/deploy.yml)

好きな5文字の英単語を出題し、生成されたURLを友達に共有して遊べる単語当てゲーム。
**答えはサーバー（Cloudflare KV）にだけ保存され、クライアントには一切渡らない**ので、
URL・通信・DevTools のどこを見ても答えの文字列は読めません。

## 仕組み

- 出題者が単語を入力 → サーバーがコリンズ辞書で検証し、KV に不透明な ID で保存
- 共有URL は `https://<site>/?g=<id>` の形式（**単語は含まれない**）
- プレイヤーの推測は毎回サーバーへ送られ、サーバーが色判定して**色だけ**を返す
- 試行回数（6回）は**署名付き JWT** で改ざん不能に管理（KV書き込み不要）
- 総当たり対策として `/api/start`・`/api/guess` に IP ベースのレート制限

### 辞書

- Collins Scrabble Words（SOWPODS）の5文字語を `functions/_shared/words.js` に内蔵
- **サーバー側でのみ**検証に使用し、辞書ファイルはクライアントへ配布しない（再配布なし）
- 出題語・推測語ともにコリンズ辞書の5文字語に限定

## 構成

TypeScript 製。フロントは Vite でビルド、サーバー(Functions)は wrangler がコンパイル。

```
index.html         Vite エントリ
src/               フロント (TS) — main.ts, game.ts, keyboard.ts, api.ts, styles.css
functions/         Pages Functions (TS, = Worker)
  api/ create.ts, start.ts, guess.ts
  _shared/ words.ts, score.ts, jwt.ts, util.ts, types.ts
  tsconfig.json
tsconfig.json      フロント用 TS 設定
vite.config.ts     dist/ へビルド
wrangler.toml      Pages 設定 + KV バインディング + JWT secret
```

ビルド成果物は `dist/`（git 管理外）。`pages_build_output_dir = "dist"`。

## セットアップ & ローカル実行

```bash
npm install

# 1) KV namespace を作成し、出力された id を wrangler.toml の WORDLE_KV.id に貼る
npx wrangler kv namespace create WORDLE_KV

# 2) ローカル起動：Vite(HMR) をフロントに、wrangler が Functions+KV を担当
npm run dev
```

- `npm run dev` … `wrangler pages dev -- vite`（フロントは HMR、API はローカル KV で動作）
- `npm run build` … `vite build` で `dist/` を生成
- `npm run check` … フロント・Functions の型チェック（`tsc --noEmit`）

ブラウザでトップを開く → 単語を入力 → 生成された `?g=<id>` URL を別タブで開いてプレイ。

## デプロイ（Cloudflare Pages）

> ⚠️ `wrangler pages secret put` は **プロジェクトが既に存在している** 必要があります。
> 先に一度デプロイしてプロジェクトを作成してから secret を設定してください
> （いきなり secret を実行すると `Project "..." does not exist` になります）。

`npm run deploy` は `vite build` 後に `wrangler pages deploy` を実行します。

```bash
# 0) KV namespace を作成し、出力された id を wrangler.toml の WORDLE_KV.id に貼る
npx wrangler kv namespace create WORDLE_KV

# 1) まずデプロイ（build込み）→ ここで Pages プロジェクト "wordrop" が作成される
npm run deploy

# 2) 本番用の JWT secret を設定（必須・dev のデフォルト値は使わない）
npx wrangler pages secret put JWT_SECRET

# 3) secret を反映するため再デプロイ
npm run deploy
```

KV のバインド（binding 名 `WORDLE_KV`）は wrangler.toml に記載済みです。

## CI/CD（GitHub Actions）

- **CI** (`.github/workflows/ci.yml`): main 以外への push と PR で型チェック(`npm run check`)＋ビルドを実行
- **CD** (`.github/workflows/deploy.yml`): `main` への push（または手動実行）で型チェック・ビルド後、
  `wrangler pages deploy` で Cloudflare Pages 本番へ自動デプロイ

### 必要な GitHub Secrets

リポジトリの **Settings → Secrets and variables → Actions** に以下を登録してください。

| Secret | 取得方法 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare ダッシュボード → My Profile → API Tokens → Create Token。**"Cloudflare Pages — Edit"** 権限を付与 |
| `CLOUDFLARE_ACCOUNT_ID` | ダッシュボードのアカウント ID（Workers & Pages の概要などに表示） |

> 初回のみ、先に一度 `npm run deploy` をローカル実行して Pages プロジェクト `wordrop` を作成し、
> `JWT_SECRET` secret と KV バインドを設定しておくと確実です（以降は push で自動デプロイ）。
> `JWT_SECRET` はビルド時には不要で、Cloudflare 側に設定済みの値がランタイムで使われます。

## セキュリティ上の注意 / 限界

- **答えを読む**ことは不可能（クライアントに答えが存在しない）
- **総当たり**は JWT の6回制限＋レート制限で実用上困難。ただし共有パズルの性質上、
  新規セッションを取り直しての試行を完全には防げない（友達用途には十分）
- `JWT_SECRET` は本番で必ず独自の値を設定すること
