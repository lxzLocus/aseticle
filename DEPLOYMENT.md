# ASEticle — デプロイ・構成ガイド

論文検索(arXiv中心)＋引用ランキング＋LLM翻訳のフルスタックアプリです。構成が
少し多いので、**「何を・どこで動かすか」**を最初に整理します。

## 全体像:どのサービスをどこで動かすか

```
┌─ 自前マシン (docker compose) ───────────────────────┐     ┌─ Vercel (公開・HTTPS自動) ─┐
│                                                     │     │                             │
│   frontend ──/api rewrite──▶ backend ──▶ MySQL      │     │    relay(中間拠点/公開)     │
│   (Next.js)                  (FastAPI)   (users)     │     │    Dockerfile.vercel        │
│                                  │                   │     └──────────────▲──────────────┘
│                                  │ proxy (tinyproxy) │                    │ agent→relay
│                                  │                   │                    │ (外向きのみ)
└──────────────────────────────────┼──────────────────┘     ┌─ 学内NW 等 ──┴──────────────┐
                                    │ backend→relay          │      agent daemon           │
                                    └────────────────────────┤   (Dockerfile / python)     │
                                       (公開URL/Tailscale)    └─────────────────────────────┘
```

| サービス | 技術 | 動かす場所 | 役割 |
|---|---|---|---|
| **frontend** | Next.js 14 | 自前マシン(compose) | UI。`/api/*` を backend にリライトproxy |
| **backend** | FastAPI | 自前マシン(compose) | API・認証(JWT/CSRF)・検索・翻訳中継 |
| **db** | MySQL 8 | 自前マシン(compose) | ユーザー永続化 |
| **proxy** | tinyproxy | 任意(学内等) | `proxy`モードの外向きフォワードプロキシ |
| **relay** | FastAPI | **Vercel**(または任意の公開ホスト) | `relay`モードの公開ランデブー拠点 |
| **agent** | Python(httpx) | 学内NW等の制約下 | phone-home取得デーモン。relayへ外向き接続 |

**要点**: frontend/backend/db/proxy は自前マシンで compose 起動。**relay だけ**
公開が必要なので Vercel に置きます。agent は学内ネットワーク内で動かし、外向きに
relay へ繋ぎに行きます(インバウンド開放不要)。

---

## 1. ローカル(docker compose)で起動

```bash
cp .env.example .env      # JWT_SECRET / ENCRYPTION_KEY を本番では再生成推奨
docker compose up --build
```

- frontend: http://localhost:49513
- backend docs: http://localhost:8080/docs
- 停止: `docker compose down` / 初期化: `docker compose down -v`

これで `frontend / backend / db / proxy` の4サービスが起動します
(`relay` と `agent` は後述の `--profile relay` で任意起動)。

---

## 1b. 本番: GHCR のイメージを pull して起動(ビルドなし)

サーバー上では **ソースをビルドせず、CI が GHCR に push したイメージを pull** して
起動できます。専用の [`docker-compose.prod.yml`](docker-compose.prod.yml) を使います。

- CI(`.github/workflows/ci.yml`)が `main` push 時に
  `ghcr.io/lxzlocus/aseticle-{backend,frontend,proxy,agent}:latest`(と `:sha`)を publish。
- relay は [`vercel-relay-image.yml`](.github/workflows/vercel-relay-image.yml) が
  `ghcr.io/lxzlocus/aseticle-relay` を publish。
- 本番 compose は **frontend のポートだけ**をホストに公開し、`backend`/`db`/`proxy`
  は内部ネットワーク限定(ブラウザは frontend 経由の `/api` だけを見る)。

```bash
# サーバー上(例: /opt/docker/aseticle)
cp .env.prod.example .env          # MYSQL_PASSWORD / JWT_SECRET / ENCRYPTION_KEY を必ず設定
#   JWT_SECRET:     openssl rand -hex 32
#   ENCRYPTION_KEY: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# GHCR パッケージが private の場合のみログイン(read:packages 権限の PAT):
#   echo <PAT> | docker login ghcr.io -u lxzLocus --password-stdin
# （または GitHub の Packages 設定で各イメージを public にする）

docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

- 公開ポート: `FRONTEND_PORT`(既定 49513)。ホストの空きポートに合わせて変更可
  (例: `FRONTEND_PORT=8090`)。既存サービスと衝突しない値にしてください。
- TLS はサーバー側の**リバースプロキシで終端**し、frontend ポートへ流します。
  HTTPS 配信時は `.env` で **`COOKIE_SECURE=true`** と
  `CORS_ORIGINS=https://<あなたのドメイン>` を設定。
