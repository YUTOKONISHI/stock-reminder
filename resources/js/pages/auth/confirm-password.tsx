import { useForm } from 'react-hook-form';
import { confirmPassword } from '@/features/auth/api';
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

type PasswordConfirmationForm = {
  password: string;
};

export default function ConfirmPassword() {
  const form = useForm<PasswordConfirmationForm>({ defaultValues: { password: '' } });
  const { isSubmitting } = form.formState;

  function onSubmit(data: PasswordConfirmationForm) {
    confirmPassword(data, {
      onError: (err) => {
        if (err.password) {
          form.setError('password', { message: err.password });
        }
      },
    });
  }

  return (
    <AuthCard title="パスワード確認">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <p className="text-sm text-ink-muted">
            続けるには、パスワードをもう一度入力してください。
          </p>
          <FormField
            control={form.control}
            name="password"
            rules={{
              required: 'パスワードを入力してください',
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
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? '送信中...' : '送信'}
          </Button>
        </form>
      </Form>
    </AuthCard>
  );
}
