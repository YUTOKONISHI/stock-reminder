import { Link } from '@inertiajs/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { login } from '@/features/auth/api';
import { forgotPassword, register } from '@/routes';
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

type LoginForm = {
  email: string;
  password: string;
};

export default function Login() {
  const form = useForm<LoginForm>({ defaultValues: { email: '', password: '' } });
  const { isSubmitting } = form.formState;
  const [authError, setAuthError] = useState<string | null>(null);

  function onSubmit(data: LoginForm) {
    setAuthError(null);

    login(data, {
      onError: (err) => {
        if (err.auth_error) {
          setAuthError(err.auth_error);

          return;
        }

        if (err.email) {
          form.setError('email', { message: err.email });
        }

        if (err.password) {
          form.setError('password', { message: err.password });
        }
      },
    });
  }

  return (
    <AuthCard title="ログイン">
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
          {authError && <p className="text-danger-600">{authError}</p>}
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'ログイン中...' : 'ログイン'}
          </Button>
          <div className="mt-2 flex flex-col items-center gap-2">
            <Link href={register.url()} className="text-primary-700 hover:underline">
              新規登録はこちら
            </Link>
            <Link href={forgotPassword.url()} className="text-xs text-primary-700 hover:underline">
              パスワードをお忘れですか？
            </Link>
          </div>
        </form>
      </Form>
    </AuthCard>
  );
}
