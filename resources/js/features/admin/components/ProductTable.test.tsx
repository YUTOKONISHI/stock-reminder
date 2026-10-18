import { router } from '@inertiajs/react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Category } from '@/shared/types/catalog';
import type { AdminProduct } from '../types';
import { ProductTable } from './ProductTable';

vi.mock('@inertiajs/react', () => ({
  router: { post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const CATEGORIES: Category[] = [
  { id: 1, name: 'カテゴリ1' },
  { id: 2, name: 'カテゴリ2' },
];

function product(overrides: Partial<AdminProduct> = {}): AdminProduct {
  const categoryId = overrides.category_id ?? 1;

  return {
    id: 1,
    name: '商品1',
    category_id: categoryId,
    /* 表に出るカテゴリ名は categories から category_id で引いた値。この項目は
     * 型を満たすために置くだけで、ProductTable は読んでいない。 */
    category: CATEGORIES.find((c) => c.id === categoryId) ?? CATEGORIES[0],
    default_consumption_interval_days: 10,
    stocks_count: 0,
    ...overrides,
  };
}

function renderTable(products: AdminProduct[], categories = CATEGORIES) {
  return render(<ProductTable products={products} categories={categories} />);
}

/** 見出し行を除いた商品の行。 */
function productRows(): HTMLElement[] {
  const [, ...rows] = screen.getAllByRole('row');

  return rows;
}

describe('一覧', () => {
  it('商品の名前とカテゴリと消費日数を並べる', () => {
    renderTable([
      product({ id: 1, name: '商品1' }),
      product({ id: 2, name: '商品2', category_id: 2, default_consumption_interval_days: 20 }),
    ]);

    const [header, ...rows] = screen.getAllByRole('row');

    expect(header).toHaveTextContent('商品名商品カテゴリ消費間隔（日）変更・削除');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('商品1');
    expect(rows[0]).toHaveTextContent('カテゴリ1');
    expect(rows[0]).toHaveTextContent('10');
    expect(rows[1]).toHaveTextContent('商品2');
    expect(rows[1]).toHaveTextContent('カテゴリ2');
    expect(rows[1]).toHaveTextContent('20');
  });

  it('1件も無ければ見出しだけになる', () => {
    renderTable([]);

    expect(productRows()).toHaveLength(0);
  });
});

describe('削除', () => {
  it('利用者のストックにある商品は削除ボタンを押せない', () => {
    renderTable([product({ stocks_count: 1 })]);

    expect(within(productRows()[0]).getByRole('button', { name: '削除' })).toBeDisabled();
  });

  it('押せないときは理由を出す', () => {
    renderTable([product({ stocks_count: 1 })]);

    expect(within(productRows()[0]).getByRole('button', { name: '削除' })).toHaveAttribute(
      'title',
      '利用者のストックに登録されているため削除できません',
    );
  });

  it('使われていない商品は削除を送る', () => {
    renderTable([product({ id: 7, stocks_count: 0 })]);

    fireEvent.click(within(productRows()[0]).getByRole('button', { name: '削除' }));

    expect(router.delete).toHaveBeenCalledWith('/admin/products/7', expect.anything());
  });
});

describe('編集', () => {
  it('編集に切り替えると現在の値が入る', () => {
    renderTable([product({ id: 1, name: '商品1', category_id: 2 })]);

    const row = within(productRows()[0]);
    fireEvent.click(row.getByRole('button', { name: '変更' }));

    /* 3つの項目は役割が違う。combobox が持つのは選択中の option の value、
     * つまりカテゴリ名ではなく category_id の文字列。 */
    expect(row.getByRole('textbox')).toHaveValue('商品1');
    expect(row.getByRole('combobox')).toHaveValue('2');
    expect(row.getByRole('spinbutton')).toHaveValue(10);
  });

  it('保存すると更新を送る', () => {
    renderTable([product({ id: 1, name: '商品1', category_id: 2 })]);

    const row = within(productRows()[0]);
    fireEvent.click(row.getByRole('button', { name: '変更' }));

    const input = row.getByRole('textbox');
    fireEvent.change(input, { target: { value: '商品2' } });
    fireEvent.click(row.getByRole('button', { name: '保存' }));
    expect(router.put).toHaveBeenCalledWith(
      '/admin/products/1',
      { name: '商品2', category_id: 2, default_consumption_interval_days: 10 },
      expect.anything(),
    );
  });

  it('編集中の行は変更と削除を出さない', () => {
    renderTable([product({ id: 1, name: '商品1', category_id: 2 })]);

    const row = within(productRows()[0]);
    fireEvent.click(row.getByRole('button', { name: '変更' }));

    expect(row.queryByRole('button', { name: '変更' })).toBeNull();
    expect(row.queryByRole('button', { name: '削除' })).toBeNull();
  });
});
