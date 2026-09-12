import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faBell, faCalendarDays, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Head, Link } from '@inertiajs/react';
import { login } from '@/routes';
import { Button } from '@/shared/components/ui/button';

type Step = {
  icon: IconDefinition;
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    icon: faPlus,
    title: '買ったときに登録する',
    description: '切らすと困るものを、ストック数と一緒に入れておく。',
  },
  {
    icon: faCalendarDays,
    title: '次に買う日が決まる',
    description: 'ストック数と消費日数から、自動で計算する。',
  },
  {
    icon: faBell,
    title: 'その日の朝に知らせる',
    description: '買う日が来たら通知が届く。',
  },
];

export default function Welcome() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-8">
      <Head title="ストック管理アプリ" />

      <main className="flex w-full max-w-sm flex-col items-center text-center">
        {/* アイコンは角丸22%で焼いてあるので、円に切ると意匠の角が削れる */}
        <img src="/icons/icon-192.png" alt="" width={96} height={96} className="h-24 w-24" />

        <p className="mt-6 text-xs text-ink-muted">うっかり買い忘れをなくそう</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">ストック管理アプリ</h1>

        <ul className="mt-8 flex w-full flex-col gap-4">
          {STEPS.map(({ icon, title, description }) => (
            <li key={title} className="flex items-start gap-4 text-left">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                <FontAwesomeIcon icon={icon} className="h-5 w-5" />
              </span>
              <span className="flex flex-col">
                <span className="font-medium text-ink">{title}</span>
                <span className="text-xs text-ink-muted">{description}</span>
              </span>
            </li>
          ))}
        </ul>

        <Button asChild className="mt-8 w-full">
          <Link href={login.url()}>利用開始</Link>
        </Button>
      </main>
    </div>
  );
}
