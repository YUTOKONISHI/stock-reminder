import { Link } from '@inertiajs/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { register } from '@/features/auth/api';
import { login } from '@/routes';
import { AuthCard } from '@/shared/components/AuthCard';
import { Turnstile } from '@/shared/components/Turnstile';
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

type RegisterForm = {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
};

type Props = {
  turnstileSiteKey: string;
};

export default function Register({ turnstileSiteKey }: Props) {
  const [turnstileAttempt, setTurnstileAttempt] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const form = useForm<RegisterForm>({
    defaultValues: { name: '', email: '', password: '', password_confirmation: '' },
  });
  const { isSubmitting } = form.formState;

  function onSubmit(data: RegisterForm) {
    if (!turnstileToken) {
      return;
    }

    setTurnstileError(null);
    register(
      { ...data, 'cf-turnstile-response': turnstileToken },
      {
        onError: (err) => {
          setTurnstileToken(null);
          setTurnstileAttempt((n) => n + 1);
          setTurnstileError(err['cf-turnstile-response'] ?? null);
          (['name', 'email', 'password'] as const).forEach((field) => {
            if (err[field]) {
              form.setError(field, { message: err[field] });
            }
          });
        },
      },
    );
  }

  return (
    <AuthCard title="新規登録">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            rules={{ required: '名前を入力してください' }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>名前</FormLabel>
                <FormControl>
                  <Input type="text" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
          <FormField
            control={form.control}
            name="password"
            rules={{
              required: 'パスワードを入力してください',
              minLength: { value: 8, message: 'パスワードは8文字以上で入力してください' },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>パスワード</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password_confirmation"
            rules={{
              required: 'パスワード確認を入力してください',
              validate: (value) =>
                value === form.getValues('password') || 'パスワードが一致しません',
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>パスワード確認</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div>
            <Turnstile
              key={turnstileAttempt}
              siteKey={turnstileSiteKey}
              action="register"
              onToken={setTurnstileToken}
            />
            {turnstileError && <p className="text-sm text-destructive">{turnstileError}</p>}
          </div>
          <Button type="submit" disabled={isSubmitting || !turnstileToken} className="w-full">
            {isSubmitting ? '登録中...' : '新規登録'}
          </Button>
          <div className="mt-2 flex justify-center">
            <Link href={login.url()} className="text-primary-700 hover:underline">
              ログインはこちら
            </Link>
          </div>
        </form>
      </Form>
    </AuthCard>
  );
}
