import { useCategoryManagement } from '@/features/admin/hooks/useCategoryManagement';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import type { AdminCategory } from '../types';

type Props = {
  open: boolean;
  onClose: () => void;
  categories: AdminCategory[];
};

export function CategoryManageDialog({ open, onClose, categories }: Props) {
  const {
    newName,
    setNewName,
    editingId,
    editingName,
    setEditingName,
    add,
    edit,
    cancelEdit,
    update,
    remove,
  } = useCategoryManagement();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>カテゴリ管理</DialogTitle>
        </DialogHeader>

        <ul className="divide-y divide-line">
          {categories.map((category) => (
            <li key={category.id} className="py-2">
              {editingId === category.id ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="h-8"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={editingName.trim() === ''}
                    onClick={update}
                  >
                    保存
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={cancelEdit}>
                    取消
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-ink">{category.name}</span>
                  <span className="text-xs text-ink-muted">商品{category.products_count}件</span>
                  <Button type="button" size="sm" onClick={() => edit(category)}>
                    変更
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={category.products_count > 0}
                    title={
                      category.products_count > 0
                        ? '商品が登録されているため削除できません'
                        : undefined
                    }
                    className="text-danger-600 hover:bg-danger-50"
                    onClick={() => remove(category.id)}
                  >
                    削除
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2 pt-2">
          <Input
            placeholder="新しいカテゴリ名"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-8"
          />
          <Button type="button" size="sm" disabled={newName.trim() === ''} onClick={add}>
            追加
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            閉じる
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
