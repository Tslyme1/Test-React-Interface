import type { GeomData, GranData, Project, ProdData, StepKey } from '@/types';
import { STEP_TITLES } from './steps';
import { buildChamberProfileInput, crushingZones } from './chamberInput';
import { computeChamberProfile } from './chamberProfile';

/**
 * Значения для экрана результатов.
 *
 * Состав отчёта повторяет распечатку программы-источника (пример расчёта
 * КМД-2200Т6 Мих.ГОК): по шагу «Геометрия» — параметры камеры и таблица
 * профиля по точкам, по «Грансоставу» — массивы D пред / D сред / 0.8·D пред
 * с долями классов, по «Продукту» — характерные крупности, усилия и мощность.
 *
 * Геометрия здесь считается по-настоящему и по методике: таблица профиля —
 * это выход `computeChamberProfile` (этап 1, §3.2 подробной документации),
 * тот же, что задаёт и чертёж. На контрольном примере она воспроизводит
 * таблицу из документации до последнего знака. Всё остальное — иллюстративные
 * оценки: в прототипе
 * реальных формул дробления не было («dummy formulas so each screen feels
 * calculated»), и честнее показать это прямо, чем выдать приблизительное
 * за инженерную методику.
 */

const toNum = (v: string): number => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/** Строка «величина — значение — единица». */
export type KvRow = { label: string; value: string; unit: string };

/**
 * Строка таблицы профиля — расчётное сечение камеры. Столбцы те же, что
 * печатает отчёт этапа 1 (§6.2 подробной документации).
 */
export type ProfileRow = {
  /** Номер сечения: 0 — верх камеры, последнее — разгрузочная кромка. */
  i: string;
  /** L1 — длина участка вдоль образующей, мм. */
  l: string;
  /** β₁ — угол образующей брони конуса. */
  b1: string;
  /** R1 — радиус-вектор внутреннего контура (броня конуса), мм. */
  r1: string;
  /** α₁ — угол этого радиус-вектора к оси дробилки. */
  a1: string;
  /** β₄ — угол образующей брони чаши. */
  b4: string;
  /** R4 — радиус-вектор внешнего контура (броня чаши), мм. */
  r4: string;
  /** α₄ — угол этого радиус-вектора к оси дробилки. */
  a4: string;
  /** L сум — накопленная длина профиля от верха камеры, мм. */
  lSum: string;
  /** S1 — раскрытие камеры вдоль хода эксцентрика, мм. */
  s1: string;
  /** S1 отк — просвет по нормали: фактический размер для куска, мм. */
  sot: string;
};

/** Строка грансостава: класс крупности и его доля. */
export type GranRow = {
  class: string;
  /** D пред — верхняя граница класса, мм. */
  dTop: string;
  /** D сред — середина класса, мм. */
  dMid: string;
  /** 0.8·D пред — расчётная ширина куска, мм. */
  d08: string;
  /** γ — доля класса. */
  gamma: string;
  /** Выход по минусу, %. */
  pass: string;
};

/**
 * Углы отчёта — в тех же единицах, что и форма: методика ведёт расчёт
 * в радианах и печатает их же, но если пользователь работает в градусах,
 * показывать ему радианы значило бы заставить пересчитывать в уме.
 */
function angleOut(rad: number, data: GeomData): string {
  return (data.angleUnit === 'рад' ? rad : (rad * 180) / Math.PI).toFixed(4);
}

function angleUnitLabel(data: GeomData): string {
  return data.angleUnit === 'рад' ? 'рад' : 'град';
}

