import { useCallback, useEffect, useState } from 'react';
import type { GeomData, ProdData, Project, ProjectMode, WizardData } from '@/types';
import { defaultWizardData } from '@/data/wizardDefaults';
import { buildSampleProjects } from '@/data/sampleProjects';
import { CRUSHERS } from '@/data/crushers';
import { formatDate } from '@/domain/date';

const STORAGE_KEY = 'uztm-projects';

/**
 * Версия формата хранения. Меняется, когда меняется форма `Project`.
 *
 * Версия 2 добавила параметры формы куска (`a0`, `va0`, `shapeMode`,
 * `sieveRows`), версия 3 — корзину, версия 4 — отметку `seeded`, версия 5 —
 * параметры шага «Геометрия» (`zones`, `beta2`, `l11`, `l12`, `R`, `a`),
 * версия 6 — `geomBaseline`, снимок геометрии на момент расчёта для режима
 * «Дельта». Версия 7 — `mode`, `crusherNames`, `oreNames` для упрощённого
 * режима: старые записи получают `mode: 'engineering'` и списки из одного
 * элемента (той же дробилки/пробы, что уже стояли в `crusherName`/`ore`).
 * Версия 8 — `granBaseline`, `prodBaseline`: тот же снимок для «Дельта», что
 * `geomBaseline`, но для шагов «Грансостав» и «Продукт» — раньше режим
 * существовал только на «Геометрии».
 * Версия 9 — `calcDates`: дата и время расчёта каждого шага отдельно от
 * даты заведения проекта (`date`), для метаданных в шторке результата.
 * Версия 10 — `tag: string | null` заменён на `tags: string[]`: у проекта
 * теперь может быть несколько меток. Старое значение переносится как список
 * из одного элемента (или пустой, если тега не было).
 * Данные прежних версий не выбрасываются, а дополняются значениями по
 * умолчанию: проекты — это работа пользователя, и терять её из-за того,
 * что мы дописали поле, нельзя.
 */
const SCHEMA_VERSION = 10;

type StoredPayload = { version: number; projects: Project[]; trash: Project[]; seeded?: boolean };

type StoredState = { projects: Project[]; trash: Project[]; seeded: boolean };

/**
 * Проекты хранятся общим списком, а не по пользователю — как локальная
 * история в исходном прототипе. Настоящей многопользовательской работы
 * здесь нет: вход демонстрационный.
 *
 * Примеры подсыпаются один раз — при первом запуске, когда список пуст
 * и отметки `seeded` в хранилище ещё нет. Отметка, а не факт отсутствия
 * ключа: браузер, уже видевший приложение с пустым списком (например,
 * версию без примеров), без неё решил бы, что список очищен осознанно,
 * и не получил бы примеры никогда. Once we've seeded — не подсыпаем снова:
 * список, очищенный руками, должен остаться пустым.
 */
