/**
 * Ситовый анализ куска питания. Перенесено из прототипа
 * (`legacy-prototype/Дробилки КМД-КСД.dc.html`, `sieveTable` / `sieveComputed`) —
 * единственная часть прототипа с настоящей инженерной математикой, а не
 * иллюстративной оценкой.
 *
 * Смысл: таблица классов крупности даёт выход класса γᵢ, накопленные суммы
 * по плюсу и по минусу, средневзвешенную крупность d̄ и стандартное
 * отклонение σ. Из них — a₀ = d̄ / dmax и Va₀ = σ / d̄.
 *
 * Раньше источником было измерение — масса класса, а γᵢ/по плюсу/по минусу
 * считались от неё. Теперь источник — сама одна из трёх процентных величин
 * (`SieveInputMode`), а остальные две пересчитываются из неё: по минусу
 * и по плюсу дополняют друг друга до 100 %, частный класс — разность
 * соседних значений по плюсу (см. `Docs` методики-источника: γᵢⱼ —
 * разность накопленного выхода по плюсу на границах класса).
 */
import type { SieveInputMode, SieveRowData } from '@/types';

/** Строка ситовой таблицы — то, что вводит пользователь. */
export type SieveRow = SieveRowData;

/** Строка со всеми вычисленными по ней величинами. */
export type SieveComputedRow = SieveRow & {
  gamma: number;
  plus: number;
  minus: number;
  mid: number;
  hi: number;
};

export type SieveComputed = {
  rows: SieveComputedRow[];
  /** Сумма частных классов, % — по построению должна сойтись к 100. */
  total: number;
  dm: number;
  sigma: number;
  dmax: number;
  a0: number;
  va0: number;
};

function toNum(v: string): number {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Разбирает класс крупности вида `-0,5+0,3` на верхнюю (`hi`) и нижнюю (`lo`)
 * границу. Возвращает `null`, если строка не распознана — так вычисляемые
 * величины по такой строке считаются нулевыми, а не падают с ошибкой.
 */
export function parseSieveClass(cls: string): { hi: number; lo: number } | null {
  const normalized = String(cls ?? '').replace(/,/g, '.');
  const match = normalized.match(/(\d*\.?\d+)\s*\+\s*(\d*\.?\d+)/);
  if (!match) return null;
  return { hi: Number(match[1]), lo: Number(match[2]) };
}

/**
 * Накопленный выход по плюсу для каждой строки — из него линейно
 * получаются и по минусу (`100 − по плюсу`), и частный класс (разность
 * соседних значений по плюсу). Строки идут в том же порядке, в котором
 * их видит сама таблица сит — от крупного класса к мелкому, как и стоят
 * друг под другом настоящие сита в колонке.
 */
function plusSeries(rows: SieveRow[], mode: SieveInputMode): number[] {
  const raw = rows.map((r) => toNum(r.value));
  if (mode === 'plus') return raw;
  if (mode === 'minus') return raw.map((v) => 100 - v);
  // classes: введённое значение — сам частный класс, по плюсу — его накопленная сумма.
  let acc = 0;
  return raw.map((v) => {
    acc += v;
    return acc;
  });
}

/** Считает выход классов, суммы, d̄, σ, a₀ и Va₀ по введённой таблице. */
export function computeSieve(rows: SieveRow[], mode: SieveInputMode): SieveComputed {
  const plus = plusSeries(rows, mode);

  const computedRows: SieveComputedRow[] = rows.map((r, i) => {
    const bounds = parseSieveClass(r.cls);
    const minus = 100 - plus[i];
    const gamma = plus[i] - (i > 0 ? plus[i - 1] : 0);
    return {
      ...r,
      gamma,
      plus: plus[i],
      minus,
      mid: bounds ? (bounds.hi + bounds.lo) / 2 : 0,
      hi: bounds ? bounds.hi : 0,
    };
  });

  const total = computedRows.reduce((a, r) => a + r.gamma, 0);
  const dm = computedRows.reduce((a, r) => a + r.gamma * r.mid, 0) / 100;
  const varSum = computedRows.reduce((a, r) => a + r.gamma * (r.mid - dm) ** 2, 0) / 100;
  const sigma = Math.sqrt(Math.max(0, varSum));
  const dmax = computedRows.reduce((a, r) => Math.max(a, r.hi), 0);
  const va0 = dm ? sigma / dm : 0;
  const a0 = dmax ? dm / dmax : 0;

  return { rows: computedRows, total, dm, sigma, dmax, a0, va0 };
}

/**
 * Переводит введённые значения в другой режим при переключении «что
 * вводить» — так переключение не стирает уже введённые ряды молча,
 * а показывает то же самое распределение под новой величиной. Пустая
 * строка остаётся пустой: превращать её в «0,0» значило бы придумывать
 * измерение, которого не было.
 */
export function convertSieveRows(rows: SieveRow[], from: SieveInputMode, to: SieveInputMode): SieveRow[] {
  if (from === to) return rows;
  const computed = computeSieve(rows, from);
  return rows.map((r, i) => {
    if (!r.value.trim()) return r;
    const c = computed.rows[i];
    const next = to === 'plus' ? c.plus : to === 'minus' ? c.minus : c.gamma;
    // Точка, не запятая: значение уходит в `<Input type="number">`,
    // которому запятая (формат `fmt1` для читаемого текста) не годится.
    return { ...r, value: String(Math.round(next * 10) / 10) };
  });
}

/** Округление до 3 знаков — так же, как в прототипе перед записью в параметры. */
export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Округление до 1 знака — для отображения выхода классов и сумм. */
export function fmt1(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
}
