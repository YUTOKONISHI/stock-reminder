# Cloudflare のプロキシを通す

## 何をするか

Cloudflare の DNS で、`stock` のレコードの雲のアイコンを灰色からオレンジ色に変える。
これで、利用者のアクセスはいったん Cloudflare を通ってから Fly.io に届くようになる。
目的は、CDN の後ろでアプリを動かすと何が変わるかを学ぶことである。

ただ、いきなりオレンジ色にすると3つのものが壊れる。
先にそれを直してから切り替える。

## 作業の一覧

| 順番 | 誰が | どこで | 何をする |
|---|---|---|---|
| 1 | Claude | コード | IP アドレスの取り方を直す PR を作る |
| 2 | 開発者 | GitHub | PR をマージする（自動でデプロイされる） |
| 3 | 開発者 | ターミナル | 直ったことを確かめる |
| 4 | 開発者 | ターミナルと Cloudflare | 証明書の DNS レコードを足す |
| 5 | 開発者 | Cloudflare | 設定を4つ変える |
| 6 | 開発者 | Cloudflare | オレンジ色にする |
| 7 | 開発者 | ブラウザとターミナル | 動くことを確かめる |

開発者の作業は、ほとんどが Cloudflare のダッシュボードでのクリックである。
画面の場所が下の説明と違っていたら、ダッシュボード上部の検索窓に設定の名前を入れれば出てくる。

## 1から3: IP アドレスの取り方を直す

**直す理由。**
アプリは利用者の IP アドレスを、ブラウザが送ってくるヘッダから読んでいる。
このヘッダは送り手が好きな値を書けるので、今でも IP アドレスを偽れる（2026-11-08 に本番で確かめた）。
ログインの回数制限は IP アドレスごとに数えているので、偽れると制限をすり抜けられる。
オレンジ色にすると、このヘッダに Cloudflare の IP アドレスも混ざる。

**Claude がすること。**
Fly.io と Cloudflare が付ける、送り手には書き換えられないヘッダ（`Fly-Client-IP` と `CF-Connecting-IP`）から読むように変える。
`CF-Connecting-IP` は、リクエストが本当に Cloudflare から来たときだけ使う。
ミドルウェアを1つ足し、`bootstrap/app.php` の `trustProxies` の設定を変える。テストも足す。

実装の途中で、`X-Forwarded-Host` ヘッダも同じように偽れることが分かった。
偽ると、本番の画面の HTML とヘッダに出る URL が、偽のドメインになる（2026-11-08 に確かめた）。
確認メールのリンクも同じ仕組みで作るので、他人のアドレスに偽のドメインへのリンクを送らせることができる。
原因は同じ `trustProxies` の設定なので、同じ PR で `X-Forwarded-Host` も読まないようにした。

**開発者がすること。**
PR をマージしたら、デプロイが終わるのを待って、ターミナルで次を実行する。

```
curl -s -o /dev/null -H "X-Forwarded-For: 203.0.113.77" -H "Fly-Client-IP: 203.0.113.88" https://stock.deployshelf.dev/
fly logs -a stock-reminder --no-tail | grep '"path":"/"' | tail -1
```

ログの `"ip"` が `203.0.113.77` でも `203.0.113.88` でもなく、自分の IP アドレスなら直っている。

## 4: 証明書の DNS レコードを足す

**理由。**
Fly.io は90日ごとに証明書（HTTPS の鍵マークのもと）を更新する。
今の更新方法は、オレンジ色にすると失敗することがある。
DNS レコードを1つ足すと、オレンジ色でも更新できる方法に切り替わる。

**すること。**

1. ターミナルで `fly certs setup stock.deployshelf.dev -a stock-reminder` を実行する
2. 出力に `_acme-challenge.stock` と、その向き先の値が表示される
3. Cloudflare → `deployshelf.dev` → DNS → Records → Add record で、次のレコードを足す
   - Type: `CNAME`
   - Name: `_acme-challenge.stock`
   - Target: 2で表示された値
   - Proxy status: 灰色（DNS only）
4. 出力に `_fly-ownership` の TXT レコードも出ていたら、同じように足す
5. ターミナルで `fly certs check stock.deployshelf.dev -a stock-reminder` を実行し、エラーが出ないことを確かめる