- 更新は `docker compose -f docker-compose.prod.yml pull && ... up -d`。
  特定ビルドに固定するなら `.env` の `TAG` を commit SHA に。

> `backend` / `db` はホストにポートを公開しません(安全・ポート衝突回避)。デバッグで
> 必要なときだけ compose に `ports:` を足してください。

---

## 2. 論文取得の3モード(`PAPER_FETCH_MODE`)

backend が外部サイトへどう出ていくかを env で切替えます。

| モード | 使う場面 | 設定 |
|---|---|---|
| `direct` | 制約なし | `PAPER_FETCH_MODE=direct` |
| `proxy` | 学内マシンに届く(Tailscale等) | `PAPER_FETCH_MODE=proxy` + `OUTBOUND_PROXY_URL=http://<host>:8888` |
| `relay` | **内向き不可・ポート開放不可** | `PAPER_FETCH_MODE=relay` + `RELAY_URL=https://<relay>` + トークン |
| `auto`(既定) | 自動判定 | RELAY_URL があれば relay、次に proxy、無ければ direct |

`relay` モードのローカル検証:

```bash
# .env で PAPER_FETCH_MODE=relay, RELAY_URL=http://relay:8080 を設定
docker compose --profile relay up -d --build
```

---

## 3. Vercel に relay をデプロイ

Vercel の **Dockerfile(コンテナ)サポート**で、[`Dockerfile.vercel`](Dockerfile.vercel)
をそのまま HTTP サーバーとして動かします。

- `Dockerfile.vercel` は **relay を単一イメージ**でビルドし、`$PORT`(Vercelが自動注入、
  既定80)でリッスンします。
- **リポジトリ直下に置く**と Vercel が自動検出し、全リクエストをこのコンテナへ流す
  rewrite を自動追加します。
- ⚠️ **単一サービスでは `vercel.json` を置かない**こと。`rewrites` を書かずに
  `services` だけ書くと、どのパスもコンテナに届かず **404 NOT_FOUND** になります。

### 手順

1. **Vercel プロジェクト作成 & リンク**:
   ```bash
   npm i -g vercel
   vercel login
   vercel link
   ```
2. **環境変数を設定**(Vercel ダッシュボード → Settings → Environment Variables、
   または `vercel env add`):

   | 変数 | 値 |
   |---|---|
   | `RELAY_CLIENT_TOKEN` | 長いランダム文字列(`openssl rand -hex 32`)。backend と共有 |
   | `RELAY_AGENT_TOKEN`  | 別の長いランダム文字列。agent と共有 |
   | `RELAY_CLIENT_WAIT_SECONDS` | 任意。既定35。**Vercelの関数タイムアウト以下**に |
   | `RELAY_AGENT_POLL_SECONDS`  | 任意。既定25。同上 |

   `PORT` は Vercel が自動注入するので設定不要です。トークン未設定だと relay は
   起動時に 503 を返して**開放状態にはなりません**(安全側の設計)。

3. **デプロイ**:
   ```bash
   vercel deploy --prod
   ```
   ビルド時にイメージが Vercel Container Registry に push され、`https://…vercel.app`
   が発行されます。

### デプロイ後:自前マシン側の設定

`.env`(backend):
```bash
PAPER_FETCH_MODE=relay
RELAY_URL=https://<your-relay>.vercel.app
RELAY_CLIENT_TOKEN=<上と同じ client token>
RELAY_FALLBACK_DIRECT=false     # relay不通時に直結へ退避するなら true
```

agent(学内マシン。`agent/` を単体 docker で起動):
```bash
docker build -t aseticle-agent ./agent
docker run -d --restart unless-stopped \
  -e RELAY_URL=https://<your-relay>.vercel.app \
  -e RELAY_AGENT_TOKEN=<上と同じ agent token> \
  aseticle-agent
```

