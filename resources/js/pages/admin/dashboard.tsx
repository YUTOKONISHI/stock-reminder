import { useState } from 'react';
import { AdminHeader } from '@/features/admin/components/AdminHeader';
import { CategoryManageDialog } from '@/features/admin/components/CategoryManageDialog';
import { CategorySidebar } from '@/features/admin/components/CategorySidebar';
import { PasswordChangeDialog } from '@/features/admin/components/PasswordChangeDialog';
import { ProductTable } from '@/features/admin/components/ProductTable';
import { useCategoryFilter } from '@/features/admin/hooks/useCategoryFilter';
import type { AdminCategory, AdminProduct } from '@/features/admin/types';
import { Pagination } from '@/shared/components/Pagination';
import { Toaster } from '@/shared/components/ui/sonner';
import type { Paginated } from '@/shared/types/pagination';

type Props = {
  products: Paginated<AdminProduct>;
  categories: AdminCategory[];
  selectedCategories: number[];
};

export default function AdminDashboard({
  products,
  categories,
  selectedCategories: initialSelected,
}: Props) {
  const { selectedCategories, toggleCategory } = useCategoryFilter(initialSelected);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <Toaster position="top-center" />
      <AdminHeader
        onCategoryManageClick={() => setCategoryDialogOpen(true)}
        onPasswordChangeClick={() => setPasswordDialogOpen(true)}
      />
      <PasswordChangeDialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
      />
      <CategoryManageDialog
        open={categoryDialogOpen}
        onClose={() => setCategoryDialogOpen(false)}
        categories={categories}
      />
      <main className="flex min-h-0 flex-1 flex-col px-4 py-8">
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-line bg-surface">
          <CategorySidebar
            categories={categories}
            selectedCategories={selectedCategories}
            onToggleCategory={toggleCategory}
          />
          <ProductTable products={products.data} categories={categories} />
        </div>
        <Pagination meta={products} />
      </main>
    </div>
  );
}
