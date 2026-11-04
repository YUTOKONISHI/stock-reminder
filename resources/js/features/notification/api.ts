import { router } from '@inertiajs/react';
import notifications from '@/routes/notifications';
import pushSubscriptions from '@/routes/push-subscriptions';

export type PushSubscriptionPayload = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export function storePushSubscription(payload: PushSubscriptionPayload) {
  return new Promise<boolean>((resolve) => {
    let saved = false;
    router.post(pushSubscriptions.store.url(), payload, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => {
        saved = true;
      },
      onFinish: () => resolve(saved),
    });
  });
}

export function destroyPushSubscription(endpoint: string) {
  return new Promise<boolean>((resolve) => {
    let destroyed = false;

    router.delete(pushSubscriptions.destroy.url(), {
      data: { endpoint },
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => {
        destroyed = true;
      },
      onFinish: () => resolve(destroyed),
    });
  });
}

export function markNotificationAsRead(id: number, onSuccess: () => void) {
  router.patch(notifications.read.url(id), {}, { preserveScroll: true, onSuccess });
}

export function markNotificationAsUnread(id: number) {
  router.patch(notifications.unread.url(id), {}, { preserveScroll: true });
}

export function markAllNotificationsAsRead(onRead: (ids: number[]) => void) {
  router.patch(
    notifications.readAll.url(),
    {},
    {
      preserveScroll: true,
      onFlash: ({ readIds }) => {
        if (readIds !== undefined) {
          onRead(readIds);
        }
      },
    },
  );
}

export function markNotificationsAsUnread(ids: number[]) {
  router.patch(notifications.unreadMany.url(), { ids }, { preserveScroll: true });
}