### ⚠️ Vercel で relay を動かす際の注意

relay は **インメモリのジョブキュー + 長ポーリング**です。以下に注意:

- **関数タイムアウト**: 長ポーリング秒数(`RELAY_*_SECONDS`)を Vercel プランの
  最大実行時間より短くしてください(Hobby は短めなので 10〜20 秒程度推奨)。
- **単一インスタンス前提**: 複数インスタンスにスケールするとインメモリ状態が共有
  されず破綻します。低トラフィックの個人利用なら通常1インスタンスで問題ありません。
  高信頼・多重化したい場合は、キューを **Redis / Upstash / Vercel KV** に置き換えて
  ください(HTTP契約は同じなので relay 内の保存層だけ差し替え)。
- 別ホスト(Render/Fly/VPS)や **Tailscale メッシュ**でも同じイメージで動きます。
  その場合は relay を常駐コンテナとして動かせるので上記の制約は緩みます。

---

## 4. CI/CD(GitHub Actions)

| ワークフロー | 役割 |
|---|---|
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | モノレポ全体。6イメージのビルド → `docker compose` スモークテスト(認証/CSRF/arXiv検索/relay含む) → GHCR へ backend/frontend を publish |
| [`.github/workflows/vercel-relay-image.yml`](.github/workflows/vercel-relay-image.yml) | **Vercel用 relay イメージ**(`Dockerfile.vercel`)を CI/CD。`main`/`v*`タグで `ghcr.io/<owner>/<repo>-relay` に publish。PR はビルド検証のみ |

- タグ付け: ブランチ名 / semver(`v1.2.3`)/ commit SHA / `latest`(デフォルトブランチ)。
- 追加シークレット不要(`GITHUB_TOKEN` を使用)。GHCR パッケージの public/private は
  GitHub のパッケージ設定で調整してください。
- **Vercel 自身**も `Dockerfile.vercel` をデプロイ時にビルドします。GHCR のイメージは
  他ホストから pull する用途・ビルド検証用です(Vercel とは独立)。

---

## 5. セキュリティ

- **JWT**: access/refresh を httpOnly Cookie に。401 で自動リフレッシュ。
- **CSRF**: ダブルサブミット。非httpOnlyの `csrf_token` Cookie と `X-CSRF-Token`
  ヘッダの一致を状態変更リクエストで検証。
- **relay のトークン**: `RELAY_CLIENT_TOKEN`(backend↔relay)/ `RELAY_AGENT_TOKEN`
  (agent↔relay)の2種 Bearer。全エンドポイントで未認証は拒否。開放されません。
- **BYO APIキー**: MySQL に Fernet 暗号化保存。パスワードは bcrypt。
- 本番は `COOKIE_SECURE=true`(HTTPS)、`JWT_SECRET`/`ENCRYPTION_KEY` を再生成、
  `CORS_ORIGINS` を絞り込み。

---

## ディレクトリ

```
.
├── docker-compose.yml          # frontend / backend / db / proxy (+ profile: relay, agent)
├── Dockerfile.vercel           # ★ Vercel 用: relay を単一イメージ・$PORT でリッスン
├── .vercelignore               # Vercel には relay 関連だけアップロード
├── .env.example
├── .github/workflows/
│   ├── ci.yml                  # モノレポCI(全ビルド+compose smoke+GHCR publish)
│   └── vercel-relay-image.yml  # ★ Vercel用 relay イメージの CI/CD
├── frontend/                   # Next.js 14 (UI)
├── backend/                    # FastAPI (API・認証・検索・翻訳)
│   └── app/core/http.py        # direct/proxy/relay の取得モード切替
├── proxy/                      # tinyproxy (proxyモードのフォワードプロキシ)
├── relay/                      # ★ FastAPI 中間拠点(Vercelに載せる本体)
│   └── app/main.py             # トークン認証・long-pollジョブキュー
├── agent/                      # phone-home 取得デーモン(学内NWで起動)
│   └── agent.py
├── README.md
└── DEPLOYMENT.md               # このファイル
```
