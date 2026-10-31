import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';
import { createInertiaApp } from '@inertiajs/react';
import { captureInstallPrompt } from '@/features/install/installPrompt';

/* FontAwesome は既定で実行時に <style> を差し込む。Vite が上の styles.css を先に配るので
 * 二重になり、差し込みが間に合わない一瞬だけアイコンが原寸で出る。 */
config.autoAddCss = false;

captureInstallPrompt();

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
  title: (title) => (title ? `${title} - ${appName}` : appName),
  progress: {
    /* app.css の --color-primary-600 と同値。 */
    color: '#5a7550',
  },
});

if (import.meta.env.PROD && 'serviceWorker' in navigator && location.pathname.startsWith('/app/')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/app/sw.js');
  });
}
