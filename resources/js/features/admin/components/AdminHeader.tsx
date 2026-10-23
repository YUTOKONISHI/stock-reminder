import { faKey, faRightFromBracket, faTags } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { logout } from '../api';

type Props = {
  onCategoryManageClick: () => void;
  onPasswordChangeClick: () => void;
};

export function AdminHeader({ onCategoryManageClick, onPasswordChangeClick }: Props) {
  return (
    <header className="bg-surface shadow">
      <div className="flex items-center justify-between px-4 py-4">
        <h1 className="text-xl font-bold text-ink">マスタ画面</h1>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onCategoryManageClick}
            className="text-ink-muted hover:text-ink"
            title="カテゴリ管理"
          >
            <FontAwesomeIcon icon={faTags} className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onPasswordChangeClick}
            className="text-ink-muted hover:text-ink"
            title="パスワード変更"
          >
            <FontAwesomeIcon icon={faKey} className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={logout}
            className="text-ink-muted hover:text-ink"
            title="ログアウト"
          >
            <FontAwesomeIcon icon={faRightFromBracket} className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
