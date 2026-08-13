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
 * `sieveRows`), версия 3 — корзину. Данные прежних версий не выбрасываются,
 * а дополняются значениями по умолчанию: проекты — это работа пользователя,
 * и терять её из-за того, что мы дописали поле, нельзя.
 */
const SCHEMA_VERSION = 3;

type StoredPayload = { version: number; projects: Project[]; trash: Project[] };

type StoredState = { projects: Project[]; trash: Project[] };

/**
 * Проекты хранятся общим списком, а не по пользователю — как локальная
 * история в исходном прототипе. Настоящей многопользовательской работы
 * здесь нет: вход демонстрационный.
 *
 * Пустое хранилище означает первый запуск: подсыпаем примеры, иначе главный
 * экран открывается пустым и смотреть на список не на чем. Пустой массив
 * в хранилище — это уже осознанно очищенный список, туда примеры не лезут.
 */
function readState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { projects: buildSampleProjects(), trash: [] };

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { projects: [], trash: [] };

    const payload = parsed as Partial<StoredPayload>;
    if (!Array.isArray(payload.projects)) return { projects: [], trash: [] };

    const trash = Array.isArray(payload.trash) ? payload.trash : [];

    if (payload.version === SCHEMA_VERSION) return { projects: payload.projects, trash };
    if (payload.version === 2) return { projects: payload.projects, trash };
    if (payload.version === 1) return { projects: payload.projects.map(migrateFromV1), trash };

    // Версия из будущего или мусор — читать нечего.
    return { projects: [], trash: [] };
  } catch {
    // Битое или недоступное хранилище не должно мешать открыть приложение.
    return { projects: [], trash: [] };
  }
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
    const payload: StoredPayload = { version: SCHEMA_VERSION, ...state };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Переполненное хранилище или приватный режим — потеря сохранения,
    // но не потеря работающего приложения.
  }
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatDate(): string {
  return new Date().toLocaleDateString('ru-RU');
}

export type NewProjectInput = {
  name: string;
  customer: string;
  crusherName: string;
  ore: string;
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
      ore: input.ore,
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
