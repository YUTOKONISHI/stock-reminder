import {
  faClock,
  faLock,
  faMagnifyingGlass,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Head, Link } from '@inertiajs/react';
import { Button } from '@/shared/components/ui/button';

type Props = {
  code: number;
};

const getErrorInformation = (code: number) => {
  switch (code) {
    case 403:
      return {
        icon: faLock,
        iconClass: 'bg-primary-100 text-primary-700',
        title: 'このページは開くことができません',
        message: 'ログイン中のアカウントには、このページを表示する権限がありません。',
      };
    case 404:
      return {
        icon: faMagnifyingGlass,
        iconClass: 'bg-primary-100 text-primary-700',
        title: 'ページが見つかりません',
        message: 'URLが間違っているか、ページが削除された可能性があります。',
      };
    case 419:
      return {
        icon: faClock,
        iconClass: 'bg-warning-50 text-warning-600',
        title: 'ページの有効期限が切れました',
        message:
          'しばらく操作がなかったため、送信できませんでした。ページを読み込みなおしてから、もう1度お試しください。',
      };
    default:
      return {
        icon: faTriangleExclamation,
        iconClass: 'bg-danger-50 text-danger-600',
        title: '問題が発生しました',
        message:
          'サーバーで問題が発生したため、処理を完了できませんでした。時間をおいて、もう1度お試しください。',
      };
  }
};

export default function ErrorPage({ code }: Props) {
  const { icon, iconClass, title, message } = getErrorInformation(code);
  const canRetry = code !== 403 && code !== 404;
  const dashboardUrl = window.location.pathname.startsWith('/admin/')
    ? '/admin/dashboard'
    : '/app/dashboard';

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <Head title={title} />

      <header className="flex h-14 items-center gap-2 border-b border-line bg-surface px-4">
        <img src="/icons/icon-192.png" alt="" width={28} height={28} className="h-7 w-7" />
        <span className="font-bold">ストック管理アプリ</span>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className={`flex size-18 items-center justify-center rounded-full ${iconClass}`}>
              <FontAwesomeIcon icon={icon} className="text-3xl" />
            </div>
            <span className="font-numeric text-xs font-medium tracking-widest text-ink-muted">
              {code}
            </span>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-ink-muted">{message}</p>
          </div>

          <div className="flex flex-col gap-3">
            {canRetry && (
              <Button
                size="lg"
                className="w-full text-base font-bold"
                onClick={() => window.location.reload()}
              >
                読み込みなおす
              </Button>
            )}
            <Button
              asChild
              size="lg"
              variant={canRetry ? 'outline' : 'default'}
              className="w-full text-base font-bold"
            >
              <Link href={dashboardUrl}>ダッシュボードへ戻る</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
