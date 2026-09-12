import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useProductManagement } from '@/features/admin/hooks/useProductManagement';
import { Button } from '@/shared/components/ui/button';
import type { Category } from '@/shared/types/catalog';
import type { AdminProduct } from '../types';

type Props = {
  products: AdminProduct[];
  categories: Category[];
};

function toDays(value: string): number | null {
  if (value === '') {
    return null;
  }

  const days = Number(value);

  return Number.isNaN(days) ? null : days;
}

export function ProductTable({ products, categories }: Props) {
  const {
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
  } = useProductManagement();

  return (
    <div className="flex-1 p-6">
      <table className="w-full">
        <thead>
          <tr className="border-b border-line text-ink-muted">
            <th className="w-1/3 py-2 text-left font-medium">商品名</th>
            <th className="w-1/4 py-2 text-left font-medium">商品カテゴリ</th>
            <th className="w-1/6 py-2 text-left font-medium">消費間隔（日）</th>
            <th className="py-2 text-left font-medium">変更・削除</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="border-b border-line">
              <td className="py-2">
                {editingId === product.id ? (
                  <input
                    type="text"
                    value={editingProduct?.name}
                    onChange={(e) =>
                      setEditingProduct((prev) => (prev ? { ...prev, name: e.target.value } : null))
                    }
                    className="w-full border-b border-line-strong focus:border-primary-600 focus:outline-none"
                  />
                ) : (
                  <span className="text-ink">{product.name}</span>
                )}
              </td>
              <td className="py-2">
                {editingId === product.id ? (
                  <select
                    value={editingProduct?.category_id}
                    onChange={(e) =>
                      setEditingProduct((prev) =>
                        prev ? { ...prev, category_id: Number(e.target.value) } : null,
                      )
                    }
                    className="w-full border-b border-line-strong focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-ink">
                    {categories.find((c) => c.id === product.category_id)?.name}
                  </span>
                )}
              </td>
              <td className="py-2">
                {editingId === product.id ? (
                  <input
                    type="number"
                    min="1"
                    value={editingProduct?.default_consumption_interval_days ?? ''}
                    onChange={(e) =>
                      setEditingProduct((prev) =>
                        prev
                          ? { ...prev, default_consumption_interval_days: toDays(e.target.value) }
                          : null,
                      )
                    }
                    className="w-full border-b border-line-strong focus:border-primary-600 focus:outline-none"
                  />
                ) : (
                  <span className="text-ink">
                    {product.default_consumption_interval_days ?? '未設定'}
                  </span>
                )}
              </td>
              <td className="py-2">
                {editingId === product.id ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      editingProduct?.name === '' ||
                      editingProduct?.category_id === 0 ||
                      editingProduct?.default_consumption_interval_days === null
                    }
                    onClick={update}
                  >
                    保存
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => edit(product)}>
                      変更
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={product.stocks_count > 0}
                      title={
                        product.stocks_count > 0
                          ? '利用者のストックに登録されているため削除できません'
                          : undefined
                      }
                      onClick={() => remove(product.id)}
                      className="border-danger-600 text-danger-600 hover:bg-danger-50"
                    >
                      削除
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {showNewRow && (
            <tr className="border-b border-line">
              <td className="py-2">
                <input
                  type="text"
                  placeholder="入力してください"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full border-b border-line-strong placeholder-ink-muted focus:border-primary-600 focus:outline-none"
                />
              </td>
              <td className="py-2">
                <select
                  value={newProduct.category_id}
                  onChange={(e) =>
                    setNewProduct((prev) => ({ ...prev, category_id: Number(e.target.value) }))
                  }
                  className="w-full border-b border-line-strong focus:outline-none"
                >
                  <option value={0}>選択してください</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-2">
                <input
                  type="number"
                  min="1"
                  placeholder="入力してください"
                  value={newProduct.default_consumption_interval_days ?? ''}
                  onChange={(e) =>
                    setNewProduct((prev) => ({
                      ...prev,
                      default_consumption_interval_days: toDays(e.target.value),
                    }))
                  }
                  className="w-full border-b border-line-strong placeholder-ink-muted focus:border-primary-600 focus:outline-none"
                />
              </td>
              <td className="py-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    newProduct.name === '' ||
                    newProduct.category_id === 0 ||
                    newProduct.default_consumption_interval_days === null
                  }
                  onClick={add}
                >
                  登録
                </Button>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-8 flex justify-end">
        <Button type="button" size="sm" onClick={() => setShowNewRow(true)}>
          <FontAwesomeIcon icon={faPlus} />
          追加
        </Button>
      </div>
    </div>
  );
}