/** Профиль камеры по расчётным сечениям — таблица отчёта этапа 1. */
export function estimateGeomProfile(data: GeomData): ProfileRow[] {
  const { sections } = computeChamberProfile(buildChamberProfileInput(data));

  return sections.map((s) => ({
    i: String(s.index),
    l: s.l1.toFixed(1),
    b1: angleOut(s.beta1, data),
    r1: s.R1.toFixed(1),
    a1: angleOut(s.alpha1, data),
    b4: angleOut(s.beta4, data),
    r4: s.R4.toFixed(1),
    a4: angleOut(s.alpha4, data),
    lSum: s.lSum.toFixed(1),
    /* Верхнее сечение дублирует первое и собственного раскрытия не имеет —
       в отчёте методики эти две клетки пустые, а не нулевые. */
    s1: s.index === 0 ? '—' : s.S1.toFixed(2),
    sot: s.index === 0 ? '—' : s.SOT.toFixed(2),
  }));
}

/**
 * Пять критических углов поворота эксцентрика — границы зон с разными
 * условиями трения; на этапах 2–3 по ним находится рабочий угол.
 */
export function estimateGeomAlfa(data: GeomData): KvRow[] {
  const { alfa } = computeChamberProfile(buildChamberProfileInput(data));
  const unit = angleUnitLabel(data);
  return alfa.map((value, i) => ({
    label: `ALFA ${i + 1}`,
    value: angleOut(value, data),
    unit,
  }));
}

/**
 * Встроенные проверки корректности профиля (§3.4 подробной документации).
 * Показываются рядом с таблицей: методика прямо называет их признаком
 * ошибки в исходных данных, и молча считать дальше по неверному профилю
 * хуже, чем сказать об этом на самом первом шаге.
 */
export type CheckRow = { label: string; value: string; ok: boolean };

export function estimateGeomChecks(data: GeomData): CheckRow[] {
  const input = buildChamberProfileInput(data);
  const { sections, KU } = computeChamberProfile(input);
  const last = sections[KU];

  const closes = Math.abs(last.S1 - input.S0) < 0.05;

  /* SOT обязан убывать сверху вниз: камера сужается к разгрузке. Рост
     означает ошибку в углах чаши — профиль «расходится». */
  let monotone = true;
  for (let i = 2; i <= KU; i += 1) {
    if (sections[i].SOT > sections[i - 1].SOT + 1e-6) monotone = false;
  }

  const angles = sections.every(
    (s) => s.alpha1 > 0 && s.alpha1 < Math.PI / 2 && s.alpha4 > 0 && s.alpha4 < Math.PI / 2
  );

  return [
    {
      label: 'S1 в нижнем сечении = S₀',
      value: `${last.S1.toFixed(2)} / ${input.S0.toFixed(2)} мм`,
      ok: closes,
    },
    {
      label: 'Просвет SOT убывает сверху вниз',
      value: monotone ? 'да' : 'нет — проверьте углы чаши β₄',
      ok: monotone,
    },
    {
      label: 'Все α в пределах (0; 90°)',
      value: angles ? 'да' : 'нет — профиль не замыкается',
      ok: angles,
    },
  ];
}

