import { useMemo, useState } from 'react';
import { Button, Checkbox, EmptyState, Field, Input, RangeSelect, Stack, Table, Text } from '@uralmash/design-system';
import type { TableColumn } from '@uralmash/design-system';
import type { CatalogItem } from '@/data/crushers';
import type { CatalogEntry } from '@/domain/catalogEdits';
import {
  EMPTY_RANGE,
  compareSpecValues,
  formatBound,
  matchesQuery,
  rangeSpecsOf,
  toBounds,
  withinBounds,
} from '@/domain/catalogFilter';
import type { RangeMap } from '@/domain/catalogFilter';
import { CatalogItemForm } from '@/components/CatalogItemForm/CatalogItemForm';
import { FieldHint } from '@/components/FieldHint/FieldHint';
import { useUserCatalog } from '@/state/userCatalog';
import type { CatalogKind } from '@/state/userCatalog';
import styles from './CatalogMatchPicker.module.css';

export type CatalogMatchPickerProps = {
  kind: CatalogKind;
  /** Подпись первой колонки и имя сущности: «Дробилка», «Проба руды». */
  nameLabel: string;
  /** Родительный падеж для счётчика: «дробилок», «проб». */
  countLabel: string;
  selected: string[];
  onChange: (names: string[]) => void;
};

/**
 * Подбор по параметрам — окно шага упрощённого режима, разделённое пополам.
 *
 * Слева задают параметры, справа появляются подходящие позиции — и только
 * названия. Это и есть разница с каталогом инженерного режима
 * (`CatalogPicker`): там выбор идёт **от** машины, и таблица показывает
 * все её характеристики, чтобы было что сравнивать. Здесь выбор идёт
 * от требований к машине, и девять столбцов справа отвечали бы на вопрос,
 * который слева уже задан.
 *
 * Пока ни один параметр не задан и ничего не выбрано, справа пусто:
 * список из тридцати машин «по умолчанию» — не результат подбора,
 * и показывать его как результат значило бы сказать неправду.
 *
 * Правки справочника (своя машина, исправленная характеристика) живут
 * в `state/userCatalog` и видны во всех проектах — см. пояснение там.
 */
