import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button } from '@/shared/components/ui/button';
import { useInstallCard } from '../hooks/useInstallCard';
import { AddToHomeScreenSteps } from './AddToHomeScreenSteps';

export function InstallCard() {
  const { kind, install, dismiss } = useInstallCard();

  if (kind === null) {
    return null;
  }

  return (
    /* スマホの bottom-20 は AppShell の下部タブの高さを避ける値。 */
    <aside
      aria-label="アプリのインストール"
      className="fixed inset-x-4 bottom-20 z-40 rounded-xl border border-line bg-surface p-4 text-sm text-ink shadow-lg motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 md:right-6 md:bottom-6 md:left-auto md:w-96"
    >
      {kind === 'prompt' ? (
        <>
          <p className="font-medium">アプリとしてインストールしますか？</p>
          <p className="mt-1 text-xs text-ink-muted">アイコンからすぐに開けるようになります</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={dismiss}>
              今はしない
            </Button>
            <Button type="button" onClick={install}>
              インストール
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <AddToHomeScreenSteps
              title="ホーム画面に追加すると、アプリのように開けて通知も受け取れます"
              openStep="追加したアイコンから開く"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="閉じる"
            onClick={dismiss}
          >
            <FontAwesomeIcon icon={faXmark} />
          </Button>
        </div>
      )}
    </aside>
  );
}
