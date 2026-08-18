import { useCallback, useEffect, useState } from 'react';
import type { ProdData, Project, WizardData } from '@/types';
import { defaultWizardData } from '@/data/wizardDefaults';
import { buildSampleProjects } from '@/data/sampleProjects';
import { CRUSHERS } from '@/data/crushers';

const STORAGE_KEY = 'uztm-projects';

/**
 * Версия формата хранения. Меняется, когда меняется форма `Project`.
 *
 * Версия 2 добавила параметры формы куска (`a0`, `va0`, `shapeMode`,
 * `sieveRows`), версия 3 — корзину, версия 4 — отметку `seeded`. Данные
 * прежних версий не выбрасываются, а дополняются значениями по умолчанию:
 * проекты — это работа пользователя, и терять её из-за того, что мы
 * дописали поле, нельзя.
 */
const SCHEMA_VERSION = 4;

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
    if (payload.version === 3) return seedIfNeeded({ projects: payload.projects, trash, seeded });
    if (payload.version === 2) return seedIfNeeded({ projects: payload.projects, trash, seeded: false });
    if (payload.version === 1) {
      return seedIfNeeded({ projects: payload.projects.map(migrateFromV1), trash, seeded: false });
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

/** Дата с точностью до минуты — как `nowStamp()` в прототипе. */
function formatDate(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Пробы руды здесь нет: при создании она неизвестна и выбирается на шаге
 * «Грансостав». До тех пор `ore` у проекта пустая — так же, как в прототипе.
 */
export type NewProjectInput = {
  name: string;
  customer: string;
  crusherName: string;
  executor: string;
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
    // Характеристики берутся из каталога выбранной машины: они известны
    // сразу после выбора, и оставлять три колонки прочерками до расчёта
    // значит показывать полупустую строку там, где данные уже есть.
    const specs = CRUSHERS.find((c) => c.name === input.crusherName)?.values;

    const project: Project = {
      id: makeId(),
      name: input.name,
      customer: input.customer,
      crusherName: input.crusherName,
      ore: '',
      code: `П-${Math.floor(10000 + Math.random() * 89999)}`,
      tag: null,
      date: formatDate(),
      executor: input.executor,
      oreIn: specs?.['F95, мм'] ? `${specs['F95, мм']} мм (F95)` : '—',
      oreOut: specs?.['S, мм'] ? `${specs['S, мм']} мм` : '—',
      throughput: specs?.['Q, т/ч'] ? `${specs['Q, т/ч']} т/ч` : '—',
      calc: [false, false, false],
      data: input.data,
    };
    setState((prev) => ({ ...prev, projects: [project, ...prev.projects] }));
    return project;
  }, []);

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
    removeProject,
    restoreProject,
    purgeProject,
    emptyTrash,
  };
}
