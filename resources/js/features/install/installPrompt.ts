/** TypeScript の DOM 型に無い。Chrome 系だけが持つイベント。 */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<unknown>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function setDeferredPrompt(event: BeforeInstallPromptEvent | null) {
  deferredPrompt = event;
  listeners.forEach((listener) => listener());
}

function handleBeforeInstallPrompt(event: Event) {
  event.preventDefault();
  setDeferredPrompt(event as BeforeInstallPromptEvent);
}

function handleAppInstalled() {
  setDeferredPrompt(null);
}

/** イベントは読み込み直後に一度だけ届くので、画面の部品が描かれる前に呼ぶ。 */
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
}

export function getInstallPrompt() {
  return deferredPrompt;
}

/** prompt() は1つのイベントにつき1回しか呼べないので、呼ぶ前に手放す。 */
export function takeInstallPrompt() {
  const event = deferredPrompt;
  setDeferredPrompt(null);

  return event;
}

export function subscribeInstallPrompt(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