function readState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { projects: buildSampleProjects(), trash: [], seeded: true };

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return seedIfNeeded({ projects: [], trash: [], seeded: false });

    const payload = parsed as Partial<StoredPayload>;
    if (!Array.isArray(payload.projects)) return seedIfNeeded({ projects: [], trash: [], seeded: false });

    const trash = Array.isArray(payload.trash) ? payload.trash : [];
    const seeded = payload.seeded === true;

    if (payload.version === SCHEMA_VERSION) return seedIfNeeded({ projects: payload.projects, trash, seeded });
    if (payload.version === 9) {
      return seedIfNeeded({ projects: payload.projects.map(migrateTagsV10), trash, seeded });
    }
    if (payload.version === 8) {
      return seedIfNeeded({ projects: payload.projects.map(migrateCalcDatesV9).map(migrateTagsV10), trash, seeded });
    }
    if (payload.version === 7) {
      return seedIfNeeded({
        projects: payload.projects.map(migrateBaselineV8).map(migrateCalcDatesV9).map(migrateTagsV10),
        trash,
        seeded,
      });
    }
    if (payload.version === 6) {
      return seedIfNeeded({
        projects: payload.projects.map(migrateModeV7).map(migrateBaselineV8).map(migrateCalcDatesV9).map(migrateTagsV10),
        trash,
        seeded,
      });
    }
    if (payload.version === 5) {
      return seedIfNeeded({
        projects: payload.projects
          .map(migrateBaselineV6)
          .map(migrateModeV7)
          .map(migrateBaselineV8)
          .map(migrateCalcDatesV9)
          .map(migrateTagsV10),
        trash,
        seeded,
      });
    }
    if (payload.version === 4) {
      return seedIfNeeded({
        projects: payload.projects
          .map(migrateGeomV5)
          .map(migrateBaselineV6)
          .map(migrateModeV7)
          .map(migrateBaselineV8)
          .map(migrateCalcDatesV9)
          .map(migrateTagsV10),
        trash,
        seeded,
      });
    }
    if (payload.version === 3) {
      return seedIfNeeded({
        projects: payload.projects
          .map(migrateGeomV5)
          .map(migrateBaselineV6)
          .map(migrateModeV7)
          .map(migrateBaselineV8)
          .map(migrateCalcDatesV9)
          .map(migrateTagsV10),
        trash,
        seeded,
      });
    }
    if (payload.version === 2) {
      return seedIfNeeded({
        projects: payload.projects
          .map(migrateGeomV5)
          .map(migrateBaselineV6)
          .map(migrateModeV7)
          .map(migrateBaselineV8)
          .map(migrateCalcDatesV9)
          .map(migrateTagsV10),
        trash,
        seeded: false,
      });
    }
    if (payload.version === 1) {
      return seedIfNeeded({
        projects: payload.projects
          .map(migrateFromV1)
          .map(migrateGeomV5)
          .map(migrateBaselineV6)
          .map(migrateModeV7)
          .map(migrateBaselineV8)
          .map(migrateCalcDatesV9)
          .map(migrateTagsV10),
        trash,
        seeded: false,
      });
    }

    // Версия из будущего или мусор — читать нечего.
    return { projects: [], trash: [], seeded: true };
  } catch {
    // Битое или недоступное хранилище не должно мешать открыть приложение.
    return { projects: [], trash: [], seeded: true };
  }
}

function seedIfNeeded(state: StoredState): StoredState {
  if (state.seeded || state.projects.length > 0 || state.trash.length > 0) return state;
  return { ...state, projects: buildSampleProjects(), seeded: true };
}

/**
 * Проект версии 1 не знал параметров формы куска. Дополняем их значениями
 * по умолчанию — остальные поля не трогаем.
 */
function migrateFromV1(project: Project): Project {
  const fallback: ProdData = defaultWizardData().prod;

  // Порядок важен: сначала значения по умолчанию, поверх — то, что реально
  // лежит в хранилище. Обратный порядок затирал бы дефолты полями, которых
  // в старой записи нет, и они приезжали бы как undefined.
  const stored = project.data.prod as Partial<ProdData>;

  return {
    ...project,
    data: { ...project.data, prod: { ...fallback, ...stored } },
  };
}

/**
 * До версии 5 у шага «Геометрия» не было `zones`, `beta2`, `l11`, `l12`,
 * `R`, `a` — их добавила синхронизация вёрстки шага с формой источника.
 * Тот же порядок слияния, что и у `migrateFromV1`: дефолты сначала,
 * реальные сохранённые значения — поверх.
 */
function migrateGeomV5(project: Project): Project {
  const fallback = defaultWizardData().geom;
  const stored = project.data.geom as Partial<GeomData>;

  return {
    ...project,
    data: { ...project.data, geom: { ...fallback, ...stored } },
  };
}

/** До версии 6 у проекта не было `geomBaseline` — записи без него не считались. */
function migrateBaselineV6(project: Project): Project {
  return { ...project, geomBaseline: project.geomBaseline ?? null };
}

