import { router } from '@inertiajs/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Stock } from '@/features/stock/types';
import type { Category, Product } from '@/shared/types/catalog';
import Dashboard from './dashboard';

vi.mock('@inertiajs/react', () => ({
  Head: () => null,
  Link: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  router: { post: vi.fn(), patch: vi.fn() },
}));

const DAILY: Category = { id: 1, name: '日用品' };

function product(id: number, name: string, category = DAILY): Product {
  return {
    id,
    name,
    category_id: category.id,
    category,
    default_consumption_interval_days: 7,
  };
}

/** 予定日は 'yyyy-MM-dd' で渡す。isWithinDays が文字列のまま比べるため。 */
function stock(overrides: Partial<Stock> = {}): Stock {
  return {
    id: 100,
    product: product(10, 'ティッシュ'),
    quantity: 2,
    consumption_interval_days: 7,
    next_purchase_date: '2026-09-23',
    last_purchased_on: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-05T09:00:00'));
});

describe('カレンダー', () => {
  it('予定日は1週間の絞り込みを掛けずに全件へ印を付ける', () => {
    render(
      <Dashboard
        stocks={[
          stock({ id: 1, product: product(10, 'ティッシュ'), next_purchase_date: '2026-09-23' }),
          stock({ id: 2, product: product(11, '洗剤'), next_purchase_date: '2026-10-03' }),
        ]}
      />,
    );

    const cell1 = screen.getByRole('gridcell', { name: '2026年9月23日水曜日' });
    expect(cell1.className).toContain('before:border-primary-600');
    const cell2 = screen.getByRole('gridcell', { name: '2026年10月3日土曜日' });
    expect(cell2.className).toContain('before:border-primary-600');
  });
});

describe('次回購入日', () => {
  it('予定日が過ぎていれば見出しを「買い忘れ」にする', () => {
    render(
      <Dashboard
        stocks={[
          stock({ id: 1, product: product(10, 'ティッシュ'), next_purchase_date: '2026-09-04' }),
          stock({ id: 2, product: product(11, '洗剤'), next_purchase_date: '2026-10-03' }),
        ]}
      />,
    );

    const label = screen.getByText('買い忘れ');
    expect(label).toBeInTheDocument();
    const date = screen.getByText('9月4日(金)');
    expect(date).toBeInTheDocument();
  });

  it('過ぎていなければ見出しを「次回購入日」にする', () => {
    render(
      <Dashboard
        stocks={[
          stock({ id: 1, product: product(10, 'ティッシュ'), next_purchase_date: '2026-09-06' }),
          stock({ id: 2, product: product(11, '洗剤'), next_purchase_date: '2026-10-03' }),
        ]}
      />,
    );

    const label = screen.getByText('次回購入日');
    expect(label).toBeInTheDocument();
    const date = screen.getByText('9月6日(日)');
    expect(date).toBeInTheDocument();
  });
});

describe('購入予定品', () => {
  it('1週間以内のものだけ並べる', () => {
    render(
      <Dashboard
        stocks={[
          stock({ id: 1, product: product(10, 'ティッシュ'), next_purchase_date: '2026-09-06' }),
          stock({ id: 2, product: product(11, '洗剤'), next_purchase_date: '2026-09-07' }),
          stock({ id: 3, product: product(12, '歯磨き粉'), next_purchase_date: '2026-10-03' }),
        ]}
      />,
    );

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('ティッシュ');
    expect(rows[1]).toHaveTextContent('洗剤');
  });

  it('件数も1週間以内で数える', () => {
    render(
      <Dashboard
        stocks={[
          stock({ id: 1, product: product(10, 'ティッシュ'), next_purchase_date: '2026-09-06' }),
          stock({ id: 2, product: product(11, '洗剤'), next_purchase_date: '2026-09-07' }),
          stock({ id: 3, product: product(12, '歯磨き粉'), next_purchase_date: '2026-10-03' }),
        ]}
      />,
    );

    expect(screen.getByText('1週間以内').previousElementSibling).toHaveTextContent(/^2$/);
    expect(screen.getByText('今日まで').previousElementSibling).toHaveTextContent(/^0$/);
  });

  it('購入日から予定日まで1週間以内のものは、購入後は一覧にも件数にも入れない', () => {
    render(
      <Dashboard
        stocks={[
          stock({
            id: 1,
            product: product(10, 'ティッシュ'),
            next_purchase_date: '2026-09-08',
            last_purchased_on: '2026-09-05',
          }),
          stock({ id: 2, product: product(11, '洗剤'), next_purchase_date: '2026-09-07' }),
        ]}
      />,
    );

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('洗剤');
    expect(screen.getByText('1週間以内').previousElementSibling).toHaveTextContent(/^1$/);
    const cell = screen.getByRole('gridcell', { name: '2026年9月8日火曜日' });
    expect(cell.className).toContain('before:border-primary-600');
  });

  it('購入後に外したものも、予定日の当日には出す', () => {
    render(
      <Dashboard
        stocks={[stock({ next_purchase_date: '2026-09-05', last_purchased_on: '2026-09-02' })]}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('購入日から予定日まで1週間を超えるものは、今までどおり1週間前から出す', () => {
    render(
      <Dashboard
        stocks={[stock({ next_purchase_date: '2026-09-10', last_purchased_on: '2026-09-02' })]}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('1件も無ければその旨を出す', () => {
    render(<Dashboard stocks={[]} />);
    expect(screen.getByText('1週間以内に購入予定の品はありません')).toBeInTheDocument();
    expect(screen.getByText('未設定')).toBeInTheDocument();
  });

  it('ストック数1のものを先に出す', () => {
    /* Controllerから渡される結果はquantityでソートされている */
    render(
      <Dashboard
        stocks={[
          stock({
            id: 1,
            product: product(11, '洗剤'),
            quantity: 1,
            next_purchase_date: '2026-09-07',
          }),
          stock({
            id: 2,
            product: product(10, 'ティッシュ'),
            quantity: 3,
            next_purchase_date: '2026-09-06',
          }),
        ]}
      />,
    );

    const rows = screen.getAllByRole('listitem');

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('洗剤');
    expect(rows[1]).toHaveTextContent('ティッシュ');
  });

  it('購入ボタンを押すと購入を記録する', () => {
    render(
      <Dashboard
        stocks={[
          stock({
            id: 1,
            product: product(11, '洗剤'),
            quantity: 1,
            next_purchase_date: '2026-09-07',
          }),
          stock({
            id: 2,
            product: product(10, 'ティッシュ'),
            quantity: 3,
            next_purchase_date: '2026-09-06',
          }),
        ]}
      />,
    );

    const button = screen.getByRole('button', { name: '「ティッシュ」を購入済みにする' });
    fireEvent.click(button);

    expect(router.patch).toHaveBeenCalledWith(
      '/app/stocks/2/purchase',
      {},
      { preserveScroll: true },
    );
  });
});
