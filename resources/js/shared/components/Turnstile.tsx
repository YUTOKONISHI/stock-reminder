import { useEffect, useRef, useState } from 'react';

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      language: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
      } else {
        reject(new Error('turnstile is not defined'));
      }
    };
    script.onerror = () => {
      script.remove();
      loading = null;
      reject(new Error('failed to load turnstile'));
    };
    document.head.appendChild(script);
  });

  return loading;
}

type Props = {
  siteKey: string;
  action: string;
  onToken: (token: string | null) => void;
};

export function Turnstile({ siteKey, action, onToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<{ api: TurnstileApi; id: string } | null>(null);
  const onTokenRef = useRef(onToken);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onTokenRef.current = onToken;
  });

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled || !containerRef.current) {
          return;
        }

        const id = api.render(containerRef.current, {
          sitekey: siteKey,
          action,
          language: 'ja',
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        });
        widgetRef.current = { api, id };
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
      const widget = widgetRef.current;

      if (widget) {
        widget.api.remove(widget.id);
        widgetRef.current = null;
      }
    };
  }, [siteKey, action]);

  return (
    <div>
      <div ref={containerRef} />
      {failed && (
        <p className="text-sm text-destructive">
          確認の読み込みに失敗しました。ページを再読み込みしてください。
        </p>
      )}
    </div>
  );
}
