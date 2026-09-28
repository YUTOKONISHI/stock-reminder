import { router } from '@inertiajs/react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCategoryFilter } from './useCategoryFilter';

vi.mock('@inertiajs/react', () => ({
  router: { get: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useCategoryFilter', () => {
  it('初期値をそのまま選択状態にする', () => {
    const { result } = renderHook(() => useCategoryFilter([1, 2]));

    expect(result.current.selectedCategories).toEqual([1, 2]);
  });

  it('選んでいないカテゴリを押すと追加する', () => {
    const { result } = renderHook(() => useCategoryFilter([1]));

    act(() => {
      result.current.toggleCategory(2);
    });

    expect(result.current.selectedCategories).toEqual([1, 2]);
  });

  it('選んでいるカテゴリを押すと外す', () => {
    const { result } = renderHook(() => useCategoryFilter([1]));

    act(() => {
      result.current.toggleCategory(1);
    });

    expect(result.current.selectedCategories).toEqual([]);
  });

  it('カンマ区切りのクエリで router.get を呼ぶ', () => {
    const { result } = renderHook(() => useCategoryFilter([1]));

    act(() => {
      result.current.toggleCategory(2);
    });

    expect(router.get).toHaveBeenCalledWith(
      '/admin/dashboard',
      {
        categories: '1,2',
      },
      expect.anything(),
    );
  });

  it('すべて外すと空のクエリを送る', () => {
    const { result } = renderHook(() => useCategoryFilter([1]));

    act(() => {
      result.current.toggleCategory(1);
    });

    expect(router.get).toHaveBeenCalledWith(
      '/admin/dashboard',
      {
        categories: '',
      },
      expect.anything(),
    );
  });

  it('preserveState と preserveScroll と replace を付けて呼ぶ', () => {
    const { result } = renderHook(() => useCategoryFilter([]));

    act(() => {
      result.current.toggleCategory(1);
    });

    expect(router.get).toHaveBeenCalledWith(
      '/admin/dashboard',
      {
        categories: '1',
      },
      {
        preserveScroll: true,
        preserveState: true,
        replace: true,
      },
    );
  });
});