## 5: Cloudflare の設定を4つ変える

**暗号化モードを Full (strict) にする。**
SSL/TLS → Overview → Configure で、Full (strict) を選ぶ。
Cloudflare から Fly.io までの区間も HTTPS にする設定である。
ほかのモードでは、ページが開かなくなったり、途中の区間が暗号化されなかったりする。

**次の3つをオフにする。**
どれも Cloudflare が通り道でページの中身を書き換える機能で、アプリの画面を壊すおそれがある。

- Email Address Obfuscation（Scrape Shield の中）
- Rocket Loader（Speed → Optimization の中）
- Web Analytics の自動設定（Analytics & Logs → Web Analytics。サイトが一覧に無ければ何もしなくてよい）

## 6: オレンジ色にする

DNS → Records で、`stock` の A と AAAA のレコードを編集し、Proxy status をオレンジ色（Proxied）にして保存する。

## 7: 動くことを確かめる

- ブラウザで `https://stock.deployshelf.dev/` を開き、ログインできる
- 開発者ツールの Network タブで、レスポンスヘッダに `server: cloudflare` がある
- 新規登録画面に Turnstile の枠が出る
- 3と同じコマンドで、ログの `"ip"` が自分の IP アドレスになっている

おかしければ、6のレコードを灰色に戻す。
それだけで今の形に戻る。

## 終わった後に決めること

オレンジ色にしても、`stock-reminder.fly.dev` を使えば Cloudflare を通らずに Fly.io へ直接つなげる。
アプリ側の守り（回数制限や Turnstile）はそのまま効くので、今すぐ困ることはない。
困るのは、後で Cloudflare に足すルール（WAF など）を迂回されることである。
塞ぐかどうかは、WAF を試すときに決める。

## 後で試すこと

WAF のルールで `/admin` へのアクセスを日本からだけに絞る、Cloudflare Access で `/admin` の手前にもう1段のログインを置く、などを無料で試せる。
試したら、この計画書に追記する。

## 文書

`README.md` のインフラ構成の図と、`doc/design/non-functional.md` の IP アドレスの記述を、作業に合わせて直す。

## 追記: 手順1から5の結果（2026-11-08）

### 手順1から3

PR #73 をデプロイした後、本番に偽の `X-Forwarded-For`、`Fly-Client-IP`、`X-Forwarded-Host` を付けて送った。
リクエストログの `ip` は送り手の本当の IP アドレスになり、レスポンスに偽のホスト名は出なかった。
`Fly-Client-IP` は Fly Proxy が上書きするので、送り手には偽れないことも分かった。

### 手順4

`fly certs setup` の出力に従い、次の2つのレコードを足した。

- `_acme-challenge.stock` の CNAME（`stock.deployshelf.dev.3pow5gg.flydns.net` に向ける。プロキシは切る）
- `_fly-ownership.stock` の TXT（値は `app-3pow5gg`）

TXT は、出力に「CDN やプロキシを通すときは必要」と書かれていたので足した。
`fly certs check` は通った。
DNS-01 で実際に更新できるかは、次の自動更新まで分からない。

### 手順5の画面の場所の訂正

手順5に書いた画面の場所は、確かめずに書いたもので、今のダッシュボードとは違っていた。
Cloudflare のドキュメントで確かめた場所は次のとおりである。

- Email Address Obfuscation：Security → Settings。絞り込みの Client-side abuse の中にある
- Rocket Loader：Speed → Settings → Content Optimization

ダッシュボードを日本語表示にしていると、Rocket Loader は検索でも見つからず、「スピード」に当たるメニューも無かった。
そこで、Rocket Loader と Web Analytics の自動設定は、画面で探すのをやめた。
オレンジ色にした後で本番の HTML を取得し、Cloudflare が差し込んだスクリプトが無いかで判定する。
Rocket Loader が動いていれば `<script>` の `type` が書き換えられ、Web Analytics が動いていれば `cloudflareinsights` の読み込みが現れる。

Full (strict) と Email Address Obfuscation のオフは、設定を済ませた。
