import type { Category } from '@/shared/types/catalog';

type Props = {
  categories: Category[];
  selectedCategories: number[];
  onToggleCategory: (id: number) => void;
};

export function CategorySidebar({ categories, selectedCategories, onToggleCategory }: Props) {
  return (
    <aside className="w-48 shrink-0 overflow-y-auto border-r border-line p-4">
      <p className="mb-2 text-xs font-bold text-ink-muted">商品カテゴリー</p>
      <ul className="space-y-2">
        {categories.map((category) => (
          <li key={category.id}>
            <label className="flex cursor-pointer items-center gap-2 text-ink">
              <input
                type="checkbox"
                className="accent-primary-600"
                checked={selectedCategories.includes(category.id)}
                onChange={() => onToggleCategory(category.id)}
              />
              {category.name}
            </label>
          </li>
        ))}
      </ul>
    </aside>
  );
}