export function estimateGeom(data: GeomData): KvRow[] {
  const input = buildChamberProfileInput(data);
  const { sections, KU, R2, AL2, DI2, H2 } = computeChamberProfile(input);
  const top = sections[1];
  const last = sections[KU];
  const unit = angleUnitLabel(data);

  /**
   * Объём камеры — усечённый конус между бронями, м³. Оценка по габаритам,
   * а не интеграл по профилю: в распечатке это отдельная величина Q,
   * посчитанная своей методикой.
   */
  const volume = (Math.PI / 4) * Math.pow(input.D / 1000, 2) * (input.H / 1000) * 0.33;

  return [
    { label: 'D — диаметр основания конуса', value: input.D.toFixed(1), unit: 'мм' },
    { label: 'H — до основания конуса от подвеса', value: input.H.toFixed(1), unit: 'мм' },
    { label: 'S₀ — разгрузочная щель', value: input.S0.toFixed(1), unit: 'мм' },
    { label: 'θ — угол нутации', value: angleOut(input.theta, data), unit },
    { label: 'Число зон дробления', value: String(crushingZones(data)), unit: '' },
    { label: 'Число расчётных сечений', value: String(KU + 1), unit: '' },

    { label: 'DI2 — диаметр нижнего сечения', value: DI2.toFixed(1), unit: 'мм' },
    { label: 'H2 — высота нижнего сечения', value: H2.toFixed(1), unit: 'мм' },
    { label: 'R2 — радиус-вектор разгрузочной кромки', value: R2.toFixed(1), unit: 'мм' },
    { label: 'α₂ — его угол к оси', value: angleOut(AL2, data), unit },

    { label: 'S1 в верхнем сечении', value: top.S1.toFixed(2), unit: 'мм' },
    { label: 'SOT в верхнем сечении — приёмное отверстие', value: top.SOT.toFixed(2), unit: 'мм' },
    { label: 'SOT в нижнем сечении', value: last.SOT.toFixed(2), unit: 'мм' },
    { label: 'L сум — полная длина профиля', value: last.lSum.toFixed(1), unit: 'мм' },
    { label: 'Q — объём камеры', value: volume.toFixed(4), unit: 'м³' },
  ];
}

/**
 * Шкала классов крупности — геометрическая прогрессия от `dMin` к `dMax`,
 * как «Массив D пред(I)» распечатки: у мелких классов шаг мельче, у крупных
 * крупнее, потому что распределение продукта тоже неравномерно.
 */
/**
 * Классы крупности геометрической прогрессией от `dMin` к `dMax` — общий
 * генератор для питания (`estimateGran`) и продукта (`estimateProdGran`):
 * у обоих один и тот же смысл столбцов, разнится только откуда берутся
 * `dMin`/`dMax` и форма кривой (`k`, `z0`).
 */
function buildGranClasses(dMin: number, dMaxRaw: number, k: number, z0: number): GranRow[] {
  const dMax = Math.max(dMaxRaw, dMin + 1);
  const kSafe = Math.max(k, 0.1);
  const z0Safe = Math.max(z0, 0.1);

  const steps = 8;

  /* Накопленный выход нормируется на самый крупный класс.
     Сырая экспонента насыщается медленнее шкалы классов и до сотни
     не доходит: при n₀ = 0,6 верхний класс давал 83,5 %, то есть
     таблица утверждала, что 16,5 % питания крупнее собственного
     `dMax`. Нормировка убирает это, не трогая форму кривой. */
  const rawPass = Array.from({ length: steps + 1 }, (_, i) => 1 - Math.exp((-kSafe * i * 3) / steps));
  const full = rawPass[steps] || 1;
  const passAt = (i: number) => Math.min((rawPass[i] / full) * 100, 100);

  const rows: GranRow[] = [];
  let prevTop = dMin;

  for (let i = 1; i <= steps; i += 1) {
    // Прогрессия по кубу доли — мелкие классы дробятся чаще крупных.
    const top = dMin + (dMax - dMin) * Math.pow(i / steps, 1 / z0Safe);
    const mid = (prevTop + top) / 2;

    rows.push({
      class: `−${top.toFixed(1)} +${prevTop.toFixed(1)}`,
      dTop: top.toFixed(2),
      dMid: mid.toFixed(2),
      d08: (top * 0.8).toFixed(2),
      gamma: ((passAt(i) - passAt(i - 1)) / 100).toFixed(4),
      pass: passAt(i).toFixed(1),
    });

    prevTop = top;
  }

  /* Крупный класс — первым: таблица читается сверху вниз от 100 %
     по уменьшению, как её и читают в отчёте. Строится она снизу вверх,
     от мелкого класса: накопленный выход по минусу иначе не посчитать —
     он копится именно от мелочи. */
  return rows.reverse();
}

export function estimateGran(data: GranData): GranRow[] {
  return buildGranClasses(toNum(data.dMin), toNum(data.dMax), toNum(data.n0), toNum(data.z0));
}

