export function isInstalledWindow() {
  return ['standalone', 'fullscreen'].some(
    (mode) => window.matchMedia(`(display-mode: ${mode})`).matches,
  );
}

/** ブラウザのダイアログが無く、ホーム画面への追加を手順で案内するしかない環境（iOS Safari のタブ）。 */
export function needsManualInstall() {
  return 'serviceWorker' in navigator && !('PushManager' in window) && !isInstalledWindow();
}
