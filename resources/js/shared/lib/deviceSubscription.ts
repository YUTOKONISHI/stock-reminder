/** 端末側の購読だけを解除する。サーバの行は消さない。 */
export async function unsubscribeDevice() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return;
  }

  const registration = await navigator.serviceWorker.getRegistration('/app/');
  const subscription = await registration?.pushManager.getSubscription();

  await subscription?.unsubscribe();
}
