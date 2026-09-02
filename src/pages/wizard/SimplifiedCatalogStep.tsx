import { useState } from 'react';
import { Button, Chip, EmptyState, Modal, Stack, Text } from '@uralmash/design-system';
import { CatalogPicker } from '@/components/CatalogPicker/CatalogPicker';
import type { CatalogItem, SpecColumn } from '@/data/crushers';

export type SimplifiedCatalogStepProps = {
  title: string;
  description: string;
  specs: SpecColumn[];
  items: CatalogItem[];
  nameLabel: string;
  searchPlaceholder: string;
  emptyTitle: string;
  emptyDescription: string;
  selected: string[];
  onChange: (names: string[]) => void;
};

/**
 * Шаг упрощённого режима — только выбор, без единого поля ввода: несколько
 * позиций каталога выбираются чекбоксами (тот же `CatalogPicker`, что и в
 * инженерном режиме, только с `multiple`), расчёт на шаге «Продукт» потом
 * пройдёт по каждой. Одна реализация на дробилки и пробы руды — раскладка
 * и поведение одинаковы, отличаются только данные каталога и подписи.
 */
export function SimplifiedCatalogStep({
  title,
  description,
  specs,
  items,
  nameLabel,
  searchPlaceholder,
  emptyTitle,
  emptyDescription,
  selected,
  onChange,
}: SimplifiedCatalogStepProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const remove = (name: string) => onChange(selected.filter((n) => n !== name));

  return (
    <Stack gap="xl" direction="column">
      <Stack gap="xs" direction="column">
        <Text variant="headingMd">{title}</Text>
        <Text variant="bodySm" color="textMuted">
          {description}
        </Text>
      </Stack>

      {selected.length > 0 ? (
        <Stack direction="row" gap="xs" wrap>
          {selected.map((name) => (
            <Chip
              key={name}
              icon="fileText"
              action={{ icon: 'x', label: `Убрать: ${name}`, onClick: () => remove(name) }}
            >
              {name}
            </Chip>
          ))}
        </Stack>
      ) : (
        <EmptyState icon="folder" title={emptyTitle} description={emptyDescription} />
      )}

      <div>
        <Button variant="secondary" iconStart="plus" onClick={() => setPickerOpen(true)}>
          {selected.length > 0 ? 'Добавить ещё' : `Выбрать — ${items.length} в каталоге`}
        </Button>
      </div>

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={`Выбор: ${nameLabel.toLowerCase()}`}
        size="lg"
        footer={
          <Modal.Footer>
            <Button variant="primary" onClick={() => setPickerOpen(false)}>
              Готово
            </Button>
          </Modal.Footer>
        }
      >
        <CatalogPicker
          specs={specs}
          items={items}
          value={null}
          onPick={() => {}}
          multiple
          selected={selected}
          onPickMultiple={onChange}
          nameLabel={nameLabel}
          searchPlaceholder={searchPlaceholder}
        />
      </Modal>
    </Stack>
  );
}
