import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { markStockAsPurchased } from '@/features/stock/api';
import type { Stock } from '@/features/stock/types';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { formatDateAfterDays } from '@/shared/lib/date';

type Props = {
  stock: Stock;
  open: boolean;
  onClose: () => void;
};

type FormProps = {
  stock: Stock;
  onClose: () => void;
};

const INVALID_QUANTITY_MESSAGE = 'ストック数は1以上の値にしてください。';

/** 1以上の整数でなければ null を返す */
function parseQuantity(value: string): number | null {
  return /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

/* 入力値は閉じると DialogContent ごと破棄されるので、開くたびに現在のストック数へ戻る。 */
function PurchaseStockForm({ stock, onClose }: FormProps) {
  const [value, setValue] = useState(String(stock.quantity));
  const [serverError, setServerError] = useState<string>();

  const quantity = parseQuantity(value);
  const nextPurchaseDate =
    quantity === null ? null : formatDateAfterDays(stock.consumption_interval_days * quantity);
  const error = quantity === null ? INVALID_QUANTITY_MESSAGE : serverError;

  function changeValue(next: string) {
    setValue(next);
    setServerError(undefined);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (quantity === null) {
      return;
    }

    markStockAsPurchased(stock.id, quantity, {
      onSuccess: () => {
        toast.success(`${stock.product.name}の購入を記録しました`, {
          description: `次回購入予定日は${nextPurchaseDate}です`,
        });
        onClose();
      },
      onError: (errors) => setServerError(errors.quantity),
    });
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="purchase-quantity">購入後のストック数</Label>
        <p id="purchase-quantity-description" className="text-xs text-ink-muted">
          残っていた分も含めた、手元の合計を入力してください
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="size-14 shrink-0"
            aria-label="1つ減らす"
            disabled={quantity === null || quantity <= 1}
            onClick={() => quantity !== null && changeValue(String(quantity - 1))}
          >
            <FontAwesomeIcon icon={faMinus} />
          </Button>
          <Input
            id="purchase-quantity"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            autoComplete="off"
            aria-describedby="purchase-quantity-description"
            aria-invalid={error !== undefined}
            className="h-14 appearance-none text-center font-numeric text-2xl font-bold md:text-2xl [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            value={value}
            onChange={(event) => changeValue(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            className="size-14 shrink-0"
            aria-label="1つ増やす"
            onClick={() => changeValue(String((quantity ?? 0) + 1))}
          >
            <FontAwesomeIcon icon={faPlus} />
          </Button>
        </div>
        {error && <p className="text-xs text-danger-600">{error}</p>}
      </div>

      {quantity !== null && nextPurchaseDate !== null && (
        <div aria-live="polite" className="flex flex-col rounded-lg bg-primary-50 px-4 py-3">
          <span className="text-xs text-primary-700">次回購入予定日</span>
          <span className="text-2xl font-bold text-ink">{nextPurchaseDate}</span>
          <span className="text-xs text-ink-muted">
            今日 + 消費日数{stock.consumption_interval_days}日 × ストック数{quantity}
          </span>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={onClose}>
          キャンセル
        </Button>
        {/* 入力欄に自動でフォーカスすると、スマホで数字キーボードが開いて確認の表示を隠す */}
        <Button type="submit" size="lg" autoFocus disabled={quantity === null}>
          記録する
        </Button>
      </DialogFooter>
    </form>
  );
}

export function PurchaseStockDialog({ stock, open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{stock.product.name}の購入を記録</DialogTitle>
        </DialogHeader>
        <PurchaseStockForm stock={stock} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
