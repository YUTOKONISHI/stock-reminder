import { describe, it } from 'vitest';

describe('一覧', () => {
  it.todo('商品の名前とカテゴリと消費日数を並べる');

  it.todo('1件も無ければその旨を出す');
});

describe('削除', () => {
  it.todo('利用者のストックにある商品は削除ボタンを押せない');

  it.todo('押せないときは理由を出す');

  it.todo('使われていない商品は削除を送る');
});

describe('編集', () => {
  it.todo('編集に切り替えると現在の値が入る');

  it.todo('保存すると更新を送る');

  it.todo('取り消すと元の表示に戻る');
});
