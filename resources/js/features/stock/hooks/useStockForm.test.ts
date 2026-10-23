import { router } from '@inertiajs/react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category } from '@/shared/types/catalog';
import type { Stock, StockFormProduct } from '../types';
import { useStockForm } from './useStockForm';

const DAILY: Category = { id: 1, name: '日用品' };
const FOOD: Category = { id: 2, name: '食品' };

/** ストック設定画面が受け取る商品。initial_consumption_interval_days は世帯人数の補正後の値。 */
function product(
  id: number,
  name: string,
  category: Category,
  initialDays: number,
): StockFormProduct {
  return {
    id,
    name,
    category_id: category.id,
    category,
    default_consumption_interval_days: 7,
    initial_consumption_interval_days: initialDays,
  };
}

const TISSUE = product(10, 'ティッシュ', DAILY, 14);
const DETERGENT = product(11, '洗剤', DAILY, 30);
const SOY_SAUCE = product(20, '醤油', FOOD, 60);

const PRODUCTS: StockFormProduct[] = [TISSUE, DETERGENT, SOY_SAUCE];

/** 編集中のストック。既定はティッシュを2個、消費日数7日、予定日は2026-10-01。 */
function stock(overrides: Partial<Stock> = {}): Stock {
  return {
    id: 100,
    product: TISSUE,
    quantity: 2,
    consumption_interval_days: 7,
    next_purchase_date: '2026-10-01T00:00:00.000000Z',
    ...overrides,
  };
}

vi.mock('@inertiajs/react', () => ({
  router: { post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('初期値', () => {
  it('新規なら全項目が空になる', () => {
    const { result } = renderHook(() => useStockForm({ stock: null, products: PRODUCTS }));

    expect(result.current.form.getValues()).toEqual({
      category_id: '',
      product_id: '',
      quantity: '',
      consumption_interval_days: '',
      next_purchase_date: '',
    });
    expect(result.current.isEdit).toBe(false);
    expect(result.current.hasCategory).toBe(false);
  });

  it('編集ならストックの値が入り、isEdit が true になる', () => {
    const { result } = renderHook(() => useStockForm({ stock: stock(), products: PRODUCTS }));
    expect(result.current.hasCategory).toBe(true);
    expect(result.current.form.getValues()).toEqual({
      category_id: '1',
      product_id: '10',
      quantity: '2',
      consumption_interval_days: '7',
      next_purchase_date: '2026-10-01',
    });
    expect(result.current.isEdit).toBe(true);
  });
});

describe('カテゴリ', () => {
  it('商品の重複を除いて名前順に並べる', () => {
    const { result } = renderHook(() => useStockForm({ stock: stock(), products: PRODUCTS }));
    expect(result.current.categories).toEqual([FOOD, DAILY]);
  });

  it('カテゴリ未選択なら商品の候補は空になる', () => {
    const { result } = renderHook(() => useStockForm({ stock: null, products: PRODUCTS }));
    expect(result.current.visibleProducts).toEqual([]);
  });

  it('選んだカテゴリの商品だけを候補に出す', () => {
    const { result } = renderHook(() => useStockForm({ stock: null, products: PRODUCTS }));
    act(() => {
      result.current.form.setValue('category_id', '2');
    });

    expect(result.current.visibleProducts).toEqual([SOY_SAUCE]);
  });

  it('カテゴリを変えると選択中の商品がクリアされる', () => {
    const { result } = renderHook(() => useStockForm({ stock: null, products: PRODUCTS }));

    act(() => {
      result.current.form.setValue('category_id', '1');
      result.current.form.setValue('product_id', '10');
    });

    act(() => {
      result.current.form.setValue('category_id', '2');
      result.current.handleCategoryChange();
    });

    expect(result.current.form.getValues().product_id).toBe('');
  });
});

describe('消費日数の自動入力', () => {
  it('商品を選ぶと初期の消費日数が入る', () => {
    const { result } = renderHook(() => useStockForm({ stock: null, products: PRODUCTS }));

    act(() => {
      result.current.form.setValue('category_id', '1');
      result.current.form.setValue('product_id', '10');
      result.current.handleProductChange('10');
    });

    expect(result.current.form.getValues().consumption_interval_days).toBe('14');
  });

  it('手で消費日数を触った後は上書きしない', () => {
    const { result } = renderHook(() => useStockForm({ stock: stock(), products: PRODUCTS }));
    act(() => {
      result.current.form.setValue('consumption_interval_days', '20');
      result.current.markIntervalEdited();
      result.current.handleProductChange('11');
    });

    expect(result.current.form.getValues().consumption_interval_days).toBe('20');
  });
});

describe('submit', () => {
  it('新規は product_id を含めて数値に変換して送る', () => {
    const { result } = renderHook(() => useStockForm({ stock: null, products: PRODUCTS }));

    result.current.submit({
      category_id: '1',
      product_id: '10',
      quantity: '2',
      consumption_interval_days: '14',
      next_purchase_date: '2026-10-01',
    });

    expect(router.post).toHaveBeenCalledWith(
      '/app/stocks',
      {
        product_id: 10,
        quantity: 2,
        consumption_interval_days: 14,
        next_purchase_date: '2026-10-01',
      },
      expect.anything(),
    );
  });

  it('編集は product_id を送らない', () => {
    const { result } = renderHook(() => useStockForm({ stock: stock(), products: PRODUCTS }));
    result.current.submit({
      category_id: '1',
      product_id: '10',
      quantity: '2',
      consumption_interval_days: '14',
      next_purchase_date: '2026-10-01',
    });

    expect(router.put).toHaveBeenCalledWith(
      '/app/stocks/100',
      {
        quantity: 2,
        consumption_interval_days: 14,
        next_purchase_date: '2026-10-01',
      },
      expect.anything(),
    );
  });

  it('予定日が空欄なら null にする', () => {
    const { result } = renderHook(() => useStockForm({ stock: null, products: PRODUCTS }));

    result.current.submit({
      category_id: '1',
      product_id: '10',
      quantity: '2',
      consumption_interval_days: '14',
      next_purchase_date: '',
    });

    expect(router.post).toHaveBeenCalledWith(
      '/app/stocks',
      {
        product_id: 10,
        quantity: 2,
        consumption_interval_days: 14,
        next_purchase_date: null,
      },
      expect.anything(),
    );
  });

  it('サーバのエラーを項目ごとに割り当てる', () => {
    const { result } = renderHook(() => {
      const form = useStockForm({ stock: null, products: PRODUCTS });

      void form.form.formState.errors;

      return form;
    });

    result.current.submit({
      category_id: '1',
      product_id: '10',
      quantity: '0',
      consumption_interval_days: '14',
      next_purchase_date: '',
    });

    const { onError } = vi.mocked(router.post).mock.calls[0][2] ?? {};

    act(() => {
      onError?.({
        product_id: 'この商品は既に登録されています',
        quantity: 'ストック数は1以上の値にしてください。',
        category_id: 'フォームには無い項目',
      });
    });

    const { errors } = result.current.form.formState;

    expect(errors.product_id?.message).toBe('この商品は既に登録されています');
    expect(errors.quantity?.message).toBe('ストック数は1以上の値にしてください。');
    expect(errors.category_id).toBeUndefined();
  });
});

describe('remove', () => {
  it('新規では何もしない', () => {
    const { result } = renderHook(() => useStockForm({ stock: null, products: PRODUCTS }));

    result.current.remove();

    expect(router.delete).not.toHaveBeenCalled();
  });
});
