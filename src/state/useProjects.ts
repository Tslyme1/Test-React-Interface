import { useCallback, useEffect, useState } from 'react';
import type { GeomData, GranData, ProdData, Project, ProjectMode, SieveRowData, WizardData, ZoneData } from '@/types';
import { defaultWizardData } from '@/data/wizardDefaults';
import { buildSampleProjects } from '@/data/sampleProjects';
import { catalogOf } from '@/state/userCatalog';
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
 * Версия 11 — `geomBaseline`/`granBaseline`/`prodBaseline` (снимок на момент
 * расчёта) заменены на один `initialData` — снимок на момент создания
 * проекта. Старый снимок обнулялся до первого расчёта, и режим «Дельта»
 * на свежем проекте не показывал вообще ничего — сравнивать было не с чем.
 * `initialData` есть с самого начала. У старых записей истинных исходных
 * значений уже не восстановить — переносится текущий `data` (для них
 * дельта покажет разницу только по правкам после миграции).
 * Версия 12 — шаг «Геометрия» получил всю цепочку профиля (24 узла вместо
 * тринадцати упрощённых полей): недостающие узлы раньше подставлял адаптер
 * схемы, и половине чертежа не отвечало ни одно поле. Старые значения
 * ложатся на свои узлы, остальные берут ровно те умолчания, которыми их
 * и рисовали, — профиль сохранённого проекта после миграции не меняется.
 * Версия 13 — у «Грансостава» появилось поле `dk` (кондиционная крупность
 * питания), пропущенное при переносе формы: старым записям подставляется
 * значение `dMin`.
 * Версия 14 — у проекта появился `calcSnapshot`: слепок данных каждого шага
 * на момент его последнего расчёта, отдельно от `initialData` (та хранит
 * момент создания проекта и не обновляется при пересчёте). По нему видно,
 * разошлись ли текущие значения с тем, что легло в уже посчитанный
 * результат, — без этого поля закрытие проекта с такими правками проходило
 * молча. Старым записям снимок не восстановить — подставляется `null` по
 * всем трём шагам; `calc` при этом не трогается, а `null` считается
 * «снимка нет», а не «разошлось со всем подряд» — иначе сама миграция
 * включила бы предупреждение о несохранённых правках на каждом уже
 * посчитанном проекте. Настоящий снимок появится у шага при ближайшем
 * расчёте.
 * Версия 15 — «Параметры формы куска» (`a0`, `va0`, `shapeMode`,
 * `sieveRows`) переехали с шага «Продукт» на «Грансостав»: они описывают
 * кусок питания, а не продукта дробления. Заодно ситовая таблица потеряла
 * столбец «масса класса» — вместо него вводится одна из трёх процентных
 * величин (`sieveMode`), а масса, если она уже была введена, при переносе
 * пересчитывается в частный класс (тот же смысл, что и была). Пустая
 * таблица получает набор классов крупности по умолчанию, а не остаётся
 * пустой. `calcSnapshot` при этом сбрасывается на `null` по всем шагам —
 * старый снимок был снят с прежней формы `GranData`/`ProdData` и сравнение
 * с ним после переноса полей означало бы неправду.
 * Данные прежних версий не выбрасываются, а дополняются значениями по
 * умолчанию: проекты — это работа пользователя, и терять её из-за того,
 * что мы дописали поле, нельзя.
 */
