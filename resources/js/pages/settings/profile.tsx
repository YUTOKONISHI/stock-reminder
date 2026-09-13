import { router, usePage } from '@inertiajs/react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import profile from '@/routes/profile';
import settings from '@/routes/settings';
import { Button } from '@/shared/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { AppShell } from '@/shared/layouts/AppShell';

type ProfileForm = {
  name: string;
  household_size: string;
  current_password: string;
  password: string;
  password_confirmation: string;
};

const FIELDS: (keyof ProfileForm)[] = [
  'name',
  'household_size',
  'current_password',
  'password',
  'password_confirmation',
];

export default function Profile() {
  const { auth } = usePage().props;
  const form = useForm<ProfileForm>({
    defaultValues: {
      name: auth.user.name,
      household_size: auth.user.household_size === null ? '' : String(auth.user.household_size),
      current_password: '',
      password: '',
      password_confirmation: '',
    },
  });
  const { isSubmitting } = form.formState;

  function onSubmit(data: ProfileForm) {
    const changesPassword = data.password !== '';
    const payload: Record<string, string | number | null> = {
      name: data.name,
      household_size: data.household_size === '' ? null : Number(data.household_size),
    };

    if (changesPassword) {
      payload.current_password = data.current_password;
      payload.password = data.password;
      payload.password_confirmation = data.password_confirmation;
    }

    router.put(profile.update.url(), payload, {
      onSuccess: () => {
        toast.success('保存しました');

        if (changesPassword) {
          form.resetField('current_password');
          form.resetField('password');
          form.resetField('password_confirmation');
        }
      },
      onError: (err) => {
        FIELDS.forEach((field) => {
          if (err[field]) {
            form.setError(field, { message: err[field] });
          }
        });
      },
    });
  }

  return (
    <AppShell title="個人情報の変更" active="settings" backHref={settings.index.url()}>
      <div className="max-w-xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              rules={{ required: 'ユーザ名を入力してください' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ユーザ名</FormLabel>
                  <FormControl>
                    <Input type="text" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4 border-t border-line pt-4">
              <p className="text-xs text-ink-muted">
                パスワードを変更しない場合は、以下の3欄を空のままにしてください。
              </p>
              <FormField
                control={form.control}
                name="current_password"
                rules={{
                  validate: (value) =>
                    form.getValues('password') === '' ||
                    value !== '' ||
                    '現在のパスワードを入力してください',
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>現在のパスワード</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                rules={{
                  minLength: { value: 8, message: 'パスワードは8文字以上で入力してください' },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>新しいパスワード</FormLabel>
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
                  validate: (value) =>
                    value === form.getValues('password') || 'パスワードが一致しません',
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>新しいパスワード（確認）</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="household_size"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>世帯人数</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} />
                  </FormControl>
                  <FormDescription>
                    消費日数の初期値の算出に使います。空のままでも保存できます。
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="pt-2">
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? '保存中...' : '保存'}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AppShell>
  );
}
