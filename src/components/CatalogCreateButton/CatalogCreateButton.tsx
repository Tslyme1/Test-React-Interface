import { useState } from 'react';
import { Button } from '@uralmash/design-system';
import type { ButtonProps } from '@uralmash/design-system';
import type { CatalogEntry } from '@/domain/catalogEdits';
import { CatalogItemForm } from '@/components/CatalogItemForm/CatalogItemForm';
import { useUserCatalog } from '@/state/userCatalog';
import type { CatalogKind } from '@/state/userCatalog';

export type CatalogCreateButtonProps = {
  kind: CatalogKind;
  /** «Дробилка», «Проба руды» — идёт в заголовок формы и в подпись имени. */
  nameLabel: string;
  variant?: ButtonProps['variant'];
  /**
   * Заведённая позиция. Справочник к этому моменту уже сохранён — здесь
   * решают, что с ней делать дальше: обычно сразу выбрать, раз её для
   * этого и заводили.
   */
  onCreated?: (name: string) => void;
};

/**
 * Кнопка «Новая» вместе с формой заведения позиции справочника.
 *
 * Отдельным компонентом, а не частью каталога, потому что живёт она
 * в футере окна — слева, рядом с «Отмена», — а футер принадлежит тому
 * окну, внутри которого каталог показан, и дотянуться до него изнутри
 * каталога нечем. Заодно это снимает с `CatalogPicker` знание о том,
 * куда сохранять заведённое.
 */
export function CatalogCreateButton({ kind, nameLabel, variant = 'secondary', onCreated }: CatalogCreateButtonProps) {
  const catalog = useUserCatalog(kind);
  const [open, setOpen] = useState(false);

  const save = (entry: CatalogEntry) => {
    catalog.save(entry);
    onCreated?.(entry.name);
  };

  return (
    <>
      <Button variant={variant} iconStart="plus" onClick={() => setOpen(true)}>
        Новая
      </Button>

      <CatalogItemForm
        open={open}
        onClose={() => setOpen(false)}
        item={null}
        specs={catalog.specs}
        nameLabel={nameLabel}
        takenNames={catalog.items.map((item) => item.name)}
        onSave={save}
      />
    </>
  );
}
