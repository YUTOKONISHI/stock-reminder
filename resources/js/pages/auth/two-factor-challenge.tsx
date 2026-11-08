import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { requestTwoFactorRecovery, twoFactorChallenge } from '@/features/auth/api';
import { AuthCard } from '@/shared/components/AuthCard';
import { Button } from '@/shared/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';

type TwoFactorCodeForm = {
  code: string;
  recovery_code: string;
};

export default function TwoFactorChallenge() {
  const form = useForm<TwoFactorCodeForm>({ defaultValues: { code: '', recovery_code: '' } });
  const { isSubmitting } = form.formState;
  const [isRecoveryMode, setIsRecoveryMode] = useState<boolean>(false);
  const [contactToAdmin, setContactToAdmin] = useState<boolean>(false);
  const contactForm = useForm<{ email: string }>({ defaultValues: { email: '' } });

  const [processing, setProcessing] = useState(false);

  function onSubmit(data: TwoFactorCodeForm) {
    const values = isRecoveryMode ? { recovery_code: data.recovery_code } : { code: data.code };

    twoFactorChallenge(values, {
      onError: (err) => {
        if (err.code) {
          form.setError('code', { message: err.code });
        }

        if (err.recovery_code) {
          form.setError('recovery_code', { message: err.recovery_code });
        }
      },
    });
  }

  function onRequestRecovery(data: { email: string }) {
    setProcessing(true);
    requestTwoFactorRecovery(data, {
      onSuccess: () => {
        toast.success('管理者に依頼しました。登録しているメールアドレスに連絡が届きます');
        setContactToAdmin(false);
      },
      onError: (err) => {
        if (err.email) {
          contactForm.setError('email', { message: err.email });
        }
      },
      onFinish: () => setProcessing(false),
    });
  }

  return (
    <AuthCard title="2段階認証">
      <div className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {isRecoveryMode ? (
              <FormField
                control={form.control}
                name="recovery_code"
                rules={{ required: 'リカバリーコードを入力してください' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>リカバリーコード</FormLabel>
                    <FormControl>
                      <Input type="text" inputMode="text" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="code"
                rules={{ required: '認証コードを入力してください' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>認証コード</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? '送信中...' : '送信'}
            </Button>
            <Button
              type="button"
              className="w-full"
              variant="link"
              onClick={() => setIsRecoveryMode((prev) => !prev)}
            >
              {isRecoveryMode ? '認証コードを使う' : 'リカバリーコードを使う'}
            </Button>
            <Button
              type="button"
              className="w-full"
              variant="link"
              onClick={() => setContactToAdmin((prev) => !prev)}
            >
              {contactToAdmin ? '閉じる' : '認証アプリもリカバリーコードも使えない場合'}
            </Button>
          </form>
        </Form>
      </div>
      {contactToAdmin && (
        <div className="space-y-6">
          <Form {...contactForm}>
            <form onSubmit={contactForm.handleSubmit(onRequestRecovery)} className="space-y-4">
              <p className="text-sm text-ink-muted">
                ログインに使ったメールアドレスを入力してください。管理者に2段階認証の解除を依頼します。
              </p>
              <FormField
                control={contactForm.control}
                name="email"
                rules={{ required: 'メールアドレスを入力してください' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>メールアドレス</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={processing} className="w-full">
                管理者に解除を依頼する
              </Button>
            </form>
          </Form>
        </div>
      )}
    </AuthCard>
  );
}
