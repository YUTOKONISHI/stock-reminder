import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { resendVerificationEmail } from '@/features/auth/api';
import { dashboard } from '@/routes';
import { AuthCard } from '@/shared/components/AuthCard';
import { Button } from '@/shared/components/ui/button';
import { logout } from '@/shared/lib/auth';

type Props = {
  expired: boolean;
};

export default function VerifyEmail({ expired }: Props) {
  const { auth } = usePage().props;
  const [sending, setSending] = useState(false);

  function resend() {
    setSending(true);
    resendVerificationEmail({
      onSuccess: () => toast.success('確認メールを送信しました'),
      onFinish: () => setSending(false),
    });
  }

  return (
    <AuthCard
      title="メールアドレスを確認してください"
      description="登録したメールアドレスに確認用のリンクを送りました。リンクを開くと、アプリを使えるようになります。"
    >
      <div className="space-y-4">
        <p className="rounded-md bg-canvas px-3 py-2 break-all text-ink">{auth.user.email}</p>

        {expired && (
          <p className="text-danger-600">
            リンクの有効期限が切れています。もう一度送信してください。
          </p>
        )}

        <Button type="button" onClick={resend} disabled={sending} className="w-full">
          {sending ? '送信中...' : '確認メールを再送する'}
        </Button>

        <div className="space-y-2">
          <p className="text-sm text-ink-muted">確認が済んだら、こちらを押してください。</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.visit(dashboard.url())}
            className="w-full"
          >
            ダッシュボードへ進む
          </Button>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={logout}
            className="text-xs text-primary-700 hover:underline"
          >
            メールアドレスを間違えた場合は、ログアウトして登録し直す
          </button>
        </div>
      </div>
    </AuthCard>
  );
}
