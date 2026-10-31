import { useEffect, useState } from 'react';
import { needsManualInstall } from '@/shared/lib/displayMode';
import { destroyPushSubscription, storePushSubscription } from '../api';
import type { PushSubscriptionPayload } from '../api';

export type PushSubscriptionStatus = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';

export function usePushSubscription(vapidPublicKey: string) {
  const [status, setStatus] = useState<PushSubscriptionStatus>(readStatus);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    navigator.serviceWorker.getRegistration('/app/').then(async (registration) => {
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        setStatus('on');
      }
    });
  }, []);

  function readStatus(): PushSubscriptionStatus {
    if (!('serviceWorker' in navigator)) {
      return 'unsupported';
    }

    if (!('PushManager' in window) || !('Notification' in window)) {
      return needsManualInstall() ? 'needs-install' : 'unsupported';
    }

    if (Notification.permission === 'denied') {
      return 'denied';
    }

    return 'off';
  }

  async function subscribe() {
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      setStatus(permission === 'denied' ? 'denied' : 'off');

      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    storePushSubscription(subscription.toJSON() as PushSubscriptionPayload);
    setStatus('on');
  }

  async function unsubscribe() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration?.pushManager.getSubscription();

    if (subscription) {
      destroyPushSubscription(subscription.endpoint);
      await subscription.unsubscribe();
    }

    setStatus('off');
  }

  return {
    status,
    subscribe,
    unsubscribe,
  };
}

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);

  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}
