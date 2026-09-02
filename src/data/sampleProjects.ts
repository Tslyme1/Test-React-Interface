import type { Project } from '@/types';
import { CRUSHERS } from './crushers';
import { ORE_SAMPLES } from './oreSamples';
import { defaultWizardData } from './wizardDefaults';

/**
 * Примеры проектов для первого запуска — как заполненная история
 * в прототипе. Без них главный экран открывается пустым, и посмотреть
 * на список, фильтры и сортировку не на чем.
 *
 * Значения «руда вход / выход / производительность» не выдуманы: они взяты
 * из характеристик той же машины в каталоге (F95, диапазон разгрузочной щели,
 * производительность). Выдуманные числа рядом с настоящими названиями машин
 * читались бы как данные, которыми не являются.
 *
 * Посев происходит один раз — при первом открытии, когда хранилище пусто.
 * Дальше список принадлежит пользователю: удалённые примеры не возвращаются.
 */

const EXECUTORS = ['Иванов А.С.', 'Петрова О.Н.', 'Сидоров К.В.', 'Кузнецова М.И.', 'Захаров Д.П.'];
const CUSTOMERS = ['ЕВРАЗ КГОК', 'Михайловский ГОК', 'Лебединский ГОК', 'Стойленский ГОК', 'Костомукшский ГОК'];
const TAGS = ['Рабочий', 'Черновик', null, 'Архив', null] as const;

/**
 * Дата в прошлом с шагом в сутки — чтобы сортировка по дате была
 * осмысленной. С минутами, как `nowStamp()` в прототипе.
 */
function pastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function buildSampleProjects(): Project[] {
  return CRUSHERS.slice(0, 18).map((crusher, i) => {
    const ore = ORE_SAMPLES[i % ORE_SAMPLES.length];
    const specs = crusher.values;

    // Расчёт по трём шагам считается выполненным у части примеров —
    // чтобы в списке были видны и посчитанные проекты, и начатые.
    const calcDone = i % 3 !== 2;
    const date = pastDate(i * 2 + 1);

    return {
      id: `sample-${i}`,
      name: `${crusher.name} · ${CUSTOMERS[i % CUSTOMERS.length]}`,
      customer: CUSTOMERS[i % CUSTOMERS.length],
      mode: 'engineering',
      crusherName: crusher.name,
      crusherNames: [crusher.name],
      ore: ore.name,
      oreNames: [ore.name],
      code: `П-${10231 + i * 3}`,
      // Один пример — сразу с двумя метками, чтобы список тегов и в таблице,
      // и в шторке результата был виден не только по одному значению.
      tags: [TAGS[i % TAGS.length], i === 0 ? 'Архив' : null].filter((t): t is string => Boolean(t)),
      date,
      executor: EXECUTORS[i % EXECUTORS.length],
      oreIn: specs['F95, мм'] ? `${specs['F95, мм']} мм (F95)` : '—',
      oreOut: specs['S, мм'] ? `${specs['S, мм']} мм` : '—',
      throughput: specs['Q, т/ч'] ? `${specs['Q, т/ч']} т/ч` : '—',
      calc: calcDone ? [true, true, true] : [true, false, false],
      calcDates: calcDone ? [date, date, date] : [date, null, null],
      data: defaultWizardData(),
      // Шаг «Геометрия» у примеров всегда посчитан (первый элемент `calc`
      // всегда `true`) — снимок делаем от тех же значений, что и в форме,
      // поэтому у свежих примеров дельты быть не должно. «Грансостав»
      // и «Продукт» посчитаны только у части примеров (`calcDone`) — снимок
      // есть только у них, у начатых остаётся `null`, как и до расчёта.
      geomBaseline: defaultWizardData().geom,
      granBaseline: calcDone ? defaultWizardData().gran : null,
      prodBaseline: calcDone ? defaultWizardData().prod : null,
    };
  });
}
