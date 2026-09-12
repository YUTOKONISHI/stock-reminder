import { Link, usePage } from '@inertiajs/react';
import { useStockForm } from '@/features/stock/hooks/useStockForm';
import type { Stock, StockFormProduct } from '@/features/stock/types';
import profileRoutes from '@/routes/profile';
import stockRoutes from '@/routes/stocks';
import { Button } from '@/shared/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { AppShell } from '@/shared/layouts/AppShell';

type Props = {
  products: StockFormProduct[];
  stock: Stock | null;
};

export default function StockForm({ products, stock }: Props) {
  const { auth } = usePage().props;
  const {
    form,
    isEdit,
    hasCategory,
    categories,
    visibleProducts,
    markIntervalEdited,
    handleCategoryChange,
    handleProductChange,
    submit,
    remove,
  } = useStockForm({ stock, products });
  const { isSubmitting } = form.formState;
  const title = isEdit ? 'ストック設定' : 'ストック追加';

  /* 登録済みの商品はサーバ側で除いてあるので、追加のときだけ空になりうる。
   * 商品マスタが空のときも同じ画面になるため、理由は書き分けない。 */
  if (!isEdit && products.length === 0) {
    return (
      <AppShell title={title} active="settings" backHref={stockRoutes.index.url()}>
        <div className="max-w-xl">
          <p className="font-medium text-ink">追加できる商品がありません</p>
          <p className="mt-2 text-ink-muted">
            ストック数や消費日数を変えるときは、一覧から選んでください。
          </p>

          <Button asChild variant="secondary" className="mt-6 w-full">
            <Link href={stockRoutes.index.url()}>一覧に戻る</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={title} active="settings" backHref={stockRoutes.index.url()}>
      <div className="max-w-xl">
        {!isEdit && auth.user.household_size === null && (
          <div className="mb-4 rounded-xl border border-line bg-primary-50 p-4">
            <p className="text-ink">
              世帯人数を設定すると、消費日数の初期値が人数に合わせて入ります。
            </p>
            <Link
              href={profileRoutes.edit.url()}
              className="mt-2 inline-block text-primary-700 underline"
            >
              設定画面へ
            </Link>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <FormField
              control={form.control}
              name="category_id"
              rules={{ required: 'カテゴリを選択してください' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>カテゴリ</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleCategoryChange();
                    }}
                    disabled={isEdit}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={String(category.id)}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="product_id"
              rules={{ required: '商品を選択してください' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>商品名</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleProductChange(value);
                    }}
                    disabled={isEdit || !hasCategory}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={
                            hasCategory ? '選択してください' : '先にカテゴリを選択してください'
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {visibleProducts.map((product) => (
                        <SelectItem key={product.id} value={String(product.id)}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              rules={{
                required: 'ストック数を入力してください',
                min: { value: 1, message: 'ストック数は1以上で入力してください' },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ストック数</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} placeholder="ストック数" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="consumption_interval_days"
              rules={{
                required: '消費日数を入力してください',
                min: { value: 1, message: '消費日数は1以上で入力してください' },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>消費日数</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      placeholder="消費日数"
                      {...field}
                      onChange={(event) => {
                        field.onChange(event);
                        markIntervalEdited();
                      }}
                    />
                  </FormControl>
                  <FormDescription>ストック1つあたりが何日もつかを入力します。</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="next_purchase_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>次回購入予定日</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormDescription>
                    設定しない場合、最終更新日＋（消費日数 × ストック数）で自動設定されます。
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="pt-2">
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? '保存中...' : '保存'}
              </Button>
            </div>
          </form>
        </Form>

        {isEdit && (
          <div className="mt-8 border-t border-line pt-8">
            <Button
              type="button"
              variant="outline"
              onClick={remove}
              className="border-danger-600 text-danger-600 hover:bg-danger-50"
            >
              このストックを削除
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
