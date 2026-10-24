# Fly.io に本番環境を置く

## 目的

本番のデプロイ先が決まっていない。
`20260729-pwa-general-user-only.md` は本番の HTTPS を対象外とし、`20261018-ios-safari-push.md` は HTTPS のオリジンが無いことを実機検証の前提として残した。
毎朝9時の通知が届くこと、iPhone で Push を試せることの2つを満たす本番環境を用意する。

本計画は Fly.io に置く案である。
同じ日に Lightsail に置く案（`20261018-deploy-lightsail.md`）を書いており、どちらを採るかはまだ決めていない。

## 前提

本番に要るものは次のとおりである。

- PHP の Web サーバと PostgreSQL
- 毎朝9時に `app:send-purchase-reminders` を走らせるスケジューラ（`routes/console.php`）
- HTTPS
- パスワードのリセットに使うメールの配信

アップロードされたファイルは無く、セッションとキャッシュは DB に置いている。
アプリのコンテナは中にデータを持たないので、いつ作り直してもよい。

DB も Docker のイメージで動かし、マネージドの DB は使わない。
Fly の Managed Postgres は Basic でも月 $38 で、アプリ本体の数倍になる。

## 構成

```
利用者 ──HTTPS──▶ Fly Proxy ──▶ app（Web、自動停止あり）
                                    │
               scheduler（1台、止めない）── 毎朝9時に通知を送る
                                    │
               app と scheduler ──▶ db アプリ（postgres:18-alpine、ボリューム）
                                    │
               scheduler ──▶ Tigris（バックアップの置き場）
```

リージョンは東京（`nrt`）に置く。

| 要素 | 置き方 | 目安（US の公表価格） |
|---|---|---|
| Web | `app` プロセス。shared-cpu-1x 512MB、自動停止あり | 止まっている間は課金されない。$1〜2 |
| スケジューラ | `scheduler` プロセス。shared-cpu-1x 512MB、常に動かす | $3.69 |
| DB | 別の Fly アプリ。`postgres:18-alpine` を 512MB のマシンと 1GB のボリュームで動かす | $3.69 と $0.15 |
| バックアップ | Tigris（Fly が提供する S3 互換のストレージ） | 数十円 |
| 合計 | | 月 $9 前後 |

IPv4 は共有のアドレスで足りる。
HTTP の受け付けには専用の IPv4 が要らない。

### 自動停止はプロセスを分けて避ける

Fly Proxy は、外からのリクエストが無いマシンを止める。
対象になるのは `http_service` を持つプロセスだけなので、スケジューラを `http_service` を持たない別のプロセスにすれば止まらない。

```toml
[processes]
  app = ""
  scheduler = "php artisan schedule:work"

[http_service]
  internal_port = 8080
  processes = ["app"]
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

[[restart]]
  policy = "always"
  processes = ["scheduler"]

[deploy]
  release_command = "php artisan migrate --force"
```

`[[restart]]` は自動停止とは別の仕組みに対する手当てである。
Fly はプロセスが終了するとマシンを止めるので、`schedule:work` が落ちたときに起こし直させる。

`scheduler` は1台に固定する（`fly scale count scheduler=1`）。
`fly deploy` は可用性のために既定でプロセスごとに2台作ることがあり、2台あると毎朝の通知が2通届く。
念のため `routes/console.php` のスケジュールに `onOneServer()` を付ける。
キャッシュが `database` なので、ロックはそのまま使える。

Web を止めると、通知から開いたときに起動を待たされる。
まずは止める設定で始め、待ち時間が気になれば `min_machines_running = 1` に変える。

### DB は別のアプリにする

DB を `app` と同じアプリのプロセスにすると、`fly deploy` のたびに DB のマシンも入れ替わる。
別の Fly アプリにして、アプリのデプロイから切り離す。
アプリからは Fly の内部ネットワーク（`<db アプリ名>.internal`）で繋ぎ、DB のポートは外に出さない。

ボリュームは1台のホストに結びついており、ホストが壊れると戻せない。
Fly のボリュームの日次スナップショットに加えて、DB の外にダンプを置く。

## 実装するときに触るもの

### 本番用の Dockerfile

Sail のイメージは開発用で、本番には使えない。
FrankenPHP の公式イメージを土台にし、多段ビルドで作る。

