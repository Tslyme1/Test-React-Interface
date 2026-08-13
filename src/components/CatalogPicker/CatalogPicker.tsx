import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Badge,
  Box,
  EmptyState,
  Field,
  Input,
  Stack,
  Table,
  Text,
} from '@uralmash/design-system';
import type { TableColumn, TableSort } from '@uralmash/design-system';
import type { CatalogItem, SpecColumn } from '@/data/crushers';

export type CatalogPickerProps = {
  /** Колонки характеристик. Порядок сохраняется как в справочнике. */
  specs: SpecColumn[];
  items: CatalogItem[];
  /** Имя выбранной позиции, если она уже есть. */
  value: string | null;
  onPick: (name: string) => void;
  /** Подпись первой колонки: «Дробилка», «Проба руды». */
  nameLabel: string;
  searchPlaceholder: string;
  /** Дополнительный фильтр над таблицей — например, семейство машины. */
  filter?: ReactNode;
  /** Уже отфильтрованный снаружи набор имён. Пусто — показываются все. */
  visibleNames?: string[];
};

/**
 * Выбор позиции справочника таблицей характеристик.
 *
 * Именно таблицей, а не списком: смысл экрана — сравнить машины по столбцам,
 * а это ровно та роль, для которой в системе есть `Table`. Список прячет
 * характеристики, ради которых выбор и делается.
 *
 * Компонент намеренно не модальное окно: его вставляют внутрь уже открытого
 * окна. Модалка в модалке ломает удержание фокуса — у каждой оно своё.
 */
export function CatalogPicker({
  specs,
  items,
  value,
  onPick,
  nameLabel,
  searchPlaceholder,
  filter,
  visibleNames,
}: CatalogPickerProps) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<TableSort | null>(null);

  const rows = useMemo(() => {
    const allowed = visibleNames ? new Set(visibleNames) : null;
    const query = search.trim().toLowerCase();

    const filtered = items.filter((item) => {
      if (allowed && !allowed.has(item.name)) return false;
      if (!query) return true;
      // Ищем и по названию, и по значениям: инженер помнит «2200», а не имя целиком.
      return (
        item.name.toLowerCase().includes(query) ||
        Object.values(item.values).some((v) => v.toLowerCase().includes(query))
      );
    });

    if (!sort) return filtered;

    const sorted = [...filtered].sort((a, b) => {
      const av = sort.key === 'name' ? a.name : (a.values[sort.key] ?? '');
      const bv = sort.key === 'name' ? b.name : (b.values[sort.key] ?? '');
      return compareSpecValues(av, bv);
    });

    return sort.direction === 'desc' ? sorted.reverse() : sorted;
  }, [items, visibleNames, search, sort]);

  const columns: TableColumn<CatalogItem>[] = [
    {
      key: 'name',
      title: nameLabel,
      sortable: true,
      render: (item) => (
        <Stack direction="row" gap="sm" align="center">
          <Text variant="bodySm">{item.name}</Text>
          {item.name === value ? <Badge tone="accent" icon="check">Выбрано</Badge> : null}
        </Stack>
      ),
    },
    ...specs.map<TableColumn<CatalogItem>>((spec) => ({
      key: spec.short,
      title: spec.short,
      align: 'end',
      sortable: true,
      render: (item) => item.values[spec.short] || null,
    })),
  ];

  return (
    <Stack gap="lg" direction="column">
      <Stack direction="row" gap="lg" align="end" wrap>
        <Box fullWidth>
          <Field label="Поиск" hint="По названию или любому значению характеристики">
            {(props) => (
              <Input
                {...props}
                fullWidth
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            )}
          </Field>
        </Box>
        {filter}
      </Stack>

      <Table
        columns={columns}
        rows={rows}
        rowKey={(item) => item.name}
        caption={nameLabel}
        sort={sort}
        onSortChange={setSort}
        onRowClick={(item) => onPick(item.name)}
        empty={
          <EmptyState
            icon="search"
            title="Ничего не найдено"
            description="Измените запрос или снимите фильтр."
          />
        }
      />

      <Text variant="caption" color="textMuted">
        Показано: {rows.length} из {items.length}. Прочерк означает, что величина не измерялась.
      </Text>
    </Stack>
  );
}

/**
 * Сравнение значений характеристик.
 *
 * Значения инженерные и неоднородные: «2200», «5-15», «160/250», «—».
 * Сортировка по строке поставила бы «1200» выше «900», поэтому сравниваем
 * по первому числу, а к строковому сравнению падаем только когда числа нет.
 * Прочерк всегда уходит вниз: отсутствие величины — не наименьшее значение.
 */
function compareSpecValues(a: string, b: string): number {
  const DASH = '—';
  if (a === DASH && b === DASH) return 0;
  if (a === DASH) return 1;
  if (b === DASH) return -1;

  const na = leadingNumber(a);
  const nb = leadingNumber(b);
  if (na !== null && nb !== null && na !== nb) return na - nb;

  return a.localeCompare(b, 'ru', { numeric: true });
}

function leadingNumber(value: string): number | null {
  const match = value.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}
