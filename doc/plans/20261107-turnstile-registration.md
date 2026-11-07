# 新規登録にボット対策を入れる

## 目的

新規登録には、送り手が人かボットかを確かめる仕組みが無い。
登録すると確認メールが送られるので、ボットに大量登録されると次の2つが起こる。

- 他人のアドレスに、頼んでもいない確認メールが大量に届く
- Resend の送信枠（無料プランでは1日100通）を使い切り、本物の利用者に確認メールや朝の通知が届かなくなる

確認が済まないアカウントは7日で消える（`20261104-prune-unverified-users.md`）が、メールはその前に送られてしまう。

Cloudflare の Turnstile を登録画面に入れ、人が操作したと確かめられた登録だけを受け付ける。
Turnstile は CAPTCHA の代わりになる仕組みで、多くの場合は利用者に何もさせずに判定が終わる。
Cloudflare Security Insights で「Turnstile が有効になっていません」と出たのがきっかけで、ウィジェット（Cloudflare 側の設定の単位）は作成済みである。

## 決めたこと

- Turnstile を掛けるのは新規登録だけにする。ログインとパスワード忘却には回数制限があり、確認メールのように第三者へメールが飛ぶこともない
- Cloudflare の確認サーバに問い合わせられないときは、登録を断る。ボット対策が黙って外れるより、登録を少し待ってもらう方を選ぶ
- 画面に出す部品は自前で書く。ライブラリは足さない。やることがスクリプトの読み込みと1回の描画だけで、数十行で済むため
- Cloudflare の自動導入（Turnstile Spin）は使わない。リポジトリへの権限を Cloudflare に渡すことになり、計画書と PR を通す今の進め方の外で変更が入るため

## 仕組み

Turnstile は、画面側とサーバ側の2か所で動く。

画面側では、Cloudflare のスクリプトが登録フォームに小さな枠を描き、裏でブラウザを調べる。
人のブラウザだと判定できると、トークン（判定結果を表す使い捨ての文字列）が手に入る。
フォームはこのトークンを、名前やメールアドレスと一緒にサーバへ送る。

サーバ側では、受け取ったトークンをシークレットキーと一緒に Cloudflare の siteverify という確認用の URL へ送る。
Cloudflare が「本物で、まだ使われていない」と返したときだけ、登録を進める。
トークンは1回しか通らず、発行から5分で切れる。

画面側だけでは守れない。
ボットは画面を通さず、登録の URL へ直接 POST できるからである。
サーバ側でトークンを確かめて初めて、画面を通らない送信を断れる。

キーは2つある。

- サイトキー: 画面に埋め込む公開用のキー。HTML に出るので秘密ではない。本番は `0x4AAAAAAF3lQ4WY92qvF1yZ`
- シークレットキー: siteverify に送る秘密のキー。`fly secrets set` で本番に入れ、リポジトリには置かない

ローカルとテストには、Cloudflare が配っているテスト用のキーを使う。
サイトキー `1x00000000000000000000AA` とシークレットキー `1x0000000000000000000000000000000AA` の組は、どのブラウザでも必ず合格になる。
これで、本番のキーを手元に置かずに登録画面を動かせる。

## 変えること

### 設定

`config/services.php` に `turnstile` を足し、`site_key` と `secret_key` を環境変数 `TURNSTILE_SITE_KEY` と `TURNSTILE_SECRET_KEY` から読む。
`.env.example` には、上のテスト用のキーを書いておく。
`fly.toml` の `[env]` には、本番のサイトキーを書く。
シークレットキーは `fly secrets set TURNSTILE_SECRET_KEY=...` で入れる。

### サーバ側の確認

トークンを確かめる検証ルールを `app/Rules/Turnstile.php` に作る。
中では siteverify に、シークレットキー、トークン、送り手の IP を POST し、返ってきた `success` が真かどうかを見る。
問い合わせが失敗したとき（タイムアウトや 5xx）も不合格として扱う。
待ち時間は5秒で区切り、Cloudflare が遅いときに登録の処理が止まり続けないようにする。

`CreateNewUser` の検証に、`'cf-turnstile-response' => ['required', 'string', new Turnstile]` を足す。
`cf-turnstile-response` は、Turnstile が既定で使う項目名である。
不合格のときは「確認に失敗しました。もう一度お試しください」を返す。

ほかの検証より後に置く。
入力の誤り（パスワードが短いなど）で断る登録に、siteverify への問い合わせを使わないためである。
ただしトークンは1回しか通らないので、入力の誤りで差し戻した後は、画面で新しいトークンを取り直す必要がある（下の「画面」で扱う）。

### 画面

`Fortify::registerView` から、サイトキーを `turnstileSiteKey` として登録画面に渡す。
ビルド時の環境変数（`VITE_...`）にしないのは、キーを変えたときにビルドし直さずに済ませるためである。

`resources/js/shared/components/Turnstile.tsx` に、枠を描く部品を作る。
部品は次のことをする。

- `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` を一度だけ読み込む
- 読み込みが済んだら `turnstile.render()` で枠を描き、トークンが手に入ったら親に渡す
- 画面を離れるときに `turnstile.remove()` で片付ける
- 親から作り直しを頼まれたら `turnstile.reset()` で新しいトークンを取り直す

