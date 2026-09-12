import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBell,
  faChevronLeft,
  faGear,
  faHouse,
  faRightFromBracket,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Head, Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { dashboard } from '@/routes';
import notifications from '@/routes/notifications';
import settings from '@/routes/settings';
import { Toaster } from '@/shared/components/ui/sonner';
import { logout } from '@/shared/lib/auth';

const NAV_ITEMS = [
  /* ラベルはフッターの1枠に収まる長さにする。「ダッシュボード」は 320px 幅で2行に折れて
   * フッターの高さが変わる。画面名はヘッダーと見出しに出ているので、ここで繰り返さない。 */
  { key: 'dashboard', href: dashboard.url(), icon: faHouse, label: 'ホーム' },
  { key: 'notifications', href: notifications.index.url(), icon: faBell, label: '通知' },
  { key: 'settings', href: settings.index.url(), icon: faGear, label: '設定' },
] as const;

const HEADER_ITEMS = NAV_ITEMS.filter((item) => item.key !== 'dashboard');

type NavItem = (typeof NAV_ITEMS)[number];

type NavKey = NavItem['key'];

type Variant = 'header' | 'bottom';

function navClass(variant: Variant, isActive: boolean): string {
  /* ボタンの幅はラベルの字数で変わる（「ダッシュボード」と「通知」）。flex-1 で
   * 4等分しないと、justify-around では各ボタンの中心がずれて見える。 */
  const layout = variant === 'bottom' ? 'flex flex-1 flex-col items-center gap-1 ' : '';

  if (isActive) {
    return `${layout}text-primary-600`;
  }

  return `${layout}text-ink-muted${variant === 'header' ? ' hover:text-ink' : ''}`;
}

function NavContent({
  icon,
  label,
  variant,
}: {
  icon: IconDefinition;
  label: string;
  variant: Variant;
}) {
  return (
    <>
      <FontAwesomeIcon icon={icon} className="h-5 w-5" />
      {variant === 'bottom' && <span className="text-xs whitespace-nowrap">{label}</span>}
    </>
  );
}

function NavItemView({
  item,
  isActive,
  variant,
}: {
  item: NavItem;
  isActive: boolean;
  variant: Variant;
}) {
  const { href, icon, label } = item;
  const content = <NavContent icon={icon} label={label} variant={variant} />;

  if (isActive) {
    return (
      <span aria-current="page" title={label} className={navClass(variant, true)}>
        {content}
      </span>
    );
  }

  return (
    <Link href={href} title={label} className={navClass(variant, false)}>
      {content}
    </Link>
  );
}

function LogoutButton({ variant, onClick }: { variant: Variant; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title="ログアウト" className={navClass(variant, false)}>
      <NavContent icon={faRightFromBracket} label="ログアウト" variant={variant} />
    </button>
  );
}

type Props = {
  title: string;
  active: NavKey;
  children: ReactNode;
  /** 下の階層の画面で、親へ戻る先。渡すと画面名の見出しもこの層で出す */
  backHref?: string;
};

export function AppShell({ title, active, children, backHref }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Head title={title} />

      <Toaster position="top-center" />

      <header className="hidden border-b border-line bg-surface md:block">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            {backHref && (
              <Link
                href={backHref}
                aria-label="前の画面に戻る"
                className="text-ink-muted hover:text-ink"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="h-5 w-5" />
              </Link>
            )}
            <h1 className="text-xl font-bold text-ink">{title}</h1>
          </div>
          <div className="flex items-center gap-4">
            {HEADER_ITEMS.map((item) => (
              <NavItemView
                key={item.key}
                item={item}
                isActive={active === item.key}
                variant="header"
              />
            ))}
            <LogoutButton variant="header" onClick={logout} />
          </div>
        </div>
      </header>

      <main className="flex-1 pb-24 md:pb-8">
        <div className="mx-auto w-full max-w-5xl px-4 pt-6 md:px-6">
          {backHref && (
            /* 戻る矢印と同じ幅の箱を右にも置いて、見出しを画面の中央に揃える */
            <div className="mb-6 flex items-center md:hidden">
              <Link href={backHref} aria-label="前の画面に戻る" className="w-8 text-ink-muted">
                <FontAwesomeIcon icon={faChevronLeft} className="h-5 w-5" />
              </Link>
              <h1 className="flex-1 text-center text-xl font-bold text-ink">{title}</h1>
              <span className="w-8" aria-hidden />
            </div>
          )}
          {children}
        </div>
      </main>

      <nav className="fixed right-0 bottom-0 left-0 border-t border-line bg-surface md:hidden">
        <div className="flex py-2">
          {NAV_ITEMS.map((item) => (
            <NavItemView
              key={item.key}
              item={item}
              isActive={active === item.key}
              variant="bottom"
            />
          ))}
          <LogoutButton variant="bottom" onClick={logout} />
        </div>
      </nav>
    </div>
  );
}
