import { useMemo, useState } from 'react';
import { Badge, Button, Checkbox, EmptyState, Field, Input, RangeSelect, Stack, Table, Text } from '@uralmash/design-system';
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
import { CatalogChangesModal } from '@/components/CatalogMatchPicker/CatalogChangesModal';
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
  /**
   * Позиции, тронутые в этой работе. Бейдж и окно изменений считаются
   * только по ним: правки справочника копятся навсегда и общие на все
   * проекты, а вопрос у пользователя — «что я поменял здесь», а не
   * «что вообще когда-либо правили в справочнике».
   */
  touched: string[];
  /** Позицию только что завели или поправили. */
  onTouch: (name: string) => void;
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
export function CatalogMatchPicker({
  kind,
  nameLabel,
  countLabel,
  selected,
  onChange,
  touched,
  onTouch,
}: CatalogMatchPickerProps) {
  const catalog = useUserCatalog(kind);

  const [query, setQuery] = useState('');
  const [ranges, setRanges] = useState<RangeMap>({});
  /** `null` — форма закрыта; `{ item: null }` — заводим свою позицию. */
  const [editing, setEditing] = useState<{ item: CatalogItem | null } | null>(null);
  const [changesOpen, setChangesOpen] = useState(false);

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

  /* Расхождения со справочником — только по тронутому здесь. Само
     расхождение при этом считается честно, от каталога: если значение
     вернули к паспортному, позиция уходит отсюда сама, даже оставшись
     в списке тронутых. */
  const changes = useMemo(
    () => catalog.changes.filter((change) => touched.includes(change.name)),
    [catalog.changes, touched]
  );

  const saveEntry = (entry: CatalogEntry) => {
    catalog.save(entry);
    onTouch(entry.name);
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
      /**
       * Карандаш стоит только у выбранной позиции.
       *
       * Правка данных — часть работы с машиной, которую взяли в расчёт,
       * а не способ листать справочник. У каждой из тридцати строк
       * карандаш превращал таблицу в список из тридцати предложений
       * что-нибудь поправить, хотя нужного среди них ровно столько,
       * сколько машин отмечено.
       *
       * Колонка при этом остаётся всегда: её ширина задана (`width`),
       * и появление кнопки не двигает колонку с названием.
       */
      render: (item) =>
        selected.includes(item.name) ? (
          <Button
            variant="ghost"
            size="sm"
            icon="pencil"
            aria-label={`Изменить данные: ${item.name}`}
            /* Правка — не выбор: клик по карандашу не должен доигрываться
               до строки и заодно снимать отметку с машины (см. флажок выше). */
            onClick={(event) => {
              event.stopPropagation();
              setEditing({ item });
            }}
          />
        ) : null,
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
              {/* Правки вынесены из-под таблицы в окно: под таблицей они
                  отъедали у неё треть половины ровно тогда, когда правок
                  много, — а это справка о уже сделанном, а не то, ради
                  чего экран открыт. Здесь же, рядом со счётчиком, о них
                  сказано одной строкой, и подробности открываются по ней. */}
              {changes.length > 0 ? (
                /* Бейдж, а не обычная кнопка: справочник разошёлся с
                   паспортными данными завода, и это состояние, требующее
                   внимания, — расчёт дальше пойдёт по правленым числам.
                   Кнопка без вида вокруг него — тем же приёмом, что
                   у образца цвета в сборе тега (`NewTagButton`): свой
                   вид у обёртки читался бы как рамка вокруг бейджа. */
                <button type="button" className={styles.badgeButton} onClick={() => setChangesOpen(true)}>
                  <Badge tone="warning" icon>
                    Данные {countLabel} изменены
                  </Badge>
                </button>
              ) : null}
            </Stack>
            <Button variant="ghost" size="sm" iconStart="plus" onClick={() => setEditing({ item: null })}>
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

        </div>
      </div>

      {/* Что именно разошлось со справочником. Окно во окне — каталог сам
          живёт внутри окна шага, поэтому Esc перехвачен так же, как
          у формы правки. */}
      <CatalogChangesModal
        open={changesOpen}
        onClose={() => setChangesOpen(false)}
        changes={changes}
        nameLabel={nameLabel}
        onRevert={catalog.revert}
      />

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
