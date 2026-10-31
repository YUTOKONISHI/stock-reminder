import { router } from '@inertiajs/react';
import stocks from '@/routes/stocks';

type Errors = Record<string, string>;

export type StockPayload = {
  quantity: number;
  consumption_interval_days: number;
  next_purchase_date: string | null;
};

export function createStock(
  payload: StockPayload & { product_id: number },
  onError: (errors: Errors) => void,
) {
  router.post(stocks.store.url(), payload, { onError });
}

export function updateStock(id: number, payload: StockPayload, onError: (errors: Errors) => void) {
  router.put(stocks.update.url(id), payload, { onError });
}

export function deleteStock(id: number) {
  router.delete(stocks.destroy.url(id));
}

export function markStockAsPurchased(
  id: number,
  quantity: number,
  callbacks: { onSuccess: () => void; onError: (errors: Errors) => void },
) {
  router.patch(stocks.purchase.url(id), { quantity }, { preserveScroll: true, ...callbacks });
}
