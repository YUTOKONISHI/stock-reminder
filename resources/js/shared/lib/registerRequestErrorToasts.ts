import { router } from '@inertiajs/react';
import { toast } from 'sonner';

export function registerRequestErrorToasts() {
  router.on('networkError', (event) => {
    event.preventDefault();
    toast.error('通信できませんでした', {
      description: '接続を確認して、もう一度お試しください。',
    });
  });

  router.on('httpException', (event) => {
    event.preventDefault();
    toast.error('エラーが発生しました。');
  });
}
