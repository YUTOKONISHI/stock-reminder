import { useState, useSyncExternalStore } from 'react';
import { needsManualInstall } from '@/shared/lib/displayMode';
import { getInstallPrompt, subscribeInstallPrompt, takeInstallPrompt } from '../installPrompt';

const DISMISSED_KEY = 'install-card-dismissed';

export type InstallCardKind = 'prompt' | 'manual' | null;

/* サイトのデータを無効にしたブラウザでは localStorage の参照自体が例外を投げる。 */
function readDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) !== null;
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    /* 覚えられなければ、次に開いたときにまた出るだけ。 */
  }
}

export function useInstallCard() {
  const installPrompt = useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt);
  const [dismissed, setDismissed] = useState(readDismissed);

  function dismiss() {
    writeDismissed();
    setDismissed(true);
  }

  async function install() {
    const event = takeInstallPrompt();

    if (event === null) {
      return;
    }

    await event.prompt();
    const { outcome } = await event.userChoice;

    if (outcome === 'dismissed') {
      dismiss();
    }
  }

  let kind: InstallCardKind = null;

  if (!dismissed) {
    if (installPrompt !== null) {
      kind = 'prompt';
    } else if (needsManualInstall()) {
      kind = 'manual';
    }
  }

  return { kind, install, dismiss };
}