/**
 * Грансостав ПРОДУКТА — тот же генератор классов, что и у питания, но
 * по границам `dMin`/`dMax` продукта и с формой кривой от работы разрушения
 * `wk` (чем она больше, тем круче кривая — продукт однороднее по крупности).
 * В распечатке программы-источника это отдельный блок расчёта («РАСЧЕТ
 * ГРАНСОСТАВА ПРОДУКТА»), а не побочный вывод усилий и мощности — здесь
 * то же самое: `estimateProd` считает силовые величины, эта функция —
 * состав по классам для таблицы и графика.
 */
export function estimateProdGran(data: ProdData): GranRow[] {
  // `wk` — работа разрушения, на порядок крупнее шкалы `k`, на которой
  // построен `buildGranClasses` (там она играет роль `n0` из GranData,
  // диапазон ~0.5–1.5): без пересчёта кривая выхода насыщалась до 100 %
  // уже на втором классе, и распределение выглядело ступенькой, а не
  // плавной S-образной кривой.
  const k = Math.max(toNum(data.wk) / 15, 0.1);
  return buildGranClasses(toNum(data.dMin), toNum(data.dMax), k, 1);
}

export function estimateProd(data: ProdData, geom: GeomData): KvRow[] {
  const D = toNum(geom.D);
  const S0 = toNum(geom.S0);
  const dMax = toNum(data.dMax);
  const kpd = toNum(data.kpd) || 0.8;

  /** Характерные крупности продукта — D₀₅ и производные от него, как в USILK. */
  const d05 = Math.max(dMax * 0.96, S0);
  const dSred = d05 * 0.63;

  const capacity = (D * S0 * kpd) / 1000;
  /** Усилие дробления — оценка по площади щели и удельному сопротивлению. */
  const force = (D / 1000) * (S0 / 1000) * 24;
  /** Мощность — работа разрушения на производительность, с поправкой на КПД. */
  const power = (capacity * 0.9) / Math.max(kpd, 0.1);

  return [
    { label: 'D₀₅ — крупность 50 % выхода', value: d05.toFixed(2), unit: 'мм' },
    { label: '0.8 · D₀₅', value: (d05 * 0.8).toFixed(2), unit: 'мм' },
    { label: 'D ср — средний диаметр куска', value: dSred.toFixed(2), unit: 'мм' },
    { label: 'Максимальная крупность продукта', value: data.dMax, unit: 'мм' },
    { label: 'Q — производительность', value: capacity.toFixed(1), unit: 'т/ч' },
    { label: 'P — усилие дробления', value: force.toFixed(2), unit: 'МН' },
    { label: 'N — мощность дробления', value: power.toFixed(1), unit: 'кВт' },
    { label: 'КПД привода', value: (kpd * 100).toFixed(0), unit: '%' },
  ];
}

export type StepReport =
  | { kind: 'kv'; title: string; rows: KvRow[]; profile?: ProfileRow[]; gran?: GranRow[] }
  | { kind: 'gran'; title: string; rows: GranRow[] };

/**
 * Одна и та же оценка — что на экране в панели результата, что в печати:
 * оба места собирают отчёт отсюда, а не считают заново каждое по-своему.
 */
export function buildStepReport(project: Project, stepKey: StepKey): StepReport {
  if (stepKey === 'gran') {
    return { kind: 'gran', title: STEP_TITLES.gran, rows: estimateGran(project.data.gran) };
  }
  if (stepKey === 'prod') {
    return {
      kind: 'kv',
      title: STEP_TITLES.prod,
      rows: estimateProd(project.data.prod, project.data.geom),
      gran: estimateProdGran(project.data.prod),
    };
  }
  return {
    kind: 'kv',
    title: STEP_TITLES.geom,
    rows: estimateGeom(project.data.geom),
    profile: estimateGeomProfile(project.data.geom),
  };
}
