import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  confirmTwoFactor,
  disableTwoFactor,
  enableTwoFactor,
  regenerateRecoveryCodes,
} from '@/features/auth/api';
import settings from '@/routes/settings';
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
import { AppShell } from '@/shared/layouts/AppShell';

type Props = {
  status: 'disabled' | 'pending' | 'enabled';
  qrCodeSvg: string | null;
  secretKey: string | null;
  recoveryCodes: string[] | null;
};

export default function TwoFactor({ status, qrCodeSvg, secretKey, recoveryCodes }: Props) {
  const isDisabled = status === 'disabled';
  const isPending = status === 'pending';
  const isEnabled = status === 'enabled';

  const [processing, setProcessing] = useState(false);
  const form = useForm<{ code: string }>({
    defaultValues: {
      code: '',
    },
  });

  const handleEnable = () => {
    setProcessing(true);
    enableTwoFactor({ onFinish: () => setProcessing(false) });
  };

  const handleConfirm = (data: { code: string }) => {
    setProcessing(true);
    confirmTwoFactor(data, {
      onError: (err) => {
        if (err.code) {
          form.setError('code', { message: err.code });
        }
      },
      onFinish: () => setProcessing(false),
    });
  };

  const handleDisable = () => {
    setProcessing(true);
    disableTwoFactor({ onFinish: () => setProcessing(false) });
  };

  const handleRegenerate = () => {
    setProcessing(true);
    regenerateRecoveryCodes({ onFinish: () => setProcessing(false) });
  };

  return (
    <AppShell title="2段階認証設定の変更" active="settings" backHref={settings.index.url()}>
      <div className="max-w-xl">
        {isDisabled && (
          <>
            <p>ログインのときに、パスワードに加えて認証アプリのコードを入力します。</p>
            <Button type="button" disabled={processing} onClick={handleEnable} className="w-full">
              {processing ? '設定中...' : '2段階認証を有効にする'}
            </Button>
          </>
        )}
        {isPending && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleConfirm)} className="space-y-4">
              <p>認証アプリで、下の画像を読み取ってください。</p>
              {qrCodeSvg && (
                <div
                  className="mx-auto w-48 bg-white p-2"
                  dangerouslySetInnerHTML={{ __html: qrCodeSvg }}
                />
              )}
              <p>読み取れない場合は、次のキーを認証アプリに入力してください。</p>
              <p className="font-mono break-all select-all">{secretKey}</p>
              <FormField
                control={form.control}
                name="code"
                rules={{ required: '認証コードを入力してください' }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>認証アプリに表示されたコード</FormLabel>
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
              <Button type="submit" className="w-full" disabled={processing}>
                確かめて有効にする
              </Button>
              <Button
                type="button"
                variant="link"
                className="w-full"
                disabled={processing}
                onClick={handleDisable}
              >
                やめる
              </Button>
            </form>
          </Form>
        )}
        {isEnabled && (
          <div className="space-y-4">
            <p>
              スマホをなくして認証コードを見られないときに、ログインに使えます。1つにつき1回使えます。書き留めて保管してください。
            </p>
            <ul className="space-y-1 font-mono">
              {recoveryCodes?.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
            <Button
              type="button"
              className="w-full"
              disabled={processing}
              onClick={handleRegenerate}
            >
              コードの再生成
            </Button>
            <Button
              type="button"
              className="w-full"
              variant="destructive"
              disabled={processing}
              onClick={handleDisable}
            >
              2段階認証を無効にする
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
