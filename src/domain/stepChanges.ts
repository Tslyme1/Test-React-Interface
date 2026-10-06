import type { GeomData, GranData, ProdData, Project, StepKey } from '@/types';
import { convertAngleUnit } from './angleUnit';
import { STEP_KEYS, STEP_LABELS } from './steps';

/**
 * Что человек изменил в проекте за это посещение — поимённо.
 *
 * Точка отсчёта — состояние проекта на момент открытия вкладки, а не
 * снимок на момент последнего расчёта. Разница принципиальная: по
 * снимку расчёта выходило, что нажатие «Пересчитать» стирает все
 * изменения — снимок после него совпадает с данными, и окно при
 * закрытии не показывало ничего. Между тем поменять данные и тут же
 * пересчитать — это самый обычный заход в посчитанный проект, и
 * откатывать при закрытии надо именно его.
 */
export type FieldChange = {
  label: string;
  /** Значение, с которым шаг считали. */
  was: string;
  /** Значение в форме сейчас. */
  now: string;
};

export type StepChanges = {
  step: StepKey;
  title: string;
  changes: FieldChange[];
};

/**
 * Подписи величин — те же слова, что стоят у полей в формах шагов.
 *
 * Третий список подписей рядом с формой и справкой заводить не хотелось,
 * но взять их из формы нечем: там они написаны прямо в разметке, вперемешку
 * с номерами зон. Поэтому список здесь, и за совпадением с формой следит
 * тест: человек должен узнать в окне ту же строку, которую правил.
 */
const GEOM_LABELS: Partial<Record<keyof GeomData, string>> = {
  b10: 'Угол конуса β10',
  b40: 'Угол чаши β40',
  l2: 'Длина зоны калибровки l₂',
  b2: 'Угол конуса на выходе β2',
  theta: 'Угол нутации θ',
  D: 'Диаметр основания D',
  H: 'Высота H от подвеса',
  S0: 'Ширина разгрузочной щели S0',
  R: 'Коэффициент R',
  a: 'Коэффициент a',
};

const GRAN_LABELS: Partial<Record<keyof GranData, string>> = {
  dMin: 'Минимальная крупность Dmin',
  dk: 'Кондиционная крупность Dk',
  dMax: 'Максимальная крупность Dmax',
  z0: 'Параметр Z0',
  s00: 'Параметр S00',
  n0: 'Параметр N0',
  a0: 'Среднее относительное длины a₀',
  va0: 'Коэффициент вариации Va₀',
};

const PROD_LABELS: Partial<Record<keyof ProdData, string>> = {
  dMin: 'Минимальная крупность продукта',
  dMax: 'Максимальная крупность продукта',
  wk: 'Работа разрушения Wk',
  wm: 'Работа измельчения Wm',
  kpd: 'КПД дробления',
};

/** Подписи величин внутри зоны дробления. Номер зоны подставляется рядом. */
const ZONE_LABELS: Record<keyof GeomData['zones'][number], string> = {
  l1: 'длина',
  b1: 'угол конуса',
  b4: 'угол чаши',
};

const FEED_TYPE: Record<ProdData['feedType'], string> = { dry: 'Сухое', wet: 'Влажное' };
const SHAPE_MODE: Record<GranData['shapeMode'], string> = { direct: 'Прямой ввод', sieve: 'Ситовый анализ' };

/** Пара строк, если они разные. Пустое значение показывается прочерком, а не пустотой. */
function diff(label: string, was: string, now: string): FieldChange | null {
  if (was === now) return null;
  return { label, was: was || '—', now: now || '—' };
}

/**
 * Изменения в геометрии камеры.
 *
 * Снимок сначала приводится к текущим единицам углов: переключение
 * «градусы ↔ радианы» пересчитывает все углы разом (`convertAngleUnit`),
 * и без приведения список выглядел бы так, будто человек вручную правил
 * каждый угол, хотя он только сменил единицы.
 */
function geomChanges(was: GeomData, now: GeomData): FieldChange[] {
  const base = was.angleUnit === now.angleUnit ? was : { ...was, ...convertAngleUnit(was, now.angleUnit) };
  const out: FieldChange[] = [];

  if (was.angleUnit !== now.angleUnit) {
    out.push({ label: 'Единицы углов', was: was.angleUnit === 'рад' ? 'радианы' : 'градусы', now: now.angleUnit === 'рад' ? 'радианы' : 'градусы' });
  }

  for (const key of Object.keys(GEOM_LABELS) as (keyof GeomData)[]) {
    const change = diff(GEOM_LABELS[key] ?? key, String(base[key] ?? ''), String(now[key] ?? ''));
    if (change) out.push(change);
  }

  if (base.zones.length !== now.zones.length) {
    out.push({ label: 'Число зон дробления', was: String(base.zones.length), now: String(now.zones.length) });
  }

  /* Только по общим зонам: у добавленной зоны прежнего значения нет,
     и показывать «было: —» для всей тройки сразу значило бы повторить
     строку «число зон» тремя способами. */
  const common = Math.min(base.zones.length, now.zones.length);
  for (let i = 0; i < common; i += 1) {
    for (const key of Object.keys(ZONE_LABELS) as (keyof GeomData['zones'][number])[]) {
      const change = diff(`Зона ${i + 1} — ${ZONE_LABELS[key]}`, base.zones[i][key], now.zones[i][key]);
      if (change) out.push(change);
    }
  }

  return out;
}