const SCHEMA_VERSION = 19;

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
    if (payload.version === 18) {
      return seedIfNeeded({ projects: payload.projects.map(migrateZoneListV19), trash, seeded });
    }
    if (payload.version === 17) {
      return seedIfNeeded({ projects: payload.projects.map(migrateTwoZonesV18).map(migrateZoneListV19), trash, seeded });
    }
    if (payload.version === 16) {
      return seedIfNeeded({ projects: payload.projects.map(migrateZonesBackV17).map(migrateTwoZonesV18).map(migrateZoneListV19), trash, seeded });
    }
    if (payload.version === 15) {
      return seedIfNeeded({ projects: payload.projects.map(migrateGeomProfileV16).map(migrateZonesBackV17).map(migrateTwoZonesV18).map(migrateZoneListV19), trash, seeded });
    }
    if (payload.version === 14) {
      return seedIfNeeded({ projects: payload.projects.map(migrateShapeToGranV15).map(migrateGeomProfileV16).map(migrateZonesBackV17).map(migrateTwoZonesV18).map(migrateZoneListV19), trash, seeded });
    }
    if (payload.version === 13) {
      return seedIfNeeded({ projects: payload.projects.map(migrateCalcSnapshotV14).map(migrateShapeToGranV15).map(migrateGeomProfileV16).map(migrateZonesBackV17).map(migrateTwoZonesV18).map(migrateZoneListV19), trash, seeded });
    }
    if (payload.version === 12) {
      return seedIfNeeded({ projects: payload.projects.map(migrateDkV13).map(migrateCalcSnapshotV14).map(migrateShapeToGranV15).map(migrateGeomProfileV16).map(migrateZonesBackV17).map(migrateTwoZonesV18).map(migrateZoneListV19), trash, seeded });
    }
    if (payload.version === 11) {
      return seedIfNeeded({ projects: payload.projects.map(migrateGeomChainV12).map(migrateDkV13).map(migrateCalcSnapshotV14).map(migrateShapeToGranV15).map(migrateGeomProfileV16).map(migrateZonesBackV17).map(migrateTwoZonesV18).map(migrateZoneListV19), trash, seeded });
    }
    if (payload.version === 10) {
      return seedIfNeeded({
        projects: payload.projects.map(migrateInitialDataV11).map(migrateGeomChainV12).map(migrateDkV13).map(migrateCalcSnapshotV14).map(migrateShapeToGranV15).map(migrateGeomProfileV16).map(migrateZonesBackV17).map(migrateTwoZonesV18).map(migrateZoneListV19),
        trash,
        seeded,
      });
    }
    if (payload.version === 9) {
      return seedIfNeeded({
        projects: payload.projects.map(migrateTagsV10).map(migrateInitialDataV11).map(migrateGeomChainV12).map(migrateDkV13).map(migrateCalcSnapshotV14).map(migrateShapeToGranV15).map(migrateGeomProfileV16).map(migrateZonesBackV17).map(migrateTwoZonesV18).map(migrateZoneListV19),
        trash,
        seeded,
      });
    }
    if (payload.version === 8) {
      return seedIfNeeded({
        projects: payload.projects
          .map(migrateCalcDatesV9)
          .map(migrateTagsV10)
          .map(migrateInitialDataV11)
          .map(migrateGeomChainV12)
          .map(migrateDkV13).map(migrateCalcSnapshotV14).map(migrateShapeToGranV15).map(migrateGeomProfileV16).map(migrateZonesBackV17).map(migrateTwoZonesV18).map(migrateZoneListV19),
        trash,
        seeded,
      });
    }
    if (payload.version === 7) {
      return seedIfNeeded({
        projects: payload.projects
          .map(migrateCalcDatesV9)
          .map(migrateTagsV10)
          .map(migrateInitialDataV11)
          .map(migrateGeomChainV12)
          .map(migrateDkV13).map(migrateCalcSnapshotV14).map(migrateShapeToGranV15).map(migrateGeomProfileV16).map(migrateZonesBackV17).map(migrateTwoZonesV18).map(migrateZoneListV19),
        trash,
        seeded,
      });
    }
    if (payload.version === 6) {
      return seedIfNeeded({
        projects: payload.projects
          .map(migrateModeV7)
          .map(migrateCalcDatesV9)
          .map(migrateTagsV10)
          .map(migrateInitialDataV11)
          .map(migrateGeomChainV12)
          .map(migrateDkV13).map(migrateCalcSnapshotV14).map(migrateShapeToGranV15).map(migrateGeomProfileV16).map(migrateZonesBackV17).map(migrateTwoZonesV18).map(migrateZoneListV19),
        trash,
        seeded,
      });
    }
    if (payload.version === 5) {
      return seedIfNeeded({
        projects: payload.projects
          .map(migrateModeV7)
          .map(migrateCalcDatesV9)
          .map(migrateTagsV10)
          .map(migrateInitialDataV11)
          .map(migrateGeomChainV12)
          .map(migrateDkV13).map(migrateCalcSnapshotV14).map(migrateShapeToGranV15).map(migrateGeomProfileV16).map(migrateZonesBackV17).map(migrateTwoZonesV18).map(migrateZoneListV19),
        trash,
        seeded,
      });
    }
    if (payload.version === 4) {
      return seedIfNeeded({
        projects: payload.projects
          .map(migrateGeomV5)
          .map(migrateModeV7)
          .map(migrateCalcDatesV9)
          .map(migrateTagsV10)
          .map(migrateInitialDataV11)
          .map(migrateGeomChainV12)
          .map(migrateDkV13).map(migrateCalcSnapshotV14).map(migrateShapeToGranV15).map(migrateGeomProfileV16).map(migrateZonesBackV17).map(migrateTwoZonesV18).map(migrateZoneListV19),
        trash,
        seeded,
      });
    }
    if (payload.version === 3) {
      return seedIfNeeded({
        projects: payload.projects
          .map(migrateGeomV5)
          .map(migrateModeV7)
          .map(migrateCalcDatesV9)
          .map(migrateTagsV10)
          .map(migrateInitialDataV11)
          .map(migrateGeomChainV12)
          .map(migrateDkV13).map(migrateCalcSnapshotV14).map(migrateShapeToGranV15).map(migrateGeomProfileV16).map(migrateZonesBackV17).map(migrateTwoZonesV18).map(migrateZoneListV19),
        trash,
        seeded,
      });
    }
    if (payload.version === 2) {
      return seedIfNeeded({
        projects: payload.projects
          .map(migrateGeomV5)
          .map(migrateModeV7)
          .map(migrateCalcDatesV9)
          .map(migrateTagsV10)
          .map(migrateInitialDataV11)
          .map(migrateGeomChainV12)
          .map(migrateDkV13).map(migrateCalcSnapshotV14).map(migrateShapeToGranV15).map(migrateGeomProfileV16).map(migrateZonesBackV17).map(migrateTwoZonesV18).map(migrateZoneListV19),
        trash,
        seeded: false,
      });
    }
    if (payload.version === 1) {
      return seedIfNeeded({
        projects: payload.projects
          .map(migrateFromV1)
          .map(migrateGeomV5)
          .map(migrateModeV7)
          .map(migrateCalcDatesV9)
          .map(migrateTagsV10)
          .map(migrateInitialDataV11)
          .map(migrateGeomChainV12)
          .map(migrateDkV13).map(migrateCalcSnapshotV14).map(migrateShapeToGranV15).map(migrateGeomProfileV16).map(migrateZonesBackV17).map(migrateTwoZonesV18).map(migrateZoneListV19),
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
 * До версии 11 у проекта был снимок на момент расчёта каждого шага
 * (`geomBaseline`/`granBaseline`/`prodBaseline`), а не на момент создания.
 * Истинные исходные значения для уже существующих записей неизвестны —
 * переносится текущий `data`: для них «Дельта» покажет разницу только
 * по правкам, сделанным после этой миграции, что честнее, чем выдумывать
 * значения, которых мы не сохраняли.
 */
function migrateInitialDataV11(project: Project): Project {
  const legacy = project as Partial<Pick<Project, 'initialData'>> &
    Project & { geomBaseline?: unknown; granBaseline?: unknown; prodBaseline?: unknown };
  if (legacy.initialData) return project;
  const { geomBaseline, granBaseline, prodBaseline, ...rest } = legacy;
  return { ...rest, initialData: project.data };
}

/**
 * До версии 12 шаг «Геометрия» нёс тринадцать упрощённых полей, а
 * недостающие узлы цепочки профиля подставлял адаптер схемы своими
 * умолчаниями. Теперь цепочка целиком лежит в форме.
 *
 * Перенос сохраняет ровно то, что пользователь видел на схеме до
 * миграции: старые поля ложатся на свои узлы (`beta40` → `b40`,
 * `beta10` → `b10`, `beta2` → `b2`, длины — как были), а узлы, которых
 * в форме не было, получают те самые умолчания, которыми их и рисовали.
 * Ни одно сохранённое число не подменяется «правильным» из прототипа:
 * профиль чужого проекта не должен меняться сам по себе.
 */
function migrateGeomChainV12(project: Project): Project {
  type LegacyGeom = {
    beta10?: string;
    beta40?: string;
    beta2?: string;
    l11?: string;
    l12?: string;
    l2?: string;
    zones?: string;
  };

  const defaults = defaultWizardData().geom;

  const convert = (data: WizardData): WizardData => {
    const geom = data.geom as unknown as FlatGeom & LegacyGeom;
    // Уже новая форма — цепочка на месте, трогать нечего.
    if (typeof geom.b40 === 'string' && typeof geom.b41 === 'string') return data;

    return {
      ...data,
      geom: {
        ...flatDefaults(defaults),
        // Что было в форме — переносится как есть.
        b40: geom.beta40 ?? defaults.b40,
        b10: geom.beta10 ?? defaults.b10,
        b2: geom.beta2 ?? defaults.b2,
        l11: geom.l11 ?? defaults.zones[0].l1,
        /* `l12` в старой форме участвовал в построении только при двух
           зонах — при одной адаптер брал умолчание, и на схеме стояло оно. */
        l12: geom.zones === '2' && geom.l12 ? geom.l12 : defaults.zones[1].l1,
        l2: geom.l2 ?? defaults.l2,
        // Габариты, единицы углов и коэффициенты живут своей жизнью.
        D: geom.D ?? defaults.D,
        H: geom.H ?? defaults.H,
        S0: geom.S0 ?? defaults.S0,
        theta: geom.theta ?? defaults.theta,
        angleUnit: geom.angleUnit ?? defaults.angleUnit,
        R: geom.R ?? defaults.R,
        a: geom.a ?? defaults.a,
      } as unknown as GeomData,
    };
  };

  return { ...project, data: convert(project.data), initialData: convert(project.initialData) };
}

/**
 * До версии 13 у шага «Грансостав» не было поля `dk` — оно есть в исходных
 * данных примера расчёта («DMIN=15, DK=15, DMAX=70») наравне с `dMin`/`dMax`,
 * но было пропущено при переносе. Старым записям подставляется значение
 * `dMin` — тот же самый частный случай, что и в примере расчёта.
 */
function migrateDkV13(project: Project): Project {
  const convert = (data: WizardData): WizardData => {
    const gran = data.gran as GranData & { dk?: string };
    if (typeof gran.dk === 'string') return data;
    return { ...data, gran: { ...gran, dk: gran.dMin } };
  };

  return { ...project, data: convert(project.data), initialData: convert(project.initialData) };
}

/** Снимка на момент расчёта у старых записей нет — `null` по всем трём шагам, см. версию 14 выше. */
function migrateCalcSnapshotV14(project: Project): Project {
  const withSnapshot = project as Project & { calcSnapshot?: unknown };
  if (Array.isArray(withSnapshot.calcSnapshot)) return project;
  return { ...project, calcSnapshot: [null, null, null] };
}

/** Классы крупности по умолчанию для ситовой таблицы — та же заготовка, что и у нового проекта. */
const DEFAULT_SIEVE_ROWS: SieveRowData[] = [
  { cls: '-300+150', value: '' },
  { cls: '-150+75', value: '' },
  { cls: '-75+35', value: '' },
  { cls: '-35+15', value: '' },
  { cls: '-15+5', value: '' },
  { cls: '-5+0', value: '' },
];

/** Перенос «Параметров формы куска» с «Продукта» на «Грансостав», см. версию 15 выше. */
function migrateShapeToGranV15(project: Project): Project {
  const convert = (data: WizardData): WizardData => {
    const gran = data.gran as GranData & { a0?: string };
    if (typeof gran.a0 === 'string') return data; // уже перенесено

    const prod = data.prod as ProdData & {
      a0?: string;
      va0?: string;
      shapeMode?: 'direct' | 'sieve';
      sieveRows?: Array<{ cls: string; mass?: string; value?: string }>;
    };

    const legacyRows = Array.isArray(prod.sieveRows) ? prod.sieveRows : [];
    const masses = legacyRows.map((r) => Number(String(r.mass ?? r.value ?? '').replace(',', '.')) || 0);
    const total = masses.reduce((a, b) => a + b, 0);
    // Старая таблица хранила массу класса — пересчитываем в частный
    // класс (тот же смысл, что и раньше был у массы: доля класса от
    // целого), чтобы измеренные данные не пропали при переносе поля.
    const sieveRows: SieveRowData[] = legacyRows.length
      ? legacyRows.map((r, i) => ({ cls: r.cls ?? '', value: total ? String(Math.round((masses[i] / total) * 1000) / 10) : '' }))
      : DEFAULT_SIEVE_ROWS;

    const { a0, va0, shapeMode, sieveRows: _oldRows, ...prodRest } = prod;
    return {
      ...data,
      gran: { ...gran, a0: a0 ?? '', va0: va0 ?? '', shapeMode: shapeMode ?? 'direct', sieveMode: 'classes', sieveRows },
      prod: prodRest as ProdData,
    };
  };

  return { ...project, data: convert(project.data), initialData: convert(project.initialData), calcSnapshot: [null, null, null] };
}

/**
 * v16 — профиль камеры считается по методике этапа 1, а не строится двумя
 * независимыми контурами с последующей подгонкой под габариты.
 *
 * Из формы ушли восемь величин, которые методика **выводит**, а не
 * принимает: якорные лучи `a40`/`r40`/`a10`/`r10`, длины конуса
 * `L10`…`L1i` (дубль массива l₁(i)) и терминальный угол `b3` — он равен
 * β₂ − θ. Всё, что осталось полем, — угол или длина, которую пользователь
 * действительно вводил, и она переносится как есть.
 *
 * `zones` **остаётся**: число зон дробления — исходное данное методики
 * (третья строка файла геометрии), задающее длину массивов l₁(i), β₁(i),
 * β₄(i). Старые записи знали только «1» и «2»; третья зона появилась
 * вместе с переходом на методику, и значение из хранилища переносится
 * как есть.
 *
 * `calcSnapshot` сбрасывается: снимок снят с прежней формы `GeomData`,
 * и сравнение с ним показывало бы расхождение там, где пользователь
 * ничего не менял.
 */
function migrateGeomProfileV16(project: Project): Project {
  type LegacyGeom = {
    a40?: string;
    r40?: string;
    a10?: string;
    r10?: string;
    b3?: string;
    L10?: string;
    L11?: string;
    L12?: string;
    L1i?: string;
  };

  const defaults = defaultWizardData().geom;

  const convert = (data: WizardData): WizardData => {
    const geom = data.geom as unknown as FlatGeom & LegacyGeom;
    if (geom.a40 === undefined && geom.L10 === undefined && geom.b3 === undefined) return data;

    const {
      a40: _a40,
      r40: _r40,
      a10: _a10,
      r10: _r10,
      b3: _b3,
      L10: _L10,
      L11: _L11,
      L12: _L12,
      L1i: _L1i,
      ...kept
    } = geom;

    /* Число зон переносится, а не берётся из умолчаний: это выбор
       пользователя, и от него зависит, сколько зон уйдёт в расчёт.
       Тройка здесь ещё возможна — ввод ограничили одной-двумя зонами
       позже, и приводит её к потолку следующая миграция (v18). */
    const stored = (kept as { zones?: string }).zones;
    const zones = stored === '2' || stored === '3' ? stored : '1';
    return { ...data, geom: { ...flatDefaults(defaults), ...kept, zones } as unknown as GeomData };
  };

  return {
    ...project,
    data: convert(project.data),
    initialData: convert(project.initialData),
    calcSnapshot: [null, null, null],
  };
}

/**
 * v17 — число зон дробления возвращается в форму.
 *
 * В v16 оно было ошибочно снято как «выводимое»: на деле это исходное
 * данное методики, третья строка файла геометрии («Число зон дробления»),
 * и именно оно задаёт длину массивов l₁(i), β₁(i), β₄(i). Записи, успевшие
 * переехать на v16 без него, получают значение по умолчанию — три зоны,
 * как в контрольном примере методики и как рисовал чертёж всё это время.
 */
function migrateZonesBackV17(project: Project): Project {
  const convert = (data: WizardData): WizardData => {
    const geom = data.geom as unknown as FlatGeom;
    if (geom.zones !== undefined) return data;
    return { ...data, geom: { ...geom, zones: '2' } as unknown as GeomData };
  };

  return { ...project, data: convert(project.data), initialData: convert(project.initialData) };
}

/**
 * v18 — зон дробления одна или две, третьей больше нет.
 *
 * Ограничение идёт от исходных данных заказчика, где вторая тройка углов
 * подписана «β11 β12 (задается если 2 зоны дробления)»: больше двух зон
 * форма не спрашивает. Вместе с третьей зоной из `GeomData` уходят её
 * поля `l1i`, `b1i`, `b4i` — они не показывались бы нигде и остались бы
 * мёртвым грузом в хранилище.
 *
 * Записи, где стояла тройка, переводятся на две зоны: профиль там
 * укорачивается на последнюю зону дробления, поэтому `calcSnapshot`
 * сбрасывается — снимок снят с профиля, которого больше не будет,
 * и сравнение с ним показывало бы расхождение там, где пользователь
 * ничего не менял. Сам `calc` не трогается: посчитанный результат
 * остаётся посчитанным, пока его не пересчитают.
 *
 * Расчёт при этом числом зон по-прежнему не ограничен
 * (`computeChamberProfile`): предел стоит на вводе, а не в методике.
 */
function migrateTwoZonesV18(project: Project): Project {
  const convert = (data: WizardData): WizardData => {
    const geom = data.geom as unknown as FlatGeom & { l1i?: string; b1i?: string; b4i?: string };
    const { l1i: _l1i, b1i: _b1i, b4i: _b4i, ...kept } = geom;
    const zones = kept.zones === '1' ? '1' : '2';
    return { ...data, geom: { ...kept, zones } as unknown as GeomData };
  };

  return {
    ...project,
    data: convert(project.data),
    initialData: convert(project.initialData),
    calcSnapshot: [null, null, null],
  };
}

/**
 * Плоская форма геометрии — та, что была в хранилище до версии 19:
 * зоны стояли отдельными полями `l11`/`b11`/`b41`, `l12`/`b12`/`b42`,
 * а их число — строкой `zones`.
 *
 * Ранние миграции работают с ней, а не с сегодняшним `GeomData`: они
 * разбирают записи, которые новой формы ещё не видели, и приводить их
 * к массиву зон по дороге незачем — это делает v19, одна на всех.
 */
type FlatGeom = Record<string, string | undefined>;

/** Сегодняшние умолчания в плоском виде — опора для ранних миграций. */
function flatDefaults(geom: GeomData): FlatGeom {
  const [first, second] = geom.zones;
  return {
    b40: geom.b40,
    b10: geom.b10,
    b2: geom.b2,
    l2: geom.l2,
    theta: geom.theta,
    angleUnit: geom.angleUnit,
    D: geom.D,
    H: geom.H,
    S0: geom.S0,
    R: geom.R,
    a: geom.a,
    zones: String(geom.zones.length),
    l11: first.l1,
    b11: first.b1,
    b41: first.b4,
    l12: second?.l1 ?? first.l1,
    b12: second?.b1 ?? first.b1,
    b42: second?.b4 ?? first.b4,
  };
}

/**
 * v19 — зоны дробления стали набором, а не парой именованных троек.
 *
 * Число зон больше не хранится отдельной строкой: им служит длина
 * самого набора. Отдельное поле-счётчик неизбежно разъезжалось с набором
 * троек — ровно это и случалось, когда зон стало то три, то две.
 *
 * Плоские поля `l11`/`b11`/`b41` и `l12`/`b12`/`b42` складываются
 * в массив по сохранённому числу зон: тройка, которую пользователь
 * не показывал и не заполнял, в набор не попадает.
 *
 * `calcSnapshot` сбрасывается: снимок снят с прежней формы `GeomData`,
 * и сравнение с ним показывало бы расхождение там, где пользователь
 * ничего не менял.
 */
function migrateZoneListV19(project: Project): Project {
  const defaults = defaultWizardData().geom;

  const convert = (data: WizardData): WizardData => {
    const geom = data.geom as unknown as FlatGeom;
    if (Array.isArray((geom as { zones?: unknown }).zones)) return data;

    const count = Math.max(1, Math.min(Number(geom.zones) || 1, 2));
    const flat: [string, string, string][] = [
      ['l11', 'b11', 'b41'],
      ['l12', 'b12', 'b42'],
    ];

    const zones: ZoneData[] = flat.slice(0, count).map(([l1, b1, b4], i) => ({
      l1: geom[l1] ?? defaults.zones[i]?.l1 ?? defaults.zones[0].l1,
      b1: geom[b1] ?? defaults.zones[i]?.b1 ?? defaults.zones[0].b1,
      b4: geom[b4] ?? defaults.zones[i]?.b4 ?? defaults.zones[0].b4,
    }));

    return {
      ...data,
      geom: {
        b40: geom.b40 ?? defaults.b40,
        b10: geom.b10 ?? defaults.b10,
        zones,
        l2: geom.l2 ?? defaults.l2,
        b2: geom.b2 ?? defaults.b2,
        theta: geom.theta ?? defaults.theta,
        angleUnit: geom.angleUnit === 'рад' ? 'рад' : 'deg',
        D: geom.D ?? defaults.D,
        H: geom.H ?? defaults.H,
        S0: geom.S0 ?? defaults.S0,
        R: geom.R ?? defaults.R,
        a: geom.a ?? defaults.a,
      },
    };
  };

  return {
    ...project,
    data: convert(project.data),
    initialData: convert(project.initialData),
    calcSnapshot: [null, null, null],
  };
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
    const specs = catalogOf('crushers').find((c) => c.name === primaryName)?.values;

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
      calcSnapshot: [null, null, null],
      data: input.data,
      // Опора «Дельта» с самого начала — не только после первого расчёта.
      initialData: input.data,
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
