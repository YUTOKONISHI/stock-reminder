import { Link } from '@inertiajs/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { requestPasswordReset } from '@/features/auth/api';
import { login, resetPassword } from '@/routes';
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

type ForgotPasswordForm = {
  email: string;
};

export default function ForgotPassword() {
  const form = useForm<ForgotPasswordForm>({ defaultValues: { email: '' } });
  const { isSubmitting } = form.formState;
  const [sent, setSent] = useState(false);

  function onSubmit(data: ForgotPasswordForm) {
    requestPasswordReset(data.email, {
      onSuccess: () => {
        setSent(true);
        toast.success('仮パスワードをメールで送信しました');
      },
      onError: (err) => {
        if (err.email) {
          form.setError('email', { message: err.email });
        }
      },
    });
  }

  return (
    <AuthCard
      title="パスワードをお忘れですか？"
      description="登録済みのメールアドレスを入力してください。新しいパスワードの設定に使う仮パスワードをお送りします。"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            rules={{ required: 'メールアドレスを入力してください' }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>メールアドレス</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? '送信中...' : '仮パスワードを送信'}
          </Button>
          {sent && (
            <div className="rounded-lg bg-primary-50 p-4 text-ink">
              <p>メールに記載された仮パスワードで、新しいパスワードを設定してください。</p>
              <Link
                href={resetPassword.url()}
                className="mt-2 inline-block text-primary-700 hover:underline"
              >
                仮パスワードを入力する
              </Link>
            </div>
          )}
          <div className="mt-2 flex justify-center">
            <Link href={login.url()} className="text-primary-700 hover:underline">
              ログインに戻る
            </Link>
          </div>
        </form>
      </Form>
    </AuthCard>
  );
}