1. `composer install --no-dev --optimize-autoloader`
2. フロントエンドのビルド。`@laravel/vite-plugin-wayfinder` はビルド中に `php artisan` を呼んで型を生成する（生成物は `.gitignore` にある）。この段には Node と PHP の両方と、`vendor` が要る
3. 実行用の段に `public/build` と `vendor` を写す

PHP のバージョンは開発の Sail（`runtimes/8.5`）に揃える。
FrankenPHP は TLS を自分で終端できるが、Fly では Fly Proxy が終端するので HTTP の 8080 番で待ち受けさせる。

### アプリの設定

- `bootstrap/app.php` に `trustProxies(at: '*')` を足す。足さないと、Fly Proxy の後ろで URL と Cookie が HTTP 扱いになる
- `request` チャンネルは `storage/logs/request.log` に日ごとに書いている（`config/logging.php:76`）。コンテナを作り直すたびに消えるので、本番は stderr に出せるよう環境変数で切り替えられるようにする。stderr に出したログは `fly logs` で見られる
- `QUEUE_CONNECTION=sync` にして、ワーカーを置かない。通知はスケジューラの中でその場で送る
- `APP_ENV=production`、`APP_DEBUG=false`、`SESSION_SECURE_COOKIE=true`

### 秘密情報

`fly secrets set` で置く。
`APP_KEY`、DB の接続情報、VAPID の鍵、メールの認証情報が対象である。
VAPID の鍵は本番用に作り直し、`VAPID_SUBJECT` には実在する連絡先を入れる（Apple の Push サービスは不正な値を弾くと言われている）。

### メール

Resend などの配信サービスを契約し、SMTP で繋ぐ。
送信元のドメインの認証（SPF、DKIM）が要るので、独自ドメインを持つかどうかとあわせて決める。

### バックアップ

`scheduler` で毎日 `pg_dump` を取り、Tigris に送る。
`pg_dump` は DB と同じメジャーバージョン（18）のクライアントが要るので、イメージに入れる。
復元を最初に一度試し、手順を README に残す。

### 初期データ

`DatabaseSeeder` はデモ用で、管理者のパスワードが `password` になっている（`AdminSeeder`）。
本番ではカテゴリと商品のシーダーだけを流し、管理者は別の手段で作る。
手段は実装するときに決める。

### デプロイ

GitHub Actions から `flyctl deploy` を叩く。
`tests.yml` が通った後に main への push で走らせる。
アクションは既存のワークフローと同じく SHA で固定する。

## 決めること

- **独自ドメインを持つか**。Fly は `<アプリ名>.fly.dev` で HTTPS を出せるので、無くても動く。メールの送信元の認証には独自ドメインが要る
- **メールの配信サービス**
- **管理者の作り方**

## 確かめること

- 東京リージョンの価格。上の金額は US の公表価格で、Fly はリージョンごとに価格が違う。2026年10月1日に料金の改定があったという記事もある
- Web を止めたときに、起動を待つ時間がどのくらいか
- ボリュームのスナップショットの頻度と保持期間
- 一般ユーザーの画面が PWA としてインストールでき、Service Worker が登録されること（開発中は登録しないので、本番で初めて動く）

## 採らなかった案

**Fly の Managed Postgres。** バックアップを任せられるが、月 $38 からで、アプリ本体の数倍になる。

**外の無料 DB（Supabase など）。** 最も安いが、DB も Docker で動かすという前提から外れる。無料枠の休止や容量の制限にも左右される。

**自動停止を切り、Web とスケジューラを1台に入れる。** 設定は最も少ない。ただし Web とスケジューラが同じマシンのプロセス管理に乗り、片方が落ちても気づきにくい。

**コンテナから自分の URL を定期的に叩いて止めさせない。** `fly.toml` の設定で避けられることを、回り道して避けているだけである。

## 決定（2026-10-24）

本計画を採り、Lightsail の案は採らない。

## 実装（2026-10-24）

手元で作れる部分を先に実装した。

