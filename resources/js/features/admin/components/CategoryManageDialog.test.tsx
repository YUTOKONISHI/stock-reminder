import { describe, it } from 'vitest';

describe('一覧', () => {
  it.todo('カテゴリ名と商品の件数を並べる');
});

describe('削除', () => {
  it.todo('商品が登録されているカテゴリは削除ボタンを押せない');

  it.todo('押せないときは理由を出す');

  it.todo('使われていないカテゴリは削除を送る');
});

describe('追加と変更', () => {
  it.todo('名前を入れて追加すると登録を送る');

  it.todo('名前が空なら送らない');

  it.todo('編集して保存すると更新を送る');
});
