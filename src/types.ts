export type UserRole = 'Инженер' | 'Администратор + инженер';

export type User = {
  login: string;
  password: string;
  name: string;
  email: string;
  role: UserRole;
};

export type AngleUnit = 'deg' | 'рад';

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
export type ProdData = {
  feedType: FeedType;
  dMin: string;
  dMax: string;
  wk: string;
  wm: string;
  kpd: string;
};

export type WizardData = {
  geom: GeomData;
  gran: GranData;
  prod: ProdData;
};

export type StepKey = 'geom' | 'gran' | 'prod';

export type Project = {
  id: string;
  name: string;
  customer: string;
  crusherName: string;
  ore: string;
  code: string;
  tag: string | null;
  date: string;
  executor: string;
  oreIn: string;
  oreOut: string;
  throughput: string;
  calc: [boolean, boolean, boolean];
  data: WizardData;
};
