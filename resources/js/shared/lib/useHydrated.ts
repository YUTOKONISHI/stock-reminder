import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** SSR と hydration 中の描画では false、それ以外では true。 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
