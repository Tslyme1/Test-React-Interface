import { useMemo, useSyncExternalStore } from 'react';
import type { CatalogItem, SpecColumn } from '@/data/crushers';
import { CRUSHERS, CRUSHER_SPECS } from '@/data/crushers';
import { ORE_SAMPLES, ORE_SPECS } from '@/data/oreSamples';
import { catalogChanges, mergeCatalog, withCatalogEntry } from '@/domain/catalogEdits';
import type { CatalogChange, CatalogEntry } from '@/domain/catalogEdits';

/** Какой из двух справочников правят. */
export type CatalogKind = 'crushers' | 'ores';

const STORAGE_KEY = 'uztm-catalog';
const SCHEMA_VERSION = 1;

type Stored = { version: number; crushers: CatalogEntry[]; ores: CatalogEntry[] };

const EMPTY: Stored = { version: SCHEMA_VERSION, crushers: [], ores: [] };

/**
 * Правки справочника живут отдельно от проектов.
 *
 * Своя дробилка и поправленная характеристика каталожной — это про
 * справочник, а не про один расчёт: заведя машину в одном проекте,
 * пользователь ждёт её и в следующем. Класть такое в `Project` значило
 * бы заводить её заново в каждом новом проекте.
 *
 * Хранилище — модуль, а не React-контекст: справочник читают и функции
 * расчёта (`simplifiedEstimates`), которым хук недоступен, и делать ради
 * этого сквозной проп через три экрана было бы дороже, чем польза.
 * Компоненты подписываются на него `useUserCatalog`.
 */
let state: Stored = read();

const listeners = new Set<() => void>();

function read(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY;

    const payload = parsed as Partial<Stored>;
    return {
      version: SCHEMA_VERSION,
      crushers: Array.isArray(payload.crushers) ? payload.crushers : [],
      ores: Array.isArray(payload.ores) ? payload.ores : [],
    };
  } catch {
    /* Приватный режим, испорченный JSON — справочник просто остаётся
       каталожным. Правки пользователя — не те данные, ради которых стоит
       уронить экран. */
    return EMPTY;
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Квота или запрет на запись: правка доживёт до перезагрузки в памяти. */
  }
}

/** Справочник и его колонки — по виду. Одно место, где эти пары связаны. */
function sourceOf(kind: CatalogKind): { base: CatalogItem[]; specs: SpecColumn[] } {
  return kind === 'crushers'
    ? { base: CRUSHERS, specs: CRUSHER_SPECS }
    : { base: ORE_SAMPLES, specs: ORE_SPECS };
}

/** Справочник с правками пользователя — для тех, кому недоступен хук. */
export function catalogOf(kind: CatalogKind): CatalogItem[] {
  return mergeCatalog(sourceOf(kind).base, state[kind]);
}

/** Заводит свою позицию или правит каталожную. Имя — ключ: одно и то же имя правится, а не дублируется. */
export function saveCatalogEntry(kind: CatalogKind, entry: CatalogEntry) {
  state = { ...state, [kind]: withCatalogEntry(state[kind], entry) };
  persist();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* Снимок — сам объект состояния: он заменяется целиком на каждой правке,
   поэтому сравнение по ссылке в `useSyncExternalStore` работает как надо. */
function snapshot(): Stored {
  return state;
}

export type UserCatalog = {
  /** Справочник с наложенными правками — в него уже входят свои позиции. */
  items: CatalogItem[];
  specs: SpecColumn[];
  /** Чем правки отличаются от справочника: «было → стало» под таблицей. */
  changes: CatalogChange[];
  save: (entry: CatalogEntry) => void;
};

export function useUserCatalog(kind: CatalogKind): UserCatalog {
  const stored = useSyncExternalStore(subscribe, snapshot, snapshot);

  return useMemo(() => {
    const { base, specs } = sourceOf(kind);
    const entries = stored[kind];
    return {
      items: mergeCatalog(base, entries),
      specs,
      changes: catalogChanges(base, entries, specs),
      save: (entry: CatalogEntry) => saveCatalogEntry(kind, entry),
    };
  }, [kind, stored]);
}
