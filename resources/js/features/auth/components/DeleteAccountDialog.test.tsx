import { act, fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { unsubscribeDevice } from '@/shared/lib/deviceSubscription';
import { deleteAccount } from '../api';
import { DeleteAccountDialog } from './DeleteAccountDialog';

vi.mock('../api', () => ({
  deleteAccount: vi.fn(),
}));

vi.mock('@/shared/lib/deviceSubscription', () => ({
  unsubscribeDevice: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}));

function submit(password: string) {
  fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: '削除する' }));
}

function callbacks() {
  return vi.mocked(deleteAccount).mock.calls[0][1];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DeleteAccountDialog', () => {
  it('パスワードが空なら削除ボタンを押せない', () => {
    render(<DeleteAccountDialog open onClose={() => {}} />);

    expect(screen.getByRole('button', { name: '削除する' })).toBeDisabled();
  });

  it('入力したパスワードで削除を送り、送信中は押せない', () => {
    render(<DeleteAccountDialog open onClose={() => {}} />);

    submit('password');

    expect(deleteAccount).toHaveBeenCalledWith('password', expect.anything());
    expect(screen.getByRole('button', { name: '削除中...' })).toBeDisabled();
  });

  it('成功すると端末の購読を解除してトーストを出す', () => {
    render(<DeleteAccountDialog open onClose={() => {}} />);

    submit('password');

    act(() => {
      callbacks().onSuccess?.();
    });

    expect(unsubscribeDevice).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('アカウントを削除しました');
  });

  it('サーバのエラーを出し、再度押せるようにする', () => {
    render(<DeleteAccountDialog open onClose={() => {}} />);

    submit('dummy');

    act(() => {
      callbacks().onError?.({ password: 'パスワードが正しくありません。' });
      callbacks().onFinish?.();
    });

    expect(screen.getByText('パスワードが正しくありません。')).toBeInTheDocument();
    expect(unsubscribeDevice).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '削除する' })).toBeEnabled();
  });

  it('キャンセルすると入力を空に戻して閉じる', () => {
    const onClose = vi.fn();
    render(<DeleteAccountDialog open onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'password' } });
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(onClose).toHaveBeenCalled();
    expect(screen.getByLabelText('パスワード')).toHaveValue('');
  });
});
