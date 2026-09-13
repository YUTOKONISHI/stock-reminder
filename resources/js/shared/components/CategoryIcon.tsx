import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBottleWater,
  faBox,
  faJar,
  faSprayCanSparkles,
  faUtensils,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const CATEGORY_ICONS: Record<string, IconDefinition> = {
  食品: faUtensils,
  日用品: faSprayCanSparkles,
  飲料: faBottleWater,
  調味料: faJar,
};

type Props = {
  category: string | null | undefined;
  className?: string;
};

export function CategoryIcon({ category, className }: Props) {
  const icon = (category ? CATEGORY_ICONS[category] : undefined) ?? faBox;

  return <FontAwesomeIcon icon={icon} className={className} aria-hidden />;
}