`register.tsx` は、フォームの値に `cf-turnstile-response` を足し、送信ボタンの上に部品を置く。
トークンが手に入るまでは送信ボタンを押せないようにする。
サーバから差し戻されたら、理由が何であれ部品に作り直しを頼む。
トークンは1回しか通らないので、作り直さないと次の送信が必ず不合格になる。

### セキュリティヘッダ

`SetSecurityHeaders` の CSP（ブラウザが読み込んでよい先の一覧）は、今は自分のサイトしか許していない。
このままでは Turnstile のスクリプトが読み込めず、枠も描けない。
次の2つを足す。

- `script-src` に `https://challenges.cloudflare.com`
- `frame-src` に `https://challenges.cloudflare.com`（枠は iframe で描かれる。`frame-src` が無いと `default-src 'self'` が当てはまり、止められる）

全画面のヘッダに足すことになるが、スクリプトを読み込むのは登録画面だけなので、ほかの画面の動きは変わらない。

### テスト

`RegistrationTest` では、`Http::fake()` で siteverify の応答を差し替える。
今ある登録のテストは、合格の応答を返す設定で、トークンを付けて送るように直す。
足すテストは次のとおり。

- トークンが無ければ登録されない
- siteverify が不合格を返したら登録されず、ユーザーも確認メールも増えない
- siteverify に届かないときも登録されない
- 入力に誤りがあるときは siteverify に問い合わせない

`SecurityHeadersTest` には、CSP に `challenges.cloudflare.com` が入っていることを足す。

### 文書

`AGENTS.md` の新規登録に、ボット対策を入れたことを1行足す。
`doc/design/auth.md` と `doc/design/non-functional.md`（CSP）を、実装に合わせて書き直す。

## 本番への反映

1. Cloudflare の Turnstile の設定で、ウィジェットのホスト名に `stock.deployshelf.dev` が入っていることを確かめる。入っていないと、本番の画面で枠が描けない
2. `fly secrets set TURNSTILE_SECRET_KEY=...` を実行する（これだけでマシンが再起動する）
3. PR をマージしてデプロイする
4. 本番の登録画面で枠が出ること、捨てアドレスで登録できることを確かめ、そのアカウントを消す

2 を 3 より先にするのは、シークレットキーが無いまま新しいコードが動くと、すべての登録が不合格になるためである。

## 追記: Cloudflare の導入手順と突き合わせた結果

Turnstile Spin の手順書（`https://developers.cloudflare.com/turnstile/spin/prompt.md`）と照らし合わせ、次の2点を足す。

### 応答のホスト名と action も確かめる

siteverify は `success` のほかに、トークンを取ったページのホスト名（`hostname`）と、画面側で付けた名前（`action`）も返す。
`success` だけを見ていると、同じサイトキーを使う別のページで取ったトークンでも通ってしまう。

画面側の部品は、`turnstile.render()` に `action: 'register'` を渡す。
サーバ側の検証ルールは、`success` が真で、`action` が `register` で、`hostname` が `APP_URL` のホスト名と一致するときだけ合格にする。
`APP_URL` から取るので、本番では `stock.deployshelf.dev`、ローカルでは `localhost` になり、本番の許可先に `localhost` が混ざることはない。

テスト用のキーでは、ダミーのトークンが返り、`hostname` が実際のページのホスト名にならないことがある（実装のときに、実際の応答で確かめる）。
その場合は、ローカルでも登録できるよう、`hostname` と `action` の照合をテスト用のシークレットキーのときだけ外す。
テストは `Http::fake()` で応答を作るので、照合を外さずに確かめる。

テストには次の2つを足す。

- `action` が `register` でなければ登録されない
- `hostname` が違えば登録されない

### 本番での確認に、トークンの使い回しを足す

「本番への反映」の4で、登録の POST を開発者ツールでコピーし、同じトークンでもう一度送って断られることも確かめる。

### シークレットキーの取り出しは手で行う

手順書は、シークレットキーを Wrangler で取り出して保存先へ書き込む流れになっている。
この開発環境のホストには node が無く、Wrangler を入れて認証する手間に見合わない。
手順書も、保存先が用意できないときは利用者が普段のやり方で入れてよいとしている。
シークレットキーは Cloudflare のダッシュボードからコピーし、開発者が `fly secrets set` で入れる。チャットには貼らない。

## 追記: 実装で分かったこと

- ウィジェットのホスト名に `stock.deployshelf.dev` が入っていなかったので、ウィジェットを作り直した。本番のサイトキーは `0x4AAAAAAF3lgU0D5y-jCdE3` に変わった
- テスト用のシークレットキーで siteverify を呼ぶと、`hostname` は `example.com` で、`action` は返らなかった。そのため、テスト用のシークレットキーのときは `action` と `hostname` を照合しない
- 差し戻し後のトークンの取り直しは、`turnstile.reset()` ではなく、部品の `key` を変えて作り直す形にした。送信処理から ref を触ると、React の lint（`react-hooks/refs`）に咎められるため
- テストの `Http::fake()` は先に登録した応答を優先するので、`beforeEach` で登録した closure が返す応答を、テストごとに差し替える形にした
