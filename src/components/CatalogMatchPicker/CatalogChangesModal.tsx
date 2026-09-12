import { useCallback } from 'react';
import { Button, EmptyState, Modal, Stack, Table, Text } from '@uralmash/design-system';
import type { TableColumn } from '@uralmash/design-system';
import type { CatalogChange, CatalogFieldChange } from '@/domain/catalogEdits';
import { useTopEscape } from '@/hooks/useTopEscape';

export type CatalogChangesModalProps = {
  open: boolean;
  onClose: () => void;
  changes: CatalogChange[];
  /** «Дробилка», «Проба руды» — как называть позицию в подписях окна. */
  nameLabel: string;
  /** Снять правку с позиции: вернуть каталожные данные или убрать свою. */
  onRevert: (name: string) => void;
};

const columns: TableColumn<CatalogFieldChange>[] = [
  { key: 'spec', title: 'Величина' },
  { key: 'before', title: 'Было', align: 'end' },
  { key: 'after', title: 'Стало', align: 'end' },
];

/**
 * Чем справочник отличается от каталожного — по позициям и величинам.
 *
 * Таблицей на позицию, а не одной общей: в общей пришлось бы повторять
 * имя машины в каждой строке, и читалась бы она как список правок,
 * а вопрос у пользователя другой — «что не так вот с этой машиной».
 *
 * Список считается от справочника (`catalogChanges`), а не копится
 * журналом действий: возврат значения к каталожному убирает позицию
 * отсюда сам собой, без отдельной «отмены правки».
 */
export function CatalogChangesModal({ open, onClose, changes, nameLabel, onRevert }: CatalogChangesModalProps) {
  const close = useCallback(() => onClose(), [onClose]);
  useTopEscape(open, close);

  return (
    <Modal
      open={open}
      onClose={close}
      title="Изменения в справочнике"
      size="sm"
      footer={
        <Modal.Footer>
          {/* «Готово», а не «Закрыть»: крестик окна уже называется
              «Закрыть», и две кнопки с одним именем в одном окне —
              загадка для того, кто слушает его читалкой. */}
          <Button variant="primary" onClick={close}>
            Готово
          </Button>
        </Modal.Footer>
      }
    >
      {changes.length === 0 ? (
        <EmptyState
          icon="check"
          title="Справочник не тронут"
          description="Все значения — каталожные."
        />
      ) : (
        <Stack gap="lg" direction="column">
          {changes.map((change) => (
            <Stack key={change.name} gap="xs" direction="column">
              <Stack gap="sm" direction="row" align="baseline" justify="between">
                <Stack gap="sm" direction="row" align="baseline">
                  <Text variant="label">{change.name}</Text>
                  <Text variant="bodySm" color="textMuted">
                    {change.kind === 'added' ? `новая ${nameLabel.toLowerCase()}` : 'данные изменены'}
                  </Text>
                </Stack>

                {/* Правка обязана быть обратимой. Иначе «было → стало»
                    показывает расхождение, а убрать его можно только
                    вводом прежнего числа руками — то есть пользователю
                    пришлось бы помнить, каким оно было, хотя приложение
                    это знает. */}
                <Button variant="ghost" size="sm" onClick={() => onRevert(change.name)}>
                  {change.kind === 'added' ? 'Удалить позицию' : 'Вернуть каталожные'}
                </Button>
              </Stack>

              {change.fields.length > 0 ? (
                <Table
                  columns={columns}
                  rows={change.fields}
                  rowKey={(field) => field.spec}
                  caption={`Изменения: ${change.name}`}
                  captionHidden
                />
              ) : (
                /* Своя позиция, заведённая без единой характеристики:
                   расходиться с каталогом ей нечем — в нём её просто нет. */
                <Text variant="bodySm" color="textMuted">
                  Характеристики не заданы.
                </Text>
              )}
            </Stack>
          ))}
        </Stack>
      )}
    </Modal>
  );
}
