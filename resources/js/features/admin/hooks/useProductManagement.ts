import { useState } from 'react';
import { toast } from 'sonner';
import type { Product } from '@/shared/types/catalog';
import { createProduct, deleteProduct, updateProduct } from '../api';
import type { EditingProduct, NewProduct } from '../types';

const EMPTY_PRODUCT: NewProduct = {
  name: '',
  category_id: 0,
  default_consumption_interval_days: null,
};

export function useProductManagement() {
  const [newProduct, setNewProduct] = useState<NewProduct>(EMPTY_PRODUCT);
  const [showNewRow, setShowNewRow] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingProduct, setEditingProduct] = useState<EditingProduct | null>(null);

  function remove(id: number) {
    deleteProduct(id, {
      onError: (errors) => {
        toast.error(errors.delete ?? '商品削除に失敗しました');
      },
    });
  }

  function edit(product: Product) {
    setEditingId(product.id);
    setEditingProduct({ ...product });
  }

  function update() {
    if (!editingProduct) {
      return;
    }

    updateProduct(editingProduct, {
      onSuccess: () => {
        setEditingId(null);
        setEditingProduct(null);
      },
      onError: (errors) => {
        toast.error(errors.name ?? '商品情報の更新に失敗しました');
      },
    });
  }

  function add() {
    if (
      !newProduct.name ||
      newProduct.category_id === 0 ||
      newProduct.default_consumption_interval_days === null
    ) {
      return;
    }

    createProduct(newProduct, {
      onSuccess: () => {
        setNewProduct(EMPTY_PRODUCT);
        setShowNewRow(false);
      },
      onError: (errors) => {
        toast.error(errors.name ?? '商品登録に失敗しました');
      },
    });
  }

  return {
    newProduct,
    setNewProduct,
    showNewRow,
    setShowNewRow,
    editingId,
    editingProduct,
    setEditingProduct,
    add,
    edit,
    update,
    remove,
  };
}
