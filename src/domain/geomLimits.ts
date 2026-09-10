import type { GeomData } from '@/types';
import { buildChamberProfileInput } from '@/domain/chamberInput';

/**
 * Границы исходных данных этапа 1.
 *
 * Зачем они. Методика считает профиль рекурсией и почти на любых числах
 * что-нибудь да выдаёт: при угле нутации в миллион градусов формулы
 * отработают и нарисуют фигуру, которая к дробилке отношения не имеет.
 * Молча считать по такому вводу хуже, чем сказать о нём на первом же шаге.
 *
 * Откуда взяты. Три источника, в порядке убывания жёсткости:
 *
 * 1. **Прямые запреты методики.** β₄₀ > π/2 в автомате `Dwigenue`
 *    не реализован — расчёт куска аварийно завершается (§8.1 подробной
 *    документации). Угол нутации входит в знаменатель минимальной частоты
 *    качаний `nmin` (§4.5.4), поэтому нулём быть не может.
 * 2. **Смысл величины.** Угол при основании конуса вне (0°, 90°) — это уже
 *    не конус: при нуле образующая горизонтальна, при 90° вырождается
 *    в ось. Длины и габариты положительны по определению.
 * 3. **Диапазон реальных машин** — по двум комплектам исходных данных,
 *    которые есть на руках: КСД-2200Гр-ДМ (контрольный пример §7) и
 *    КМД-1750Т7-Д Коркино (описание задачи заказчика). Здесь границы
 *    намеренно шире обоих комплектов: это защита от опечатки на порядок,
 *    а не запрет считать нетиповую камеру.
 *
 * Границы не режут введённое значение молча: поле показывает ошибку,
 * а число остаётся как есть. Подменять ввод пользователя своим —
 * худший вид «валидации»: правку легко не заметить.
 */
export type GeomLimit = {
  min: number;
  max: number;
  /** `deg` — границы заданы в градусах и переводятся, если форма в радианах. */
  kind: 'deg' | 'mm' | 'm';
  /** Чем продиктована граница — идёт и в текст ошибки, и в справку. */
  why: string;
};

const ANGLE_CONE: Pick<GeomLimit, 'min' | 'max' | 'kind'> = { min: 1, max: 89, kind: 'deg' };
const ANGLE_BOWL: Pick<GeomLimit, 'min' | 'max' | 'kind'> = { min: 1, max: 90, kind: 'deg' };
const ZONE_LENGTH: Pick<GeomLimit, 'min' | 'max' | 'kind'> = { min: 10, max: 2000, kind: 'mm' };

export const GEOM_LIMITS = {
  b10: { ...ANGLE_CONE, why: 'Угол при основании конуса: вне (0°; 90°) образующая либо горизонтальна, либо вырождается в ось.' },
  b11: { ...ANGLE_CONE, why: 'Угол при основании конуса: вне (0°; 90°) образующая либо горизонтальна, либо вырождается в ось.' },
  b12: { ...ANGLE_CONE, why: 'Угол при основании конуса: вне (0°; 90°) образующая либо горизонтальна, либо вырождается в ось.' },
  b2: { ...ANGLE_CONE, why: 'Угол при основании конуса в зоне калибровки: вне (0°; 90°) зона перестаёт быть зоной.' },

  b40: { ...ANGLE_BOWL, why: 'Угол при основании чаши. Свыше 90° методика расчёт не ведёт: ветка β₄₀ > π/2 в модели движения куска не реализована (§8.1).' },
  b41: { ...ANGLE_BOWL, why: 'Угол при основании чаши: свыше 90° образующая уходит внутрь камеры.' },
  b42: { ...ANGLE_BOWL, why: 'Угол при основании чаши: свыше 90° образующая уходит внутрь камеры.' },

  theta: {
    min: 0.1,
    max: 6,
    kind: 'deg',
    why: 'Перекос оси конуса. При нуле конус не качается и дробления нет — угол стоит в знаменателе минимальной частоты качаний (§4.5.4). У реальных КСД и КМД это 1–3°.',
  },

  l11: { ...ZONE_LENGTH, why: 'Длина зоны дробления вдоль образующей. У машин на руках 150–393 мм.' },
  l12: { ...ZONE_LENGTH, why: 'Длина зоны дробления вдоль образующей. У машин на руках 150–393 мм.' },
  l2: { min: 10, max: 1000, kind: 'mm', why: 'Длина зоны калибровки ниже последнего сечения. У машин на руках 152 и 360 мм.' },

  D: { min: 300, max: 4000, kind: 'mm', why: 'Диаметр основания дробящего конуса. Типоразмеры КСД и КМД — от 600 до 3000 мм.' },
  H: { min: 100, max: 3000, kind: 'mm', why: 'Расстояние от точки подвеса до основания конуса. У машин на руках 595 и 823 мм.' },
  S0: { min: 1, max: 150, kind: 'mm', why: 'Разгрузочная щель на закрытой стороне. У КМД это единицы миллиметров, у КСД — десятки.' },

  R: { min: 0.1, max: 10, kind: 'm', why: 'Плечо приведения усилия до оси дробилки, в метрах. У машин на руках 1,28 и 1,4 м.' },
  a: { min: 0.01, max: 5, kind: 'm', why: 'Плечо до точки опрокидывания опорного блока, в метрах. У машин на руках 0,12 и 0,436 м.' },
} as const satisfies Partial<Record<keyof GeomData, GeomLimit>>;

