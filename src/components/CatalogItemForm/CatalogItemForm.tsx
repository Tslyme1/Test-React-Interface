import { useCallback, useEffect, useState } from 'react';
import { Button, Field, Grid, Input, Modal, Stack, Text } from '@uralmash/design-system';
import type { CatalogItem, SpecColumn } from '@/data/crushers';
import type { CatalogEntry } from '@/domain/catalogEdits';
import { FieldHint } from '@/components/FieldHint/FieldHint';
import { useTopEscape } from '@/hooks/useTopEscape';

export type CatalogItemFormProps = {
  open: boolean;
  onClose: () => void;
  /**
   * Что правим. `null` — заводим свою позицию: имя вводится, поля пустые.
   * Иначе форма открывается на значениях этой позиции, а имя не меняется —
   * по нему позиция связана и с правкой в хранилище, и с выбором в проекте.
   */
  item: CatalogItem | null;
  specs: SpecColumn[];
  /** «Дробилка», «Проба руды» — и в заголовке окна, и в подписи имени. */
  nameLabel: string;
  /** Имена справочника: новая позиция не должна молча затереть каталожную. */
  takenNames: string[];
  onSave: (entry: CatalogEntry) => void;
};

/**
 * Заведение своей позиции справочника и правка каталожной — одна форма.
 *
 * Одна, потому что вопрос один и тот же: «какие у этой машины
 * характеристики». Разница только в том, есть ли у ответа исходные
 * значения, и она выражается предзаполнением полей, а не вторым окном
 * с теми же девятью полями.
 *
 * Величины — свободный текст, а не числа: в справочнике значение сплошь
 * и рядом само диапазон («5-15», «160/250», «16.8 (15-18)»). Загонять
 * такое в `type="number"` значило бы запретить вводить ровно то, что
 * в справочнике и написано.
 */
export function CatalogItemForm({
  open,
  onClose,
  item,
  specs,
  nameLabel,
  takenNames,
  onSave,
}: CatalogItemFormProps) {
  const [name, setName] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});

  /* Форма заводится заново при каждом открытии: иначе в ней осталось бы
     то, что набрали для прошлой позиции и не сохранили. */
  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? '');
    setValues(item ? { ...item.values } : {});
  }, [open, item]);

  const close = useCallback(() => onClose(), [onClose]);
  useTopEscape(open, close);

  const trimmed = name.trim();
  const duplicate = !item && trimmed !== '' && takenNames.includes(trimmed);
  const canSave = trimmed !== '' && !duplicate;

  const submit = () => {
    if (!canSave) return;
    onSave({ name: trimmed, values });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={item ? `${nameLabel}: правка данных` : `Новая позиция: ${nameLabel.toLowerCase()}`}
      size="lg"
      footer={
        <Modal.Footer>
          <Button variant="secondary" onClick={close}>
            Отмена
          </Button>
          <Button variant="primary" disabled={!canSave} onClick={submit}>
            Сохранить
          </Button>
        </Modal.Footer>
      }
    >
      <Stack gap="lg" direction="column">
        <Field
          label={`Название: ${nameLabel.toLowerCase()}`}
          required
          error={duplicate ? 'Такая позиция в справочнике уже есть' : undefined}
          hint={item ? 'Название каталожной позиции не меняется: по нему она связана с выбором в проектах.' : undefined}
          fullWidth
        >
          {(props) => (
            <Input
              {...props}
              fullWidth
              autoFocus={!item}
              disabled={Boolean(item)}
              placeholder={nameLabel}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>

        <Stack gap="sm" direction="column">
          <Text variant="label">Характеристики</Text>
          {/* Пустое поле — «величина не измерялась», и в таблице она
              покажется прочерком. Требовать все девять было бы неправдой:
              у каталожных проб руды половина значений и так прочерки. */}
          <Grid columns={2} gap="md" rowGap="sm">
            {specs.map((spec) => (
              <Field
                key={spec.short}
                label={spec.short}
                labelHint={<FieldHint>{spec.label}</FieldHint>}
                fullWidth
              >
                {(props) => (
                  <Input
                    {...props}
                    fullWidth
                    value={values[spec.short] ?? ''}
                    onChange={(e) => setValues((current) => ({ ...current, [spec.short]: e.target.value }))}
                  />
                )}
              </Field>
            ))}
          </Grid>
        </Stack>
      </Stack>
    </Modal>
  );
}
