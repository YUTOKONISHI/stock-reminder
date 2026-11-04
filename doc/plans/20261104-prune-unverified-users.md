# 確認が済まないアカウントを自動で削除する

## 目的

Issue #61 に対応する。

`20261103-email-verification.md` では、メールアドレスの確認が済まないアカウントを消さないことにした。
そのため、打ち間違えたアドレスや他人のアドレスで作られたアカウントが、未確認のまま残り続ける。
アドレスの本当の持ち主は、そのアドレスがすでに使われているので登録できない。
パスワード忘却から再設定すれば取り戻せるが、その手順に気づいてもらう必要がある。

登録から一定の日数がたっても確認が済まないアカウントは、毎日の定時処理で消す。

## 決めたこと

- 登録から7日で消す。日数は `User::LIMIT_DAY` に置く
- 消すことは確認メールで伝える。確認待ちの画面には出さない
- 確認メールには「登録から7日以内」と書く。確認メールは再送できるので、「このメールから7日」と読まれないようにする
- リンクの有効期限（60分）の行に、期限が切れたらログインして再送すればよいことを書き添える。60分と7日が並んで、60分を過ぎたらもう駄目だと読まれないようにする
- 毎日3時（`Asia/Tokyo`）に消す。9時の購入通知、4時のバックアップと重ならない時刻にした

## 仕組み

Laravel にはモデルの刈り込み（`Prunable` トレイト）がある。
モデルに「消してよい行の条件」を書いておくと、`model:prune` コマンドがその条件に合う行を探して1件ずつ消す。

`User` には次の3つを書く。

- `prunable()`：消してよい行の条件を返す。`email_verified_at` が空で、`created_at` が7日より前のもの
- `pruning()`：1件を消す直前に呼ばれる。外部キーでつながっていない `push_subscriptions`、`password_reset_tokens`、`sessions` の行を消す
- `prune()`：`pruning()` と行の削除をトランザクションで包む

`pruning()` は消す対象のモデル自身のメソッドとして呼ばれるので、`$this` が消す対象のユーザーになる。
引数で受け取る必要は無い。

ストックと通知履歴は外部キーの CASCADE で消える。
未確認の利用者はそもそも作れないが（`verified` ミドルウェア）、作れたとしても消える。

### アカウントの削除と処理を共通にする

利用者が自分でアカウントを消す処理（`ProfileController::destroy`）も、同じ3つのテーブルを消してからユーザーを消していた。
同じ手順が2か所にあると、消すテーブルが増えたときに片方だけ直す漏れが起きる。
destroy からも `$user->prune()` を呼び、手順を `User` の1か所にまとめる。

### トランザクションで包むときの注意

トレイトと同じ名前のメソッドをクラスに書くと、トレイトのメソッドは取り込まれずに置き換わる。
また、`parent::prune()` が指すのはトレイトではなく親クラス（`Authenticatable`）で、親クラスに `prune()` は無い。
そこでトレイトの `prune()` を別名（`pruneOutsideTransaction`）で取り込み、それをトランザクションで包む。

```php
use Prunable {
    prune as pruneOutsideTransaction;
}

public function prune(): ?bool
{
    return DB::transaction(fn () => $this->pruneOutsideTransaction());
}
```

包まないと、`pruning()` が済んだ後に行の削除が失敗したとき、セッションなどだけが消えてユーザーが残る。
刈り込みは失敗を記録して次のユーザーへ進むので、その状態のまま気づかれない。

### スケジュール

`routes/console.php` に足す。

```php
Schedule::command('model:prune', ['--model' => User::class])->dailyAt('03:00')->timezone('Asia/Tokyo')->onOneServer();
```

`--model` は先頭のハイフンまで書く。
`'model' => ...` と書くと `model:prune model=...` という引数として渡り、コマンドが受け付けずに失敗する。

## テスト

`tests/Feature/PruneUnverifiedUsersTest.php` で、`travelTo` で時刻を進めてから `model:prune` を流す。
`$user->prune()` を直接呼ぶと条件（`prunable()`）を通らないので、コマンドから流す。

- 7日たった未確認のユーザーは消える
- 7日たっていない（6日と23時間59分59秒）未確認のユーザーは残る
- 確認済みのユーザーは残る
- 消したユーザーの `sessions` と `password_reset_tokens` の行も消える
- 確認メールに登録の取り消しの一文が入る

テストではセッションがデータベースに入らない（`phpunit.xml` の `SESSION_DRIVER` が `array`）。
`sessions` と `password_reset_tokens` の行は `DB::table()->insert()` で直接作る。