/**
 * До версии 8 у проекта не было `granBaseline`/`prodBaseline` — режим
 * «Дельта» существовал только на шаге «Геометрия». Как и `geomBaseline`
 * ниже, `null` значит «шаг ни разу не считался с тех пор», а не «дельты
 * не будет никогда»: следующий расчёт этого шага заведёт снимок сам.
 */
function migrateBaselineV8(project: Project): Project {
  const legacy = project as Partial<Pick<Project, 'granBaseline' | 'prodBaseline'>> & Project;
  return {
    ...project,
    granBaseline: legacy.granBaseline ?? null,
    prodBaseline: legacy.prodBaseline ?? null,
  };
}

/**
 * До версии 9 у проекта не было `calcDates`. Шаг, уже отмеченный посчитанным
 * (`calc[i]`), получает дату самого проекта — точнее взять неоткуда, а
 * оставить пустой рядом с «Рассчитано» в шторке выглядело бы как баг, а не
 * как «неизвестно когда». Непосчитанный шаг остаётся `null`, как и раньше.
 */
function migrateCalcDatesV9(project: Project): Project {
  const legacy = project as Partial<Pick<Project, 'calcDates'>> & Project;
  if (legacy.calcDates) return project;
  return {
    ...project,
    calcDates: project.calc.map((done) => (done ? project.date : null)) as Project['calcDates'],
  };
}

/**
 * До версии 10 у проекта был один `tag: string | null`, теперь —
 * `tags: string[]`. Старое значение переносится как список из одного
 * элемента, а `null` — как пустой список: у проекта не было ни одной
 * метки, и после миграции их по-прежнему ни одной.
 */
function migrateTagsV10(project: Project): Project {
  const legacy = project as Partial<Pick<Project, 'tags'>> & Project & { tag?: string | null };
  if (legacy.tags) return project;
  const { tag, ...rest } = legacy;
  return { ...rest, tags: tag ? [tag] : [] };
}

/**
 * До версии 7 у проекта не было `mode`/`crusherNames`/`oreNames` — все
 * записи были инженерными с одной дробилкой и одной пробой, поэтому
 * получают `mode: 'engineering'` и списки из того, что уже стояло
 * в `crusherName`/`ore`.
 */
function migrateModeV7(project: Project): Project {
  const legacy = project as Partial<Pick<Project, 'mode' | 'crusherNames' | 'oreNames'>> & Project;
  return {
    ...project,
    mode: legacy.mode ?? 'engineering',
    crusherNames: legacy.crusherNames ?? (project.crusherName ? [project.crusherName] : []),
    oreNames: legacy.oreNames ?? (project.ore ? [project.ore] : []),
  };
}