export type LimitedField = keyof typeof GEOM_LIMITS;

export const LIMITED_FIELDS = Object.keys(GEOM_LIMITS) as LimitedField[];

function toNum(raw: string): number | null {
  const n = Number(String(raw ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Границы в тех единицах, в которых поле показано прямо сейчас. */
export function limitIn(field: LimitedField, data: GeomData): { min: number; max: number; unit: string } {
  const limit = GEOM_LIMITS[field];
  if (limit.kind !== 'deg') {
    return { min: limit.min, max: limit.max, unit: limit.kind === 'm' ? 'м' : 'мм' };
  }
  if (data.angleUnit === 'рад') {
    const k = Math.PI / 180;
    return { min: Math.round(limit.min * k * 1e4) / 1e4, max: Math.round(limit.max * k * 1e4) / 1e4, unit: 'рад' };
  }
  return { min: limit.min, max: limit.max, unit: '°' };
}

function fmt(v: number): string {
  return String(Math.round(v * 1e4) / 1e4).replace('.', ',');
}

export type GeomErrors = Partial<Record<keyof GeomData, string>>;

/**
 * Проверка ввода этапа 1: сначала границы отдельных величин, затем две
 * связи между ними, которые нельзя выразить границей одного поля.
 *
 * Связи взяты из шага 2 методики: нижнее расчётное сечение отстоит от
 * основания конуса на зону калибровки, и если та длиннее самого конуса,
 * сечение уезжает за ось или выше точки подвеса — дальше рекурсия считает
 * уже несуществующую камеру.
 */
export function validateGeom(data: GeomData): GeomErrors {
  const errors: GeomErrors = {};

  for (const field of LIMITED_FIELDS) {
    const value = toNum(data[field]);
    if (value === null) {
      errors[field] = 'Нужно число';
      continue;
    }
    const { min, max, unit } = limitIn(field, data);
    if (value < min || value > max) {
      /* Градус пишется вплотную к числу, остальные единицы — через пробел. */
      const tail = unit === '°' ? `${fmt(max)}°` : `${fmt(max)} ${unit}`;
      errors[field] = `Допустимо от ${fmt(min)} до ${tail}`;
    }
  }

  if (errors.l2 || errors.D || errors.H || errors.b2) return errors;

  const input = buildChamberProfileInput(data);
  const DI2 = input.D - 2 * input.l2 * Math.cos(input.beta2);
  const H2 = input.H - input.l2 * Math.sin(input.beta2);

  if (DI2 <= 0) {
    errors.l2 = 'Зона калибровки шире основания конуса: D − 2·l₂·cos β₂ должно быть больше нуля';
  } else if (H2 <= 0) {
    errors.l2 = 'Зона калибровки выше точки подвеса: H − l₂·sin β₂ должно быть больше нуля';
  }

  return errors;
}

/** Есть ли хоть одна ошибка — для блокировки расчёта по заведомо неверным данным. */
export function hasGeomErrors(data: GeomData): boolean {
  return Object.keys(validateGeom(data)).length > 0;
}
