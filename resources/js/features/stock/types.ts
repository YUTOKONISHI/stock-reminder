import type { Product } from '@/shared/types/catalog';

export type StockFormProduct = Product & { initial_consumption_interval_days: number };

export type Stock = {
  id: number;
  product: Product;
  quantity: number;
  consumption_interval_days: number;
  next_purchase_date: string;
  last_purchased_on: string | null;
};
