import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Checkbox, EmptyState, Input, Modal, Stack, Table, Text } from '@uralmash/design-system';
import type { TableColumn, TableSort } from '@uralmash/design-system';
import type { CatalogItem, SpecColumn } from '@/data/crushers';
import styles from './CatalogPicker.module.css';

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
  const [filtersOpen, setFiltersOpen] = useState(false);

  /**
   * Esc закрывает только верхнее окно.
   *
   * Каталог живёт внутри окна нового проекта, а окно фильтров открывается
   * поверх него — два `Modal` разом. Каждый вешает свой обработчик Esc на
   * `document` в фазе всплытия, и порядок срабатывания у них — порядок
   * подписки: внешнее окно смонтировано раньше, поэтому первым закрывается
   * оно. Нажатие Esc в фильтрах уносило вместе с ними и весь выбор дробилки.
   *
   * Перехватываем на погружении: обработчик на `document` в фазе capture
   * идёт раньше любых всплывающих на том же узле, поэтому здесь событие
   * можно остановить и закрыть ровно то окно, которое сверху. Своё закрытие
   * приходится делать руками — остановленное событие не дойдёт и до
   * собственного обработчика окна фильтров.
   *
   * Это подпорка под дефект системы: `Modal` не проверяет, верхний ли он
   * слой. Заявка в дизайн-систему — отдельно; чинить там, а не здесь.
   */
  useEffect(() => {
    if (!filtersOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setFiltersOpen(false);
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [filtersOpen]);

  /**
   * Сортировка по первой характеристике — у дробилок это диаметр конуса,
   * у проб руды плотность. Без неё справочник открывается в порядке файла,
   * то есть ни по чему: сравнивать 30 машин глазами проще, когда они уже
   * выстроены по определяющей величине.
   */
  const [sort, setSort] = useState<TableSort | null>(
    specs.length > 0 ? { key: specs[0].short, direction: 'asc' } : null
  );

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
      /* Название стоит первым, и это не только про порядок чтения.
         `Table` оборачивает содержимое первой колонки в кнопку — так строка
         становится доступной с клавиатуры, и её доступным именем служит
         то, что в этой колонке лежит. Когда первым стоял флажок, в кнопку
         попадал `input`: интерактивное внутри интерактивного. Указатель
         до флажка не доходил — его перехватывала галочка, — а строка
         называлась «Выбрать КМД-2200Т» вместо имени машины. Теперь в кнопке
         имя, а флажок живёт в обычной ячейке и работает сам по себе.

         `label`, а не `bodySm`: имя машины выделено весом, как в прототипе.
         Веса отдельным пропом в системе нет — его задаёт роль целиком,
         поэтому выделение приходит вместе с размером роли. */
      render: (item) => <Text variant="label">{item.name}</Text>,
    },
    {
      /* Флажок дублирует клик по строке, а не заменяет его: он показывает,
         что строку можно отметить, до того как по ней кликнули. */
      key: 'picked',
      title: '',
      render: (item) => (
        <Checkbox
          checked={item.name === value}
          onChange={() => onPick(item.name)}
          aria-label={`Выбрать ${item.name}`}
        />
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
      {/* Поиск занимает левый край и забирает всю свободную ширину: это
          основной способ найти машину в каталоге из тридцати позиций, и
          прятать его за кнопку значило бы прятать главное действие панели.
          Остальные условия отбора уехали под кнопку справа — их немного,
          но каждое, вынесенное в строку, отнимает ширину у поиска. */}
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Input
            fullWidth
            type="search"
            aria-label={`Поиск: ${nameLabel.toLowerCase()} или значение характеристики`}
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filter ? (
          <Button variant="secondary" iconStart="filter" onClick={() => setFiltersOpen(true)}>
            Фильтры
          </Button>
        ) : null}
      </div>

      {/* Прокрутка каталога — снаружи таблицы: липкой шапки в системе нет
          намеренно (sticky требует предка с ограниченной высотой, а шкалы
          высот в системе не существует), поэтому шапка уезжает вместе
          со строками. Заявка на «область с ограниченной высотой» — в систему. */}
      <div className={styles.scroll}>
        <Table
          columns={columns}
          rows={rows}
          rowKey={(item) => item.name}
          caption={nameLabel}
          captionHidden
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
      </div>

      {/* Окно общих фильтров. Каталог сам живёт внутри окна, поэтому это
          окно во окне — раскладка та же, что на списке проектов, и разводить
          два разных способа добраться до одних и тех же условий отбора
          не стоит: пользователь запоминает место кнопки, а не её контекст. */}
      <Modal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Фильтры"
        size="sm"
        footer={
          <Modal.Footer>
            <Button variant="primary" onClick={() => setFiltersOpen(false)}>
              Готово
            </Button>
          </Modal.Footer>
        }
      >
        <Stack gap="lg" direction="column">
          {filter}
        </Stack>
      </Modal>
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
