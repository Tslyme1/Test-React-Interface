import type { GeomData, GranData, ProdData, Project, StepKey } from '@/types';
import { convertAngleUnit } from './angleUnit';
import { isStepStale, STEP_KEYS, STEP_LABELS } from './steps';

/**
 * Что именно разошлось с расчётом — поимённо.
 *
 * Раньше окно при закрытии проекта говорило только «вы меняли данные
 * после расчёта». Человек, вернувшийся к проекту через неделю, из этой
 * фразы не мог понять, что он трогал, и выбирал между «сохранить»
 * и «не сохранять» вслепую — то есть решал судьбу своей же работы,
 * не видя её.
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

/**
 * Изменения, сделанные после расчёта, по всем посчитанным шагам.
 *
 * Шаг без снимка (не считался) сюда не попадает: до расчёта данные —
 * черновик, и «сохранить или откатить» к ним неприменимо. Шаг,
 * посчитанный и не тронутый с тех пор, тоже: менять в нём нечего.
 */
export function collectStepChanges(project: Project): StepChanges[] {
  const out: StepChanges[] = [];

  STEP_KEYS.forEach((step, index) => {
    if (!isStepStale(project, index)) return;
    const snapshot = project.calcSnapshot[index];
    if (!snapshot) return;

    const changes =
      step === 'geom'
        ? geomChanges(snapshot as GeomData, project.data.geom)
        : step === 'gran'
          ? granChanges(snapshot as GranData, project.data.gran)
          : prodChanges(snapshot as ProdData, project.data.prod);

    if (changes.length > 0) out.push({ step, title: STEP_LABELS[step], changes });
  });

  return out;
}

/** Сколько всего правок насчиталось — для подписи в окне. */
export function countStepChanges(groups: StepChanges[]): number {
  return groups.reduce((sum, group) => sum + group.changes.length, 0);
}
