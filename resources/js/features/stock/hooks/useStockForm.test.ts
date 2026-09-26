import { describe, it } from 'vitest';

describe('初期値', () => {
  it.todo('新規なら全項目が空になる');

  it.todo('編集ならストックの値が入り、isEdit が true になる');

  it.todo('編集なら予定日が input[type=date] の形になる');
});

describe('カテゴリ', () => {
  it.todo('商品の重複を除いて名前順に並べる');

  it.todo('カテゴリ未選択なら商品の候補は空になる');

  it.todo('選んだカテゴリの商品だけを候補に出す');

  it.todo('カテゴリを変えると選択中の商品がクリアされる');
});

describe('消費日数の自動入力', () => {
  it.todo('商品を選ぶと初期の消費日数が入る');

  it.todo('初期値を持たない商品を選ぶと空になる');

  it.todo('手で消費日数を触った後は上書きしない');
});

describe('submit', () => {
  it.todo('新規は product_id を含めて数値に変換して送る');

  it.todo('編集は product_id を送らない');

  it.todo('予定日が空欄なら null にする');

  it.todo('サーバのエラーを項目ごとに割り当てる');
});

describe('remove', () => {
  it.todo('確認を取り消すと削除しない');

  it.todo('新規では何もしない');
});
