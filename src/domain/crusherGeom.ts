import type { GeomData } from '@/types';
import { catalogOf } from '@/state/userCatalog';

/**
 * Первое число из значения справочника. Характеристики там записаны так,
 * как в паспорте машины, — и диапазоном тоже («15-25», «500-655»).
 */
export function firstNumber(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/**
 * Что из паспорта выбранной машины подставляется в форму геометрии
 * инженерного режима — только диаметр основания конуса.
 *
 * «D, мм» справочника и D методики — одна и та же величина, и не
 * подставить её значило бы заставить перепечатать в форму число,
 * которое только что выбрали в таблице.
 *
 * Разгрузочная щель оттуда НЕ берётся, в отличие от упрощённого режима
 * (`deriveGeomFromCrusher`). В каталоге «S, мм» — диапазон регулировки
 * («15-25»), а не установленное значение: взять его нижнюю границу
 * значило бы выбрать за пользователя настройку машины. Вдобавок S₀
 * по умолчанию — число контрольного примера §7 методики, на котором
 * стоит проверка расчёта профиля; молча заменять его границей диапазона
 * из паспорта — менять исходные данные примера, ничего об этом не сказав.
 */
export function applyCrusherToGeom(base: GeomData, crusherName: string): GeomData {
  const specs = catalogOf('crushers').find((c) => c.name === crusherName)?.values;
  const D = firstNumber(specs?.['D, мм']);
  return D !== null ? { ...base, D: String(D) } : base;
}
