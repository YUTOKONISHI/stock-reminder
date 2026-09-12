import type { ReactNode } from 'react';
import { Toaster } from '@/shared/components/ui/sonner';

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function AuthCard({ title, description, children }: Props) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-8">
      <Toaster position="top-center" />

      <div className="mb-6 flex flex-col items-center gap-2">
        <img src="/icons/icon-192.png" alt="" width={56} height={56} className="h-14 w-14" />
        <span className="text-xs text-ink-muted">ストック管理アプリ</span>
      </div>

      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6">
        <h1 className={`text-2xl font-bold text-ink ${description ? 'mb-2' : 'mb-6'}`}>{title}</h1>
        {description && <p className="mb-6 text-ink-muted">{description}</p>}
        {children}
      </div>
    </div>
  );
}
