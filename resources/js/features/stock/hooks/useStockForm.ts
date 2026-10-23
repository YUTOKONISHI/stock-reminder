import { useMemo, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toDateInputValue } from '@/shared/lib/date';
import type { Category } from '@/shared/types/catalog';
import { createStock, deleteStock, updateStock } from '../api';
import type { StockPayload } from '../api';
import type { Stock, StockFormProduct } from '../types';

export type StockFormValues = {
  category_id: string;
  product_id: string;
  quantity: string;
  consumption_interval_days: string;
  next_purchase_date: string;
};

type Params = {
  stock: Stock | null;
  products: StockFormProduct[];
};

const FIELDS: (keyof StockFormValues)[] = [
  'product_id',
  'quantity',
  'consumption_interval_days',
  'next_purchase_date',
];

function stockFormDefaults(stock: Stock | null): StockFormValues {
  if (stock === null) {
    return {
      category_id: '',
      product_id: '',
      quantity: '',
      consumption_interval_days: '',
      next_purchase_date: '',
    };
  }

  return {
    category_id: String(stock.product.category.id),
    product_id: String(stock.product.id),
    quantity: String(stock.quantity),
    consumption_interval_days: String(stock.consumption_interval_days),
    next_purchase_date: toDateInputValue(stock.next_purchase_date),
  };
}

export function useStockForm({ stock, products }: Params) {
  const form = useForm<StockFormValues>({ defaultValues: stockFormDefaults(stock) });
  const categoryId = useWatch({ control: form.control, name: 'category_id' });
  const isEdit = stock !== null;
  const intervalEdited = useRef(false);

  const categories = useMemo(() => {
    const unique = new Map<number, Category>();

    products.forEach((product) => unique.set(product.category.id, product.category));

    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }, [products]);

  const visibleProducts = useMemo(
    () =>
      categoryId === ''
        ? []
        : products.filter((product) => String(product.category_id) === categoryId),
    [products, categoryId],
  );

  function markIntervalEdited() {
    intervalEdited.current = true;
  }

  function handleCategoryChange() {
    form.setValue('product_id', '');
  }

  function handleProductChange(productId: string) {
    if (intervalEdited.current) {
      return;
    }

    const product = products.find((candidate) => String(candidate.id) === productId);
    const days = product?.initial_consumption_interval_days;

    form.setValue(
      'consumption_interval_days',
      days === null || days === undefined ? '' : String(days),
    );
  }

  function applyErrors(errors: Record<string, string>) {
    FIELDS.forEach((field) => {
      if (errors[field]) {
        form.setError(field, { message: errors[field] });
      }
    });
  }

  function submit(values: StockFormValues) {
    const payload: StockPayload = {
      quantity: Number(values.quantity),
      consumption_interval_days: Number(values.consumption_interval_days),
      next_purchase_date: values.next_purchase_date === '' ? null : values.next_purchase_date,
    };

    if (stock !== null) {
      updateStock(stock.id, payload, applyErrors);

      return;
    }

    createStock({ ...payload, product_id: Number(values.product_id) }, applyErrors);
  }

  function remove() {
    if (stock === null) {
      return;
    }

    deleteStock(stock.id);
  }

  return {
    form,
    isEdit,
    hasCategory: categoryId !== '',
    categories,
    visibleProducts,
    markIntervalEdited,
    handleCategoryChange,
    handleProductChange,
    submit,
    remove,
  };
}
