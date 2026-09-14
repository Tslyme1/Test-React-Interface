import type { AngleUnit, GeomData } from '@/types';

/**
 * Поля формы «Геометрия», хранящие угол, а не длину, — те самые, у которых
 * в форме стоит суффикс `angleUnitSuffix` (`GeometryStep.tsx`). Отдельно
 * перечислены, а не выведены по названию поля: `a` — коэффициент профиля,
 * а не угол, и различить по одной букве нельзя.
 */
const ANGLE_FIELDS = ['b40', 'b10', 'b2', 'theta'] as const;

/** То же внутри зоны дробления: длина остаётся длиной, углы переводятся. */
const ZONE_ANGLE_FIELDS = ['b1', 'b4'] as const;

function toNum(raw: string): number | null {
  const n = Number(String(raw ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Переводит уже введённые значения углов при переключении `angleUnit` —
 * само поле само по себе меняет только подпись/суффикс, а число в нём
 * остаётся прежним. Без пересчёта то же число в градусах, прочитанное
 * как радианы (или наоборот), — совсем другой физический угол: 84,5°
 * это разумный угол профиля, а 84,5 рад — несколько полных оборотов,
 * и чертёж камеры при переключении единиц скакал именно поэтому.
 *
 * Округление до 4 знаков — достаточно для радиан (там числа в районе
 * 0–6) и с запасом для градусов, не накапливает видимый дрейф при
 * переключении туда и обратно несколько раз подряд.
 */
export function convertAngleUnit(data: GeomData, to: AngleUnit): Partial<GeomData> {
  if (data.angleUnit === to) return {};

  const factor = to === 'рад' ? Math.PI / 180 : 180 / Math.PI;
  const patch: Partial<GeomData> = { angleUnit: to };

  const convert = (raw: string): string | null => {
    const value = toNum(raw);
    return value === null ? null : String(Math.round(value * factor * 10000) / 10000);
  };

  for (const field of ANGLE_FIELDS) {
    const next = convert(data[field]);
    if (next !== null) patch[field] = next;
  }

  /* Зоны переводятся целиком новым массивом: точечная правка внутри
     объекта зоны разъехалась бы с тем, что форма считает текущими
     данными, — она сравнивает наборы по ссылке. */
  patch.zones = data.zones.map((zone) => ({
    ...zone,
    ...Object.fromEntries(
      ZONE_ANGLE_FIELDS.map((field) => [field, convert(zone[field]) ?? zone[field]] as const)
    ),
  }));

  return patch;
}
