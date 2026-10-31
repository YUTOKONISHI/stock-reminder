type Props = {
  title: string;
  /** 2番目の手順。追加したアイコンから開いたあとの案内は画面ごとに違う。 */
  openStep: string;
};

export function AddToHomeScreenSteps({ title, openStep }: Props) {
  return (
    <>
      <p className="mb-2 font-medium">{title}</p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          Safari で開き、共有ボタン（または「…」メニューの「共有」）から「ホーム画面に追加」を選ぶ
        </li>
        <li>{openStep}</li>
      </ol>
      <p className="mt-2 text-xs text-ink-muted">
        ホーム画面から開くと、ログインし直しが必要になることがあります
      </p>
    </>
  );
}
