import type { FormEvent } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { unsubscribeDevice } from '@/shared/lib/deviceSubscription';
import { deleteAccount } from '../api';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function DeleteAccountDialog({ open, onClose }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [processing, setProcessing] = useState(false);

  function handleClose() {
    setPassword('');
    setError(undefined);
    onClose();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setProcessing(true);

    deleteAccount(password, {
      onSuccess: () => {
        void unsubscribeDevice();
        toast.success('アカウントを削除しました');
      },
      onError: (errors) => {
        setError(errors.password);
      },
      onFinish: () => {
        setProcessing(false);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>アカウントの削除</DialogTitle>
            <DialogDescription>
              ストックと通知履歴もすべて削除され、元に戻せません。続けるにはパスワードを入力してください。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-account-password">パスワード</Label>
            <Input
              id="delete-account-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-xs text-danger-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose}>
              キャンセル
            </Button>
            <Button type="submit" variant="destructive" disabled={password === '' || processing}>
              {processing ? '削除中...' : '削除する'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
