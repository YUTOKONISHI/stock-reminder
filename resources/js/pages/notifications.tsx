import { faBell } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { toast } from 'sonner';
import { AddToHomeScreenSteps } from '@/features/install/components/AddToHomeScreenSteps';
import { markNotificationAsRead, markNotificationAsUnread } from '@/features/notification/api';
import { usePushSubscription } from '@/features/notification/hooks/usePushSubscription';
import type { PushSubscriptionStatus } from '@/features/notification/hooks/usePushSubscription';
import type { NotificationLog } from '@/features/notification/types';
import { Pagination } from '@/shared/components/Pagination';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Switch } from '@/shared/components/ui/switch';
import { AppShell } from '@/shared/layouts/AppShell';
import { formatDate } from '@/shared/lib/date';
import type { Paginated } from '@/shared/types/pagination';

const DISABLED_REASONS: Partial<Record<PushSubscriptionStatus, string>> = {
  unsupported: 'このブラウザはPush通知に対応していません',
  denied: '通知がブロックされています。端末またはブラウザの設定から許可してください',
};

type Props = {
  notifications: Paginated<NotificationLog>;
  vapidPublicKey: string;
};

export default function Notifications({ notifications, vapidPublicKey }: Props) {
  const {
    status: subscriptionStatus,
    subscribe,
    unsubscribe,
  } = usePushSubscription(vapidPublicKey);
  const subscribed = subscriptionStatus === 'on';
  const disabled = subscriptionStatus !== 'off' && subscriptionStatus !== 'on';
  const needsInstall = subscriptionStatus === 'needs-install';
  const disabledReason = DISABLED_REASONS[subscriptionStatus];

  function markAsRead(notification: NotificationLog) {
    markNotificationAsRead(notification.id, () => {
      toast.success('既読にしました', {
        action: {
          label: '元に戻す',
          onClick: () => markNotificationAsUnread(notification.id),
        },
      });
    });
  }

  return (
    <AppShell title="Push通知" active="notifications">
      <h1 className="mb-6 text-center text-xl font-bold text-ink md:hidden">Push通知</h1>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-bold text-ink">通知設定</h2>
        <Card>
          <CardContent className="flex items-center justify-between gap-4">
            <label htmlFor="push-enabled" className="flex flex-col">
              <span className="text-ink">通知を有効にする</span>
              <span className="text-xs text-ink-muted">買う日の朝9時に届きます</span>
            </label>
            <Switch
              id="push-enabled"
              checked={subscribed}
              disabled={disabled}
              onCheckedChange={(next) => (next ? subscribe() : unsubscribe())}
            />
          </CardContent>
          {needsInstall && (
            <CardContent>
              <div className="rounded-lg bg-primary-50 p-4 text-sm text-ink">
                <AddToHomeScreenSteps
                  title="ホーム画面に追加すると通知を受け取れます"
                  openStep="追加したアイコンから開き、ここで通知を有効にする"
                />
              </div>
            </CardContent>
          )}
          {disabledReason !== undefined && (
            <CardContent>
              <p className="text-xs text-ink-muted">{disabledReason}</p>
            </CardContent>
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold text-ink">未読の通知</h2>
        {notifications.data.length === 0 ? (
          <p className="text-ink-muted">未読の通知はありません</p>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-line bg-surface">
            {notifications.data.map((notification) => (
              <li
                key={notification.id}
                className="flex items-start gap-4 border-b border-line p-4 last:border-b-0"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-urgent-50 text-urgent-700">
                  <FontAwesomeIcon icon={faBell} className="h-4 w-4" />
                </span>

                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium text-ink">{notification.title}</span>
                  <span className="text-xs text-ink-muted">{notification.description}</span>
                  <span className="mt-2 font-numeric text-xs text-ink-muted">
                    {formatDate(notification.created_at)}
                  </span>
                </span>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`「${notification.title}」を既読にする`}
                  onClick={() => markAsRead(notification)}
                >
                  既読
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Pagination meta={notifications} />
      </section>
    </AppShell>
  );
}