export function CatalogMatchPicker({ kind, nameLabel, countLabel, selected, onChange }: CatalogMatchPickerProps) {
  const catalog = useUserCatalog(kind);

  const [query, setQuery] = useState('');
  const [ranges, setRanges] = useState<RangeMap>({});
  /** `null` — форма закрыта; `{ item: null }` — заводим свою позицию. */
  const [editing, setEditing] = useState<{ item: CatalogItem | null } | null>(null);

  const rangeSpecs = useMemo(() => rangeSpecsOf(catalog.specs, catalog.items), [catalog.specs, catalog.items]);
  const bounds = useMemo(() => toBounds(rangeSpecs, ranges), [rangeSpecs, ranges]);

  const trimmedQuery = query.trim().toLowerCase();
  const hasParams = trimmedQuery !== '' || bounds.length > 0;

  /**
   * Строки справа: подходящие под параметры плюс уже выбранные.
   *
   * Выбранные показываются всегда, даже если перестали подходить под
   * только что суженный диапазон. Иначе собственный выбор пользователя
   * исчезает с глаз, оставаясь в проекте, — и снять его нечем: строки,
   * которой он отмечен, на экране больше нет.
   */
  const rows = useMemo(() => {
    const picked = new Set(selected);

    const matched = catalog.items.filter(
      (item) => picked.has(item.name) || (hasParams && withinBounds(item, bounds) && matchesQuery(item, trimmedQuery))
    );

    /* Своя позиция, заведённая в другом проекте и здесь ещё не выбранная,
       попадает сюда обычным путём — она уже часть справочника. */
    return [...matched].sort((a, b) => compareSpecValues(a.name, b.name));
  }, [catalog.items, selected, hasParams, bounds, trimmedQuery]);

  const matchCount = useMemo(
    () => (hasParams ? catalog.items.filter((item) => withinBounds(item, bounds) && matchesQuery(item, trimmedQuery)).length : 0),
    [catalog.items, hasParams, bounds, trimmedQuery]
  );

  const toggle = (name: string) =>
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);

  const resetParams = () => {
    setQuery('');
    setRanges({});
  };

  const saveEntry = (entry: CatalogEntry) => {
    catalog.save(entry);
    /* Заведённая позиция сразу оказывается выбранной: её для того
       и заводили. Правка каталожной выбор не трогает — пользователь
       поправил данные, а не передумал насчёт машины. */
    if (editing?.item === null && !selected.includes(entry.name)) onChange([...selected, entry.name]);
  };

  const columns: TableColumn<CatalogItem>[] = [
    {
      key: 'picked',
      title: '',
      width: '44px',
      render: (item) => (
        <Checkbox
          checked={selected.includes(item.name)}
          onChange={() => toggle(item.name)}
          /* Клик по флажку не должен доигрываться до строки: `onRowClick`
             в системе висит на самом `<tr>`, и всплывший клик переключал бы
             выбор второй раз — то есть возвращал бы его обратно. */
          onClick={(event) => event.stopPropagation()}
          aria-label={`Выбрать ${item.name}`}
        />
      ),
    },
    {
      key: 'name',
      title: nameLabel,
      /* Кнопка строки живёт на названии, а не на флажке слева: доступным
         именем строки должно быть имя машины, а не «Выбрать КМД-2200Т». */
      render: (item) => <Text variant="label">{item.name}</Text>,
    },
    {
      key: 'edit',
      title: '',
      align: 'end',
      width: '52px',
      render: (item) => (
        <Button
          variant="ghost"
          size="sm"
          icon="pencil"
          aria-label={`Изменить данные: ${item.name}`}
          /* Правка — не выбор: клик по карандашу не должен доигрываться
             до строки и заодно отмечать машину (см. флажок выше). */
          onClick={(event) => {
            event.stopPropagation();
            setEditing({ item });
          }}
        />
      ),
    },
  ];

  return (
    <>
      <div className={styles.split}>
        {/* ── левая половина: параметры ── */}
        <div className={styles.pane}>
          <div className={styles.paneHead}>
            <Text variant="label">Параметры подбора</Text>
            <Button variant="ghost" size="sm" disabled={!hasParams} onClick={resetParams}>
              Сбросить
            </Button>
          </div>

          <div className={styles.params}>
            <Stack gap="md" direction="column">
              {/* Подписи здесь есть — в отличие от строки фильтров над
                  каталогом, где их намеренно нет. Там условия стоят в ряд,
                  и подпись над каждым удваивала бы высоту полосы; здесь
                  параметры идут столбцом, подпись занимает ту же строку,
                  что и так есть, а короткая запись величины («n, мин⁻¹»,
                  «P, МН») сама по себе ничего не говорит тому, кто видит
                  её впервые. Полное имя — в подсказке у подписи, тем же
                  приёмом, что и у полей геометрии на шаге 1. */}
              <Field
                label="Название"
                hint="Ищет и по значению характеристики: инженер помнит «2200», а не имя целиком."
                fullWidth
              >
                {(props) => (
                  <Input
                    {...props}
                    fullWidth
                    type="search"
                    placeholder="Название или значение"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                )}
              </Field>

              {/* Границы шкалы справочника подписывать отдельно не нужно:
                  они стоят подсказками в самих полях панели («от 900»,
                  «до 3500»), и строка под каждым из десяти условий
                  повторяла бы их второй раз. */}
              {rangeSpecs.map(({ spec, min, max }) => (
                <Field
                  key={spec.short}
                  label={spec.short}
                  labelHint={<FieldHint>{spec.label}</FieldHint>}
                  fullWidth
                >
                  {(props) => (
                    <RangeSelect
                      {...props}
                      fullWidth
                      placeholder={spec.short}
                      fromHint={formatBound(min)}
                      toHint={formatBound(max)}
                      value={ranges[spec.short] ?? EMPTY_RANGE}
                      onChange={(next) => setRanges((current) => ({ ...current, [spec.short]: next }))}
                    />
                  )}
                </Field>
              ))}
            </Stack>
          </div>
        </div>

        {/* ── правая половина: что подходит ── */}
        <div className={styles.pane}>
          <div className={styles.paneHead}>
            {/* Счётчик выбранного — всегда, а не вместо счётчика подходящих:
                это два разных ответа («сколько я взял» и «сколько ещё есть»),
                и подменять один другим при вводе параметра значит прятать
                от пользователя его собственный набор. */}
            <Stack gap="sm" direction="row" align="baseline">
              <Text variant="label">
                Выбрано {countLabel}: {selected.length}
              </Text>
              {hasParams ? (
                <Text variant="bodySm" color="textMuted">
                  подходит: {matchCount}
                </Text>
              ) : null}
            </Stack>
            <Button variant="secondary" size="sm" iconStart="plus" onClick={() => setEditing({ item: null })}>
              Новая
            </Button>
          </div>

          {/* Пустое состояние занимает всю половину, а не жмётся полоской
              под шапкой таблицы. Оно здесь — не «таблица, в которой пока
              нет строк», а единственное содержимое половины: столбец
              с одними названиями без единой строки не несёт ничего, ради
              чего стоило бы держать его шапку. Поэтому таблица уступает
              место целиком, а не отдаёт одну ячейку. */}
          {rows.length === 0 ? (
            <div className={styles.emptyPane} data-testid="match-empty">
              {hasParams ? (
                <EmptyState
                  icon="search"
                  title="Ничего не подходит"
                  description="Ослабьте условия слева или заведите свою позицию."
                />
              ) : (
                <EmptyState
                  icon="slidersHorizontal"
                  title="Задайте параметры слева"
                  /* «Подходящие позиции», а не «подходящие дробилок»:
                     `countLabel` стоит в родительном падеже — он для
                     счётчика («Выбрано дробилок: 2»), а не для подлежащего. */
                  description="Подходящие позиции появятся здесь."
                />
              )}
            </div>
          ) : (
            <div className={styles.paneScroll}>
              <Table
                columns={columns}
                rows={rows}
                rowKey={(item) => item.name}
                caption={nameLabel}
                captionHidden
                rowActionKey="name"
                stickyHeader
                onRowClick={(item) => toggle(item.name)}
              />
            </div>
          )}

          {/* Что именно поправили — под таблицей, как и просили: правка
              уходит в справочник молча, и без этого списка о ней потом
              напоминает только изменившееся число в ячейке. */}
          {catalog.changes.length > 0 ? (
            <div className={styles.changes}>
              <Stack gap="xs" direction="column">
                <Text variant="label">Изменения в справочнике</Text>
                {catalog.changes.map((change) => (
                  <Stack key={change.name} gap="xs" direction="column">
                    <Text variant="bodySm">
                      {change.name} — {change.kind === 'added' ? 'новая позиция' : 'данные изменены'}
                    </Text>
                    {change.fields.map((field) => (
                      <div key={field.spec} className={styles.changeLine}>
                        <Text variant="bodySm" color="textMuted">
                          {field.spec}: было {field.before} → стало {field.after}
                        </Text>
                      </div>
                    ))}
                  </Stack>
                ))}
              </Stack>
            </div>
          ) : null}
        </div>
      </div>

      <CatalogItemForm
        open={editing !== null}
        onClose={() => setEditing(null)}
        item={editing?.item ?? null}
        specs={catalog.specs}
        nameLabel={nameLabel}
        takenNames={catalog.items.map((item) => item.name)}
        onSave={saveEntry}
      />
    </>
  );
}
