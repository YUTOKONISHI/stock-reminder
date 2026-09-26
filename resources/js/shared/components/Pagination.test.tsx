import { describe, it } from 'vitest';

describe('表示の有無', () => {
  it.todo('1ページしか無ければ何も出さない');
});

describe('ページ番号の組み立て', () => {
  it.todo('7ページまでは省略記号を出さずに全部並べる');

  it.todo('先頭寄りなら後ろだけ省略する');

  it.todo('中ほどなら前後とも省略する');

  it.todo('末尾寄りなら前だけ省略する');

  it.todo('現在のページに aria-current を付ける');
});

describe('前後の矢印', () => {
  it.todo('先頭では前へ進めない');

  it.todo('末尾では次へ進めない');
});

describe('リンク先', () => {
  it.todo('今のクエリを保ったまま page だけ差し替える');
});

describe('件数の表示', () => {
  it.todo('全件数と表示中の範囲を出す');
});
