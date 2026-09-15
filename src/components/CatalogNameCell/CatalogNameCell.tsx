import { useState } from 'react';
import { Button, Stack } from '@uralmash/design-system';
import { CatalogItemForm } from '@/components/CatalogItemForm/CatalogItemForm';
import { useUserCatalog } from '@/state/userCatalog';
import type { CatalogKind } from '@/state/userCatalog';

export type CatalogNameCellProps = {
  kind: CatalogKind;
  /** Имя выбранной позиции. Пусто — прочерк и без правки: править нечего. */
  name: string;
  /** «Дробилка», «Проба руды» — в подписи кнопки и заголовке формы. */
  nameLabel: string;
  onSaved?: (name: string) => void;
};

/**
 * Ячейка с именем выбранной дробилки или пробы и правкой её данных.
 *
 * Правка стоит в той же строке, что и имя: она относится к этой позиции,
 * а не ко всей таблице под заголовком. Кнопка без фона и только значком —
 * в строке данных подписанная кнопка перетягивала бы взгляд с самих чисел.
 */
export function CatalogNameCell({ kind, name, nameLabel, onSaved }: CatalogNameCellProps) {
  const catalog = useUserCatalog(kind);
  const item = catalog.items.find((entry) => entry.name === name) ?? null;
  const [open, setOpen] = useState(false);

  if (!name) return <>—</>;

  return (
    <Stack direction="row" align="center" justify="end" gap="2xs">
      <span>{name}</span>
      {item ? (
        <Button
          variant="ghost"
          size="sm"
          icon="pencil"
          aria-label={`Редактировать: ${nameLabel.toLowerCase()} ${name}`}
          onClick={() => setOpen(true)}
        />
      ) : null}

      <CatalogItemForm
        open={open}
        onClose={() => setOpen(false)}
        item={item}
        specs={catalog.specs}
        nameLabel={nameLabel}
        takenNames={catalog.items.map((entry) => entry.name)}
        onSave={(entry) => {
          catalog.save(entry);
          onSaved?.(entry.name);
        }}
      />
    </Stack>
  );
}