function writeState(state: StoredState): void {
  try {
    // Любая запись означает, что список больше не «нетронутый»: подсыпать
    // примеры позже уже нельзя, даже если пользователь удалит всё вручную.
    const payload: StoredPayload = { version: SCHEMA_VERSION, ...state, seeded: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Переполненное хранилище или приватный режим — потеря сохранения,
    // но не потеря работающего приложения.
  }
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Пробы руды здесь нет: при создании она неизвестна и выбирается на шаге
 * «Грансостав» (инженерный режим) или «Руда» (упрощённый). До тех пор `ore`
 * у проекта пустая — так же, как в прототипе.
 */
export type NewProjectInput = {
  name: string;
  customer: string;
  executor: string;
  mode: ProjectMode;
  /** Инженерный режим — ровно одна дробилка. */
  crusherName?: string;
  /** Упрощённый режим — одна или несколько, отчёт считает каждую. */
  crusherNames?: string[];
  data: WizardData;
};

/** Хранилище проектов. Переживает перезагрузку страницы, бэкенда нет. */
export function useProjects() {
  const [state, setState] = useState<StoredState>(readState);

  // Пишем на каждое изменение: точек изменения несколько (создание, правка
  // данных визарда, удаление, восстановление), и сохранять в каждой из них —
  // значит однажды забыть в одной.
  useEffect(() => {
    writeState(state);
  }, [state]);

  const createProject = useCallback((input: NewProjectInput): Project => {
    // Упрощённый режим допускает несколько дробилок сразу — характеристики
    // в колонках списка проектов при этом берутся у первой выбранной:
    // показать там же сразу все комбинации было бы некуда, а отчёт по
    // каждой всё равно строится отдельно на шаге «Продукт».
    const names = input.mode === 'simplified' ? (input.crusherNames ?? []) : input.crusherName ? [input.crusherName] : [];
    const primaryName = names[0] ?? '';
    // Характеристики берутся из каталога выбранной машины: они известны
    // сразу после выбора, и оставлять три колонки прочерками до расчёта
    // значит показывать полупустую строку там, где данные уже есть.
    const specs = CRUSHERS.find((c) => c.name === primaryName)?.values;

    const project: Project = {
      id: makeId(),
      name: input.name,
      customer: input.customer,
      mode: input.mode,
      crusherName: primaryName,
      crusherNames: names,
      ore: '',
      oreNames: [],
      code: `П-${Math.floor(10000 + Math.random() * 89999)}`,
      tags: [],
      date: formatDate(),
      executor: input.executor,
      oreIn: specs?.['F95, мм'] ? `${specs['F95, мм']} мм (F95)` : '—',
      oreOut: specs?.['S, мм'] ? `${specs['S, мм']} мм` : '—',
      throughput: specs?.['Q, т/ч'] ? `${specs['Q, т/ч']} т/ч` : '—',
      calc: [false, false, false],
      calcDates: [null, null, null],
      data: input.data,
      geomBaseline: null,
      granBaseline: null,
      prodBaseline: null,
    };
    setState((prev) => ({ ...prev, projects: [project, ...prev.projects] }));
    return project;
  }, []);

  /**
   * Копия проекта с правкой поверх посчитанного шага.
   *
   * Посчитанный шаг не переписывается на месте — правка данных создаёт
   * новый проект с применённым изменением, а исходный остаётся таким, каким
   * был на момент расчёта. Так и в исходном прототипе: расчёт — это снимок,
   * а не черновик, который можно тихо переписать задним числом.
   */
  const forkProject = useCallback(
    (id: string, patch: Partial<Project>): Project | null => {
      const source = state.projects.find((p) => p.id === id);
      if (!source) return null;

      const forked: Project = {
        ...source,
        ...patch,
        id: makeId(),
        code: `П-${Math.floor(10000 + Math.random() * 89999)}`,
        date: formatDate(),
      };
      setState((prev) => ({ ...prev, projects: [forked, ...prev.projects] }));
      return forked;
    },
    [state.projects]
  );

  const updateProject = useCallback((id: string, patch: Partial<Project>) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }, []);

  /** Удаление мягкое: проект уходит в корзину, откуда его можно вернуть. */
  const removeProject = useCallback((id: string) => {
    setState((prev) => {
      const victim = prev.projects.find((p) => p.id === id);
      if (!victim) return prev;
      return {
        ...prev,
        projects: prev.projects.filter((p) => p.id !== id),
        trash: [victim, ...prev.trash],
      };
    });
  }, []);

  const restoreProject = useCallback((id: string) => {
    setState((prev) => {
      const victim = prev.trash.find((p) => p.id === id);
      if (!victim) return prev;
      return {
        ...prev,
        projects: [victim, ...prev.projects],
        trash: prev.trash.filter((p) => p.id !== id),
      };
    });
  }, []);

  /** Безвозвратно. Единственное место, где проект действительно исчезает. */
  const purgeProject = useCallback((id: string) => {
    setState((prev) => ({ ...prev, trash: prev.trash.filter((p) => p.id !== id) }));
  }, []);

  const emptyTrash = useCallback(() => {
    setState((prev) => ({ ...prev, trash: [] }));
  }, []);

  return {
    projects: state.projects,
    trash: state.trash,
    createProject,
    updateProject,
    forkProject,
    removeProject,
    restoreProject,
    purgeProject,
    emptyTrash,
  };
}
