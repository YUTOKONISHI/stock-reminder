import { router } from '@inertiajs/react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Stock } from '@/features/stock/types';
import { PurchaseStockDialog } from './PurchaseStockDialog';

vi.mock('@inertiajs/react', () => ({
  router: { patch: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}));

const STOCK: Stock = {
  id: 2,
  product: {
    id: 10,
    name: 'トイレットペーパー',
    category_id: 1,
    category: { id: 1, name: '日用品' },
    default_consumption_interval_days: 30,
  },
  quantity: 2,
  consumption_interval_days: 30,
  next_purchase_date: '2026-10-31',
  last_purchased_on: null,
};

function renderDialog(onClose = vi.fn(), stock = STOCK) {
  render(<PurchaseStockDialog stock={stock} open onClose={onClose} />);

  return onClose;
}

function quantityInput() {
  return screen.getByLabelText('購入後のストック数');
}

/** router.patch に渡されたコールバックを取り出す。Inertia の型は onSuccess に Page を
 * 要求するが、このコンポーネントは引数を使わない。 */
function callbacks() {
  return vi.mocked(router.patch).mock.calls[0][2] as {
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-31T09:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PurchaseStockDialog', () => {
  it('現在のストック数を初期値にして、次回購入予定日を出す', () => {
    renderDialog();

    expect(quantityInput()).toHaveValue(2);
    expect(screen.getByText('2026/12/30(水)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '記録する' })).toHaveFocus();
  });

  it('増減ボタンに合わせて次回購入予定日が変わり、1より下には減らせない', () => {
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: '1つ増やす' }));
    expect(quantityInput()).toHaveValue(3);
    expect(screen.getByText('2027/01/29(金)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '1つ減らす' }));
    fireEvent.click(screen.getByRole('button', { name: '1つ減らす' }));
    expect(quantityInput()).toHaveValue(1);
    expect(screen.getByRole('button', { name: '1つ減らす' })).toBeDisabled();
  });

  it.each(['', '0', '1.5'])('「%s」は記録できない', (value) => {
    renderDialog();

    fireEvent.change(quantityInput(), { target: { value } });

    expect(screen.getByText('ストック数は1以上の値にしてください。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '記録する' })).toBeDisabled();
    expect(screen.queryByText('次回購入予定日')).not.toBeInTheDocument();

    fireEvent.submit(quantityInput());
    expect(router.patch).not.toHaveBeenCalled();
  });

  it('Dateで表せない日数になっても画面が落ちない', () => {
    renderDialog();

    fireEvent.change(quantityInput(), { target: { value: '999999999999' } });

    expect(screen.queryByText('次回購入予定日')).not.toBeInTheDocument();
  });

  it('記録すると入力したストック数を送り、閉じてトーストを出す', () => {
    const onClose = renderDialog();

    fireEvent.change(quantityInput(), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: '記録する' }));

    expect(router.patch).toHaveBeenCalledWith(
      '/app/stocks/2/purchase',
      { quantity: 1 },
      expect.objectContaining({ preserveScroll: true }),
    );

    act(() => callbacks().onSuccess?.());

    expect(toast.success).toHaveBeenCalledWith('トイレットペーパーの購入を記録しました', {
      description: '次回購入予定日は2026/11/30(月)です',
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('サーバの検証エラーは開いたまま表示する', () => {
    const onClose = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: '記録する' }));
    act(() => callbacks().onError?.({ quantity: 'サーバのエラー' }));

    expect(screen.getByText('サーバのエラー')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('キャンセルでは何も送らない', () => {
    const onClose = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(router.patch).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
