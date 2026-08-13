/**
 * Ситовый анализ продукта дробления. Перенесено из прототипа
 * (`legacy-prototype/Дробилки КМД-КСД.dc.html`, `sieveTable` / `sieveComputed`) —
 * единственная часть прототипа с настоящей инженерной математикой, а не
 * иллюстративной оценкой.
 *
 * Смысл: таблица классов крупности с массой класса даёт выход класса γᵢ,
 * накопленные суммы по плюсу и по минусу, средневзвешенную крупность d̄
 * и стандартное отклонение σ. Из них — a₀ = d̄ / dmax и Va₀ = σ / d̄.
 */
import type { SieveRowData } from '@/types';

/**
 * Строка ситовой таблицы — то, что вводит пользователь.
 * Совпадает по форме с `SieveRowData` из `@/types` (это и есть тип поля
 * `ProdData.sieveRows`): переиспользуем его вместо второго определения,
 * чтобы форма строки не могла разъехаться между доменом и состоянием проекта.
 */
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

/** Считает выход классов, суммы, d̄, σ, a₀ и Va₀ по введённой таблице. */
export function computeSieve(rows: SieveRow[]): SieveComputed {
  const masses = rows.map((r) => toNum(r.mass));
  const total = masses.reduce((a, b) => a + b, 0);

  let acc = 0;
  const computedRows: SieveComputedRow[] = rows.map((r, i) => {
    const gamma = total ? (masses[i] / total) * 100 : 0;
    const minus = 100 - acc;
    acc += gamma;
    const bounds = parseSieveClass(r.cls);
    return {
      ...r,
      gamma,
      plus: acc,
      minus,
      mid: bounds ? (bounds.hi + bounds.lo) / 2 : 0,
      hi: bounds ? bounds.hi : 0,
    };
  });

  const dm = computedRows.reduce((a, r) => a + r.gamma * r.mid, 0) / 100;
  const varSum = computedRows.reduce((a, r) => a + r.gamma * (r.mid - dm) ** 2, 0) / 100;
  const sigma = Math.sqrt(Math.max(0, varSum));
  const dmax = computedRows.reduce((a, r) => Math.max(a, r.hi), 0);
  const va0 = dm ? sigma / dm : 0;
  const a0 = dmax ? dm / dmax : 0;

  return { rows: computedRows, total, dm, sigma, dmax, a0, va0 };
}

/** Округление до 3 знаков — так же, как в прототипе перед записью в параметры. */
export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Округление до 1 знака — для отображения выхода классов и сумм. */
export function fmt1(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
}
