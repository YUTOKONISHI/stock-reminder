import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { updatePassword } from '../api';

type Props = {
  open: boolean;
  onClose: () => void;
};

type Errors = Partial<Record<'current_password' | 'password', string>>;

export function PasswordChangeDialog({ open, onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  function reset() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrors({});
  }

  function handleSubmit() {
    setErrors({});

    if (newPassword !== confirmPassword) {
      setErrors({ password: 'パスワードが一致しません' });

      return;
    }

    updatePassword(
      {
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      },
      {
        onSuccess: () => {
          reset();
          toast.success('パスワードを変更しました');
          onClose();
        },
        onError: (received) => {
          setErrors(received);
        },
      },
    );
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>パスワード変更</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">現在のパスワード</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            {errors.current_password && (
              <p className="text-xs text-danger-600">{errors.current_password}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">新しいパスワード</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            {errors.password && <p className="text-xs text-danger-600">{errors.password}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">パスワード確認</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClose}>
            キャンセル
          </Button>
          <Button type="button" onClick={handleSubmit}>
            変更する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
