import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

function renderDialog({ disabled = false } = {}) {
  const onConfirm = vi.fn();

  render(
    <ConfirmDialog
      title="「洗剤」を削除しますか？"
      onConfirm={onConfirm}
      trigger={
        <button type="button" disabled={disabled}>
          削除
        </button>
      }
    />,
  );

  return { onConfirm };
}

describe('ConfirmDialog', () => {
  it('ボタンを押すまで確認を出さない', () => {
    renderDialog();

    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('確定すると onConfirm を呼んで閉じる', () => {
    const { onConfirm } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: '削除' }));
    const dialog = screen.getByRole('alertdialog');

    expect(dialog).toHaveTextContent('「洗剤」を削除しますか？');
    expect(dialog).toHaveTextContent('この操作は取り消せません。');

    fireEvent.click(screen.getByRole('button', { name: '削除する' }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('キャンセルすると onConfirm を呼ばずに閉じる', () => {
    const { onConfirm } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: '削除' }));
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('ボタンが disabled なら開かない', () => {
    renderDialog({ disabled: true });

    fireEvent.click(screen.getByRole('button', { name: '削除' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
