# Wordrop

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

```
public/            静的フロント（ビルド不要のバニラ JS）
  index.html
  styles.css
  js/ main.js, game.js, keyboard.js, api.js
functions/
  api/ create.js, start.js, guess.js   # Pages Functions（= Worker）
  _shared/ words.js, score.js, jwt.js, util.js
wrangler.toml      # Pages 設定 + KV バインディング + JWT secret
```

## セットアップ & ローカル実行

```bash
npm install

# 1) KV namespace を作成し、出力された id を wrangler.toml の WORDLE_KV.id に貼る
npx wrangler kv namespace create WORDLE_KV

# 2) ローカル起動（Functions + KV をエミュレート）
npx wrangler pages dev public
```

ブラウザでトップを開く → 単語を入力 → 生成された `?g=<id>` URL を別タブで開いてプレイ。

## デプロイ（Cloudflare Pages）

> ⚠️ `wrangler pages secret put` は **プロジェクトが既に存在している** 必要があります。
> 先に一度デプロイしてプロジェクトを作成してから secret を設定してください
> （いきなり secret を実行すると `Project "..." does not exist` になります）。

```bash
# 0) KV namespace を作成し、出力された id を wrangler.toml の WORDLE_KV.id に貼る
npx wrangler kv namespace create WORDLE_KV

# 1) まずデプロイ → ここで Pages プロジェクト "wordrop" が作成される
npx wrangler pages deploy

# 2) 本番用の JWT secret を設定（必須・dev のデフォルト値は使わない）
npx wrangler pages secret put JWT_SECRET

# 3) secret を反映するため再デプロイ
npx wrangler pages deploy
```

KV のバインド（binding 名 `WORDLE_KV`）は wrangler.toml に記載済みです。
Cloudflare ダッシュボードの Git 連携で自動デプロイする場合は、ダッシュボード側でも
同じ binding 名で KV namespace をバインドしてください。

## セキュリティ上の注意 / 限界

- **答えを読む**ことは不可能（クライアントに答えが存在しない）
- **総当たり**は JWT の6回制限＋レート制限で実用上困難。ただし共有パズルの性質上、
  新規セッションを取り直しての試行を完全には防げない（友達用途には十分）
- `JWT_SECRET` は本番で必ず独自の値を設定すること
