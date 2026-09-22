import type { Project, StepKey } from '@/types';
import { crushingZones } from './chamberInput';

/** Пара «величина — значение» в сводке исходных данных этапа. */
export type SummaryItem = {
  label: string;
  value: string;
  /** Строка выбранной позиции справочника — рядом с именем стоит её правка. */
  catalog?: { kind: 'crushers' | 'ores'; nameLabel: string };
};

/**
 * С чем считали этап — то, что читают, чтобы убедиться, что считали
 * с тем, с чем собирались.
 *
 * Вынесено из `StepOverview`, когда мест стало два: та же сводка идёт
 * в отчёт (`ReportBuilderModal`). Копия списка в отчёте разошлась бы
 * со страницей на первом же новом поле формы — и распечатка начала бы
 * умалчивать о параметре, который на экране виден.
 */
export function stepSummary(project: Project, stepKey: StepKey): SummaryItem[] {
  const { geom, gran, prod } = project.data;

  if (stepKey === 'geom') {
    const angle = geom.angleUnit === 'рад' ? 'рад' : '°';
    return [
      { label: 'Дробилка', value: project.crusherName || '—', catalog: { kind: 'crushers', nameLabel: 'Дробилка' } },
      { label: 'Диаметр основания D', value: `${geom.D} мм` },
      { label: 'Высота H от подвеса', value: `${geom.H} мм` },
      { label: 'Разгрузочная щель S₀', value: `${geom.S0} мм` },
      { label: 'Угол нутации θ', value: `${geom.theta} ${angle}` },
      { label: 'Зон дробления', value: String(crushingZones(geom)) },
      { label: 'Длина зоны калибровки l₂', value: `${geom.l2} мм` },
      { label: 'Углы зоны входа β₁₀ · β₄₀', value: `${geom.b10} · ${geom.b40} ${angle}` },
    ];
  }

  if (stepKey === 'gran') {
    return [
      { label: 'Проба руды', value: project.ore || '—', catalog: { kind: 'ores', nameLabel: 'Проба руды' } },
      { label: 'Минимальная крупность Dmin', value: `${gran.dMin} мм` },
      { label: 'Кондиционная крупность Dk', value: `${gran.dk} мм` },
      { label: 'Максимальная крупность Dmax', value: `${gran.dMax} мм` },
      { label: 'Параметр Z0', value: gran.z0 },
      { label: 'Параметр S00', value: gran.s00 },
      { label: 'Параметр N0', value: gran.n0 },
      { label: 'Форма куска a₀ · Va₀', value: `${gran.a0 || '—'} · ${gran.va0 || '—'}` },
    ];
  }

  return [
    { label: 'Тип питания', value: prod.feedType === 'wet' ? 'Влажное' : 'Сухое' },
    { label: 'Минимальная крупность продукта', value: `${prod.dMin} мм` },
    { label: 'Максимальная крупность продукта', value: `${prod.dMax} мм` },
    { label: 'Работа разрушения Wk', value: prod.wk },
    { label: 'Работа измельчения Wm', value: prod.wm },
    { label: 'КПД дробления', value: prod.kpd },
  ];
}