function granChanges(was: GranData, now: GranData): FieldChange[] {
  const out: FieldChange[] = [];

  for (const key of Object.keys(GRAN_LABELS) as (keyof GranData)[]) {
    const change = diff(GRAN_LABELS[key] ?? key, String(was[key] ?? ''), String(now[key] ?? ''));
    if (change) out.push(change);
  }

  const shape = diff('Форма куска', SHAPE_MODE[was.shapeMode], SHAPE_MODE[now.shapeMode]);
  if (shape) out.push(shape);

  /* Ситовая таблица — одной строкой, а не по клетке: классов в ней
     бывает полтора десятка, и список правок клеток занял бы собой
     всё окно, ничего не объяснив. Что из неё вышло, видно рядом —
     в строках a₀ и Va₀ выше. */
  if (JSON.stringify(was.sieveRows) !== JSON.stringify(now.sieveRows)) {
    out.push({
      label: 'Ситовая таблица',
      was: `${was.sieveRows.length} классов`,
      now: `${now.sieveRows.length} классов, значения изменены`,
    });
  }

  return out;
}

function prodChanges(was: ProdData, now: ProdData): FieldChange[] {
  const out: FieldChange[] = [];

  const feed = diff('Тип питания', FEED_TYPE[was.feedType], FEED_TYPE[now.feedType]);
  if (feed) out.push(feed);

  for (const key of Object.keys(PROD_LABELS) as (keyof ProdData)[]) {
    const change = diff(PROD_LABELS[key] ?? key, String(was[key] ?? ''), String(now[key] ?? ''));
    if (change) out.push(change);
  }

  return out;
}

/** Изменения, относящиеся к этапу целиком, а не к отдельной величине. */
function stepMeta(before: Project, after: Project, index: number): FieldChange[] {
  if (before.calc[index] !== after.calc[index]) {
    return [
      {
        label: 'Расчёт этапа',
        was: before.calc[index] ? 'посчитан' : 'не посчитан',
        now: after.calc[index] ? 'посчитан' : 'не посчитан',
      },
    ];
  }

  /*
   * Пересчёт по изменённым данным — тоже изменение: закрытие без
   * сохранения вернёт этап к прежнему расчёту, и сказать об этом надо
   * заранее.
   *
   * Опознаётся по снимку расчёта, а не по его дате: дата отмеряется
   * до минуты, и пересчёт в ту же минуту выглядел бы так, будто расчёта
   * не было. Совпал снимок — значит пересчитали то же самое, и менять
   * действительно нечего.
   */
  if (
    after.calc[index] &&
    JSON.stringify(before.calcSnapshot[index]) !== JSON.stringify(after.calcSnapshot[index])
  ) {
    return [{ label: 'Расчёт этапа', was: 'прежний расчёт', now: 'пересчитан заново' }];
  }

  return [];
}

/**
 * Всё, что изменилось в проекте между двумя его состояниями, по этапам.
 *
 * Дробилка и проба руды идут внутри своих этапов, а не отдельной
 * группой: выбирают их там же, и человек ищет их в окне там, где
 * выбирал. Имя проекта не сравнивается вовсе — его меняют из вкладки
 * осознанным действием, и откатывать его вместе с данными расчёта
 * значило бы отменить то, о чём не спрашивали.
 */
export function collectProjectChanges(before: Project, after: Project): StepChanges[] {
  const out: StepChanges[] = [];

  STEP_KEYS.forEach((step, index) => {
    const changes: FieldChange[] = [...stepMeta(before, after, index)];

    if (step === 'geom') {
      const crusher = diff('Дробилка', before.crusherName, after.crusherName);
      if (crusher) changes.push(crusher);
      changes.push(...geomChanges(before.data.geom, after.data.geom));
    } else if (step === 'gran') {
      const ore = diff('Проба руды', before.ore, after.ore);
      if (ore) changes.push(ore);
      changes.push(...granChanges(before.data.gran, after.data.gran));
    } else {
      changes.push(...prodChanges(before.data.prod, after.data.prod));
    }

    if (changes.length > 0) out.push({ step, title: STEP_LABELS[step], changes });
  });

  return out;
}

/**
 * Поля, которые возвращает «Закрыть без сохранения»: всё, что человек
 * мог тронуть за посещение. Имени проекта среди них нет намеренно —
 * см. `collectProjectChanges`.
 */
export function restoreProjectFields(baseline: Project): Partial<Project> {
  return {
    data: baseline.data,
    crusherName: baseline.crusherName,
    crusherNames: baseline.crusherNames,
    ore: baseline.ore,
    oreNames: baseline.oreNames,
    calc: baseline.calc,
    calcDates: baseline.calcDates,
    calcSnapshot: baseline.calcSnapshot,
  };
}

/** Сколько всего правок насчиталось — для подписи в окне. */
export function countStepChanges(groups: StepChanges[]): number {
  return groups.reduce((sum, group) => sum + group.changes.length, 0);
}
