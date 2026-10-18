import { router } from '@inertiajs/react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminCategory } from '../types';
import { CategoryManageDialog } from './CategoryManageDialog';

vi.mock('@inertiajs/react', () => ({
  router: { post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const DAILY: AdminCategory = { id: 1, name: '日用品', products_count: 10 };
const FOOD: AdminCategory = { id: 2, name: '食品', products_count: 20 };
const CLEANING: AdminCategory = { id: 3, name: '清掃用品', products_count: 0 };

function renderDialog(categories: AdminCategory[] = [DAILY, FOOD, CLEANING]) {
  return render(<CategoryManageDialog open onClose={() => {}} categories={categories} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('一覧', () => {
  it('カテゴリ名と商品の件数を並べる', () => {
    renderDialog();

    const rows = screen.getAllByRole('listitem');

    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('日用品');
    expect(rows[0]).toHaveTextContent('商品10件');
    expect(rows[1]).toHaveTextContent('食品');
    expect(rows[1]).toHaveTextContent('商品20件');
    expect(rows[2]).toHaveTextContent('清掃用品');
    expect(rows[2]).toHaveTextContent('商品0件');
  });
});

describe('削除', () => {
  it('商品が登録されているカテゴリは削除ボタンを押せない', () => {
    renderDialog();

    const rows = screen.getAllByRole('listitem');
    const deleteButton = within(rows[0]).getByRole('button', { name: '削除' });

    expect(deleteButton).toBeDisabled();
  });

  it('押せないときは理由を出す', () => {
    renderDialog();

    const rows = screen.getAllByRole('listitem');
    const deleteButton = within(rows[0]).getByRole('button', { name: '削除' });

    expect(deleteButton.title).toBe('商品が登録されているため削除できません');
  });

  it('使われていないカテゴリは削除を送る', () => {
    renderDialog();
    const rows = screen.getAllByRole('listitem');
    fireEvent.click(within(rows[2]).getByRole('button', { name: '削除' }));

    expect(router.delete).toHaveBeenCalledWith('/admin/categories/3', expect.anything());
  });
});

describe('追加と変更', () => {
  it('名前を入れて追加すると登録を送る', () => {
    renderDialog();

    const input = screen.getByPlaceholderText('新しいカテゴリ名');
    fireEvent.change(input, { target: { value: '新しいカテゴリ' } });
    fireEvent.click(screen.getByRole('button', { name: '追加' }));

    expect(router.post).toHaveBeenCalledWith(
      '/admin/categories',
      { name: '新しいカテゴリ' },
      expect.anything(),
    );
  });

  it('名前が空なら送らない', () => {
    renderDialog();
    const input = screen.getByPlaceholderText('新しいカテゴリ名');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '追加' }));
    expect(screen.getByRole('button', { name: '追加' })).toBeDisabled();
    expect(router.post).not.toHaveBeenCalled();
  });

  it('編集して保存すると更新を送る', () => {
    renderDialog();
    const row = screen.getAllByRole('listitem')[0];
    fireEvent.click(within(row).getByRole('button', { name: '変更' }));

    const input = within(row).getByRole('textbox');
    fireEvent.change(input, { target: { value: '日用雑貨' } });
    fireEvent.click(within(row).getByRole('button', { name: '保存' }));

    expect(router.put).toHaveBeenCalledWith(
      '/admin/categories/1',
      { name: '日用雑貨' },
      expect.anything(),
    );
  });
});