- `Dockerfile`。FrankenPHP の上に3段で組んだ。Node は `node:24-trixie-slim` から実行ファイルを写して、PHP の段で動かす
- 設定のキャッシュ（`php artisan optimize`）は起動時に作る（`docker/entrypoint.sh`）。ビルド時に作ると、secrets がイメージに焼き込まれるか、空のまま固まる
- `request` チャンネルは `stack` にし、束ねる先を `LOG_REQUEST_STACK` で選ぶ。既定は従来の日ごとのファイル（`request_daily`）
- `fly.toml`。アプリ名は `stock-reminder` とする
- DB の接続先は `[env]` に書かず、secrets で置く

ローカルでイメージを作り、Sail の Postgres につないで、ページと静的ファイルの配信、`X-Forwarded-*` の反映、Cookie の `Secure` 属性、ログの stderr への出力を確かめた。

残りは、DB のアプリ、secrets、バックアップ（`pg_dump` のクライアントはまだイメージに入れていない）、初期データ、GitHub Actions である。

## 本番の作成（2026-10-24）

- アプリは `stock-reminder` と `stock-reminder-db`（`deploy/db/fly.toml`）。どちらも `fly apps create` で作った。`fly launch` は Managed Postgres の作成を勧めるので使わない
- DB のボリュームは 1GB で、日次スナップショットを5日保持する。公開 IP は割り当てていない
- DB のパスワード、`APP_KEY`、VAPID の鍵は生成してそのまま secrets に置いた。手元には残していない
- メールの配信サービスが決まるまで、`MAIL_MAILER` は未設定（`log`）で、`VAPID_SUBJECT` はアプリの URL にしている
- 止まっている Web を起こしたときの最初の応答は約2秒だった

## 管理者の作り方（2026-10-24）

`php artisan app:create-admin` を足し、本番では `fly ssh console` から実行する。
パスワードを入力を伏せたプロンプトで受け取るので、シェルの履歴にも secrets にも残らない。
tinker で手で作る案は手順が記録に残りにくく、`AdminSeeder` で環境変数から読む案は一度しか使わない値が secrets に残り続けるので採らなかった。

## バックアップ（2026-10-24）

`app:backup-database` を毎朝4時に流し、Tigris のバケット `stock-reminder-db-backup` に送る。保持は30日とした。
復元は `app:restore-database` で行う。本番とは別のデータベースへ戻し、各テーブルの件数が本番と一致することを確かめた。

`fly storage create` が置いた secrets は、`fly secrets list` で Deployed と出るのにマシンへ届かなかった。
`fly secrets deploy` でも直らず、作成時の出力からキーを読んで `fly secrets set` で置き直した。
キーを伏せて捨てていたため、最初のバケットは消して作り直した。消した直後の名前は再び使えないので、名前を変えている。

## GitHub Actions からのデプロイ（2026-10-24）

`deploy.yml` を足した。`workflow_run` で `tests` の完了を待ち、成功したときだけ `flyctl deploy --remote-only` を実行する。
`lint` の完了は待たない。計画どおり `tests` だけを条件にした。
`superfly/flyctl-actions/setup-flyctl` は 1.6 の SHA で固定した。1.5 は Node 20 で動くので採らなかった。

トークンは `fly tokens create deploy` で作るアプリ単位のもので、有効期限は1年とした（既定は20年）。
2027年10月ごろに作り直して `FLY_API_TOKEN` を差し替える。

## 独自ドメインとメール（2026-10-25）

「決めること」の残り2つを決めた。

- **独自ドメインを持つ。** `deployshelf.dev` を Cloudflare Registrar で取り、アプリは `stock.deployshelf.dev` に置く。今後の個人開発も同じドメインのサブドメインに並べる。名前に個人情報を入れないことを条件にした
- **メールの配信は Resend。** Laravel からは SMTP で送り、パッケージは足さない。送信元は `noreply@deployshelf.dev`
- 受信は Cloudflare Email Routing で、`contact@deployshelf.dev` を個人の Gmail に転送する。`VAPID_SUBJECT` はこのアドレスにした

Gmail の SMTP は、専用のアカウントを作るか個人のアドレスを利用者に見せることになるので採らなかった。

DNS は Cloudflare に置き、`stock` の A と AAAA はプロキシを切っている。プロキシを通すと Fly が証明書を発行できず、アプリから見える接続元の IP も Cloudflare のものになる。

## 復元の手順の置き場所（2026-10-25）

「バックアップ」の節では復元の手順を README に残すとしたが、README はポートフォリオの入口なので、設計書（`doc/design/non-functional.md` のバックアップ）に移した。
