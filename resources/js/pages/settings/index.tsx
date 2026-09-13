import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faBox, faChevronRight, faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from '@inertiajs/react';
import profile from '@/routes/profile';
import stocks from '@/routes/stocks';
import { AppShell } from '@/shared/layouts/AppShell';

type MenuItem = {
  href: string;
  icon: IconDefinition;
  label: string;
  description: string;
};

const MENU_ITEMS: MenuItem[] = [
  {
    href: profile.edit.url(),
    icon: faUser,
    label: '個人情報の変更',
    description: 'ユーザ名・パスワード・世帯人数',
  },
  {
    href: stocks.index.url(),
    icon: faBox,
    label: 'ストック管理',
    description: '消費日数とストック数の登録',
  },
];

export default function Settings() {
  return (
    <AppShell title="設定" active="settings">
      <h1 className="mb-6 text-center text-xl font-bold text-ink md:hidden">設定</h1>

      <ul className="max-w-xl overflow-hidden rounded-xl border border-line bg-surface">
        {MENU_ITEMS.map(({ href, icon, label, description }) => (
          <li key={href} className="border-b border-line last:border-b-0">
            <Link href={href} className="flex items-center gap-4 p-4 hover:bg-primary-50">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                <FontAwesomeIcon icon={icon} className="h-4 w-4" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-ink">{label}</span>
                <span className="text-xs text-ink-muted">{description}</span>
              </span>
              <FontAwesomeIcon icon={faChevronRight} className="h-4 w-4 shrink-0 text-ink-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
