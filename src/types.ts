export type UserRole = 'Инженер' | 'Администратор + инженер';

export type User = {
  login: string;
  password: string;
  name: string;
  email: string;
  role: UserRole;
};

export type AngleUnit = 'deg' | 'рад';

/** Число зон дробления профиля камеры — одна ступень или две. */
export type ZoneCount = '1' | '2';

/** Подмножество параметров шага «Геометрия камеры дробления». */
export type GeomData = {
  D: string;
  H: string;
  l2: string;
  S0: string;
  theta: string;
  beta10: string;
  beta40: string;
  angleUnit: AngleUnit;
  /** Число зон дробления. `l12` имеет смысл только при `'2'`. */
  zones: ZoneCount;
  /** Угол на выходе конуса, между β10 и β40. */
  beta2: string;
  /** Длина первой зоны дробления брони чаши, мм. */
  l11: string;
  /** Длина второй зоны дробления брони чаши, мм. Используется при `zones === '2'`. */
  l12: string;
  /** Коэффициент R профиля камеры — из методики-источника, без отдельной формулы в этом приложении. */
  R: string;
  /** Коэффициент a профиля камеры — из методики-источника, без отдельной формулы в этом приложении. */
  a: string;
};

/** Подмножество параметров шага «Характеристический грансостав». */
export type GranData = {
  dMin: string;
  dMax: string;
  z0: string;
  s00: string;
  n0: string;
};

export type FeedType = 'dry' | 'wet';

/** Подмножество параметров шага «Грансостав продукта и усилия». */
/** Способ задания параметров формы куска. */
export type ShapeMode = 'direct' | 'sieve';

/** Строка ситовой таблицы: класс крупности вида `-0,5+0,3` и масса в граммах. */
export type SieveRowData = {
  cls: string;
  mass: string;
};

export type ProdData = {
  feedType: FeedType;
  dMin: string;
  dMax: string;
  wk: string;
  wm: string;
  kpd: string;
  /** Среднее относительное длины куска, d̄/dmax. */
  a0: string;
  /** Коэффициент вариации длины, σ/d̄. */
  va0: string;
  shapeMode: ShapeMode;
  /**
   * Ситовая таблица хранится вместе с проектом, а не живёт в состоянии
   * экрана: это введённые данные измерений, и из них выводятся a₀ и Va₀.
   * Потерять их при переходе на соседний шаг — потерять работу.
   */
  sieveRows: SieveRowData[];
};

export type WizardData = {
  geom: GeomData;
  gran: GranData;
  prod: ProdData;
};

export type StepKey = 'geom' | 'gran' | 'prod';

/**
 * Режим взаимодействия с проектом — не раздел приложения, а форма самих
 * шагов визарда. `engineering` — выбор и ввод данных, как и было всегда.
 * `simplified` — только выбор из готовых данных: дробилка(и) и проба(ы)
 * руды выбираются из каталога без ручного ввода, шаг «Продукт» даёт
 * минимум полей. Решается один раз при создании проекта — дальше форма
 * шагов зависит от этого поля, и смена режима постфактум обесценила бы
 * то, что уже введено или выбрано.
 */
export type ProjectMode = 'engineering' | 'simplified';

export type Project = {
  id: string;
  name: string;
  customer: string;
  mode: ProjectMode;
  crusherName: string;
  /** Месторождение пробы руды. Пусто, пока проба не выбрана на шаге «Грансостав». */
  ore: string;
  /**
   * Упрощённый режим: выбранные дробилки и пробы руды — их может быть
   * несколько, отчёт считает каждую комбинацию отдельно. В инженерном
   * режиме не используются: там ровно одна дробилка (`crusherName`) и
   * одна проба (`ore`).
   */
  crusherNames: string[];
  oreNames: string[];
  code: string;
  tag: string | null;
  date: string;
  executor: string;
  oreIn: string;
  oreOut: string;
  throughput: string;
  calc: [boolean, boolean, boolean];
  /**
   * Дата и время последнего расчёта каждого шага — тот же формат, что и
   * `date` (`formatDate()`). Отдельно от `date` проекта: та не меняется
   * после создания и остаётся датой заведения проекта, а расчёт шага
   * может случиться много позже и повторно. `null`, пока шаг ни разу
   * не считался. Показывается в шторке результата.
   */
  calcDates: [string | null, string | null, string | null];
  data: WizardData;
  /**
   * Значения шагов на момент последнего расчёта каждого из них — снимок для
   * режима отображения «Дельта» («было: X» рядом с полем, если его
   * отредактировали после расчёта). `null`, пока соответствующий шаг ни
   * разу не считался.
   */
  geomBaseline: GeomData | null;
  granBaseline: GranData | null;
  prodBaseline: ProdData | null;
};
