import { useState } from 'react';
import { Button, Field, Input, Popover, Stack, Tag, Text } from '@uralmash/design-system';
import type { TagColorToken } from '@uralmash/design-system';
import { TAG_COLORS } from '@/state/useTags';
import styles from './NewTagButton.module.css';

export type NewTagButtonProps = {
  onCreate: (name: string, color: TagColorToken) => boolean;
  /** `sm` — как в списке фильтра «Тег» (кнопка на всю ширину). `md` — как отдельное действие рядом с чипом. */
  size?: 'sm' | 'md';
};

/**
 * Сбор нового тега — поповер, а не окно.
 *
 * Заводят тег там же, где его выбирают или показывают: уводить ради двух
 * полей на модальный слой значило бы закрыть собой то, что за ним стоит
 * (список фильтра, панель результата). Поповер внутри поповера держит
 * система — панели собраны в дерево слоёв, и нажатие внутри дочерней
 * панели не считается для родителя кликом снаружи.
 */
export function NewTagButton({ onCreate, size = 'sm' }: NewTagButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<TagColorToken>(TAG_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setName('');
    setError(null);
  };

  const submit = () => {
    if (!name.trim()) {
      setError('Без названия тег не отличить от других.');
      return;
    }

    if (!onCreate(name, color)) {
      setError('Такой тег уже есть.');
      return;
    }

    close();
  };

  return (
    <Popover
      open={open}
      onClose={close}
      placement="bottom-start"
      width="sm"
      trigger={
        <Button
          variant="ghost"
          size={size}
          iconStart="plus"
          fullWidth={size === 'sm'}
          onClick={() => setOpen((v) => !v)}
        >
          Новый тег
        </Button>
      }
    >
      <Stack gap="md" direction="column">
        <Field label="Название тега" error={error ?? undefined} fullWidth>
          {(props) => (
            <Input
              {...props}
              fullWidth
              size="sm"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  // Иначе нажатие доигрывается дальше и достаётся тому,
                  // что окажется под фокусом, когда панель закроется.
                  e.preventDefault();
                  submit();
                }
              }}
            />
          )}
        </Field>

        <Stack gap="xs" direction="column">
          <Text variant="label">Цвет</Text>
          {/* Образец — сам тег, а не цветной квадрат: выбирают то, что
              будет стоять в таблице, и показывать это чем-то другим
              значит показывать не то. */}
          <Stack direction="row" gap="xs" wrap>
            {TAG_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className={styles.swatch}
                aria-pressed={swatch === color}
                aria-label={`Цвет тега: ${swatch}`}
                onClick={() => setColor(swatch)}
              >
                <Tag color={swatch}>{name.trim() || 'Тег'}</Tag>
              </button>
            ))}
          </Stack>
        </Stack>

        <Button variant="primary" size="sm" fullWidth onClick={submit}>
          Добавить
        </Button>
      </Stack>
    </Popover>
  );
}
