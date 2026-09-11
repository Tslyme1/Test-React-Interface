import type { Range } from '@uralmash/design-system';
import type { CatalogItem, SpecColumn } from '@/data/crushers';

/**
 * Отбор позиций справочника по характеристикам.
 *
 * Вынесено из `CatalogPicker` отдельным модулем, потому что тем же
 * отбором живёт подбор по параметрам в упрощённом режиме
 * (`CatalogMatchPicker`): условия там задаются слева, а не в окне
 * фильтров, но правила — те же самые. Две копии этих правил разошлись бы
 * на первой же правке.
 *
 * Все величины здесь инженерные и неоднородные: «2200», «5-15»,
 * «160/250», «16.8 (15-18)», «—». Отсюда и осторожность разбора.
 */

/** Прочерк в справочнике: величина не измерялась. */
export const DASH = '—';

/** Границы как их ввели: пустая строка — граница не задана, а не ноль. */
export const EMPTY_RANGE: Range = { from: '', to: '' };

/** Границы по короткой подписи колонки. */
export type RangeMap = Record<string, Range>;

/** Колонка, пригодная для отбора диапазоном, и шкала её значений в справочнике. */
export type RangeSpec = { spec: SpecColumn; min: number; max: number };

/** Разобранное условие: `null` — граница не задана. */
export type Bound = { key: string; from: number | null; to: number | null };

/**
 * Колонки, по которым можно отбирать диапазоном.
 *
 * Не все: у дробилок значения числовые целиком, а у проб руды половина
 * колонок — словесные («до 170», «X (очень крепкие)», «высокоабраз.
 * Ка=3.16»). Поле «от — до» над такой колонкой обещало бы отбор, которого
 * не выйдет: сравнивать там нечего. Поэтому набор фильтров выводится
 * из самих значений, а не из списка колонок.
 *
 * Границы шкалы берутся по всему справочнику, а не по текущей выборке:
 * подсказка «от 900» не должна ездить вслед за уже применённым фильтром.
 */
export function rangeSpecsOf(specs: SpecColumn[], items: CatalogItem[]): RangeSpec[] {
  const out: RangeSpec[] = [];

  for (const spec of specs) {
    const values = items.map((item) => item.values[spec.short] ?? '').filter((v) => v && v !== DASH);
    if (values.length === 0 || !values.every(isNumericValue)) continue;

    const numbers = values.flatMap(numbersIn);
    if (numbers.length === 0) continue;

    out.push({ spec, min: Math.min(...numbers), max: Math.max(...numbers) });
  }

  return out;
}

/** Условия, которые действительно что-то ограничивают: пустая пара полей условием не является. */
export function toBounds(rangeSpecs: RangeSpec[], map: RangeMap): Bound[] {
  return rangeSpecs
    .map(({ spec }) => {
      const range = map[spec.short] ?? EMPTY_RANGE;
      return { key: spec.short, from: parseBound(range.from), to: parseBound(range.to) };
    })
    .filter((bound) => bound.from !== null || bound.to !== null);
}

/**
 * Пересекается ли значение строки с запрошенными границами — по каждому условию.
 *
 * Пересечение, а не попадание целиком: значение в ячейке само бывает
 * диапазоном («5-15»), и машина с щелью 5-15 обязана найтись по запросу
 * «от 10». Требовать, чтобы весь её диапазон уложился в запрошенный,
 * значило бы прятать ровно те машины, которые подходят.
 */
export function withinBounds(item: CatalogItem, bounds: Bound[]): boolean {
  return bounds.every((bound) => {
    const span = spanOf(item.values[bound.key]);
    if (!span) return false;
    if (bound.from !== null && span.hi < bound.from) return false;
    if (bound.to !== null && span.lo > bound.to) return false;
    return true;
  });
}

/**
 * Сравнение значений характеристик.
 *
 * Сортировка по строке поставила бы «1200» выше «900», поэтому сравниваем
 * по первому числу, а к строковому сравнению падаем только когда числа нет.
 * Прочерк всегда уходит вниз: отсутствие величины — не наименьшее значение.
 */
export function compareSpecValues(a: string, b: string): number {
  if (a === DASH && b === DASH) return 0;
  if (a === DASH) return 1;
  if (b === DASH) return -1;

  const na = leadingNumber(a);
  const nb = leadingNumber(b);
  if (na !== null && nb !== null && na !== nb) return na - nb;

  return a.localeCompare(b, 'ru', { numeric: true });
}

/** Подсказка в поле: целое — без хвоста, дробное — с запятой, как в справочнике. */
export function formatBound(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',');
}

/** Совпадает ли позиция со строкой поиска — по имени или по любому значению. */
export function matchesQuery(item: CatalogItem, query: string): boolean {
  if (!query) return true;
  // Ищем и по названию, и по значениям: инженер помнит «2200», а не имя целиком.
  return (
    item.name.toLowerCase().includes(query) ||
    Object.values(item.values).some((v) => v.toLowerCase().includes(query))
  );
}

function leadingNumber(value: string): number | null {
  const match = value.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/**
 * Годится ли колонка для отбора диапазоном: каждое её значение состоит
 * из чисел и разделителей. Любая буква означает словесную величину,
 * а её нельзя ни сравнить, ни отобрать по границам.
 *
 * Классы записаны через 0-9, а не через сокращения: в них не должно
 * оказаться ни букв, ни знаков, которых мы не разбираем.
 */
function isNumericValue(value: string): boolean {
  return /[0-9]/.test(value) && /^[0-9 .,()/–—-]+$/.test(value);
}

/** Все числа значения по порядку. Знак не разбирается: отрицательных величин в справочниках нет. */
function numbersIn(value: string): number[] {
  return [...value.matchAll(/[0-9]+(?:[.,][0-9]+)?/g)].map((m) => Number(m[0].replace(',', '.')));
}

/**
 * Отрезок, который занимает значение ячейки: «5-15» — это [5, 15], «2200» —
 * точка [2200, 2200]. Прочерк отрезка не даёт: неизмеренная величина
 * ни в какие границы не попадает.
 */
function spanOf(value: string | undefined): { lo: number; hi: number } | null {
  if (!value || value === DASH) return null;
  const numbers = numbersIn(value);
  if (numbers.length === 0) return null;
  return { lo: Math.min(...numbers), hi: Math.max(...numbers) };
}

/** Введённая граница. Пустая строка и нечисло — «не задано», а не ноль. */
function parseBound(input: string): number | null {
  const raw = input.trim().replace(',', '.');
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}
