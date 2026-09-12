import type { CatalogItem, SpecColumn } from '@/data/crushers';

/**
 * Правка справочника, сделанная пользователем.
 *
 * Хранится не как готовая позиция, а как **наложение** на справочник:
 * имя плюс те характеристики, которые пользователь задал. Так видно
 * разницу с исходным справочником — а её и просят показывать под
 * таблицей («что было, что стало»). Если бы правка хранилась целой
 * позицией, «до» взять было бы неоткуда.
 *
 * Позиция, которой в справочнике нет, — это тоже наложение, просто
 * поверх пустоты: своя дробилка, заведённая через «+ Новая».
 */
export type CatalogEntry = {
  name: string;
  /** Значения по короткой подписи характеристики — только заданные. */
  values: Record<string, string>;
};

/** Одна изменённая величина: было → стало. */
export type CatalogFieldChange = {
  spec: string;
  before: string;
  after: string;
};

/** Что пользователь сделал с одной позицией справочника. */
export type CatalogChange = {
  name: string;
  /** `added` — позиции в справочнике не было; `edited` — правка каталожной. */
  kind: 'added' | 'edited';
  fields: CatalogFieldChange[];
};

/** Прочерк справочника: величина не измерялась. Он же — «значения не было». */
const DASH = '—';

/**
 * Справочник с наложенными правками — то, что видит пользователь.
 *
 * Каталожные позиции остаются на своих местах и в своём порядке, только
 * с изменёнными величинами; свои позиции добавляются в конец. Порядок
 * важен: справочник отсортирован по определяющей характеристике, и
 * подмешивать правленые машины в начало значило бы менять список под
 * пользователем каждый раз, когда он что-то поправил.
 */
export function mergeCatalog(base: CatalogItem[], entries: CatalogEntry[]): CatalogItem[] {
  if (entries.length === 0) return base;

  const byName = new Map(entries.map((entry) => [entry.name, entry]));

  const merged = base.map((item) => {
    const entry = byName.get(item.name);
    if (!entry) return item;
    byName.delete(item.name);
    return { name: item.name, values: { ...item.values, ...entry.values } };
  });

  /* Осталось в карте — то, чего в справочнике нет: свои позиции. */
  return [...merged, ...byName.values()].map((item) => ({ name: item.name, values: { ...item.values } }));
}

/**
 * Чем правки отличаются от справочника — построчно, «было → стало».
 *
 * Считается от справочника, а не копится журналом действий: журнал
 * пришлось бы хранить и чистить, а вопрос у пользователя другой — не
 * «что я нажимал», а «чем эта машина теперь отличается от каталожной».
 * Ответ на него из справочника и правки выводится однозначно.
 *
 * Величины перечисляются в порядке колонок справочника: под таблицей
 * они должны читаться в том же порядке, в каком стоят в форме правки.
 */
export function catalogChanges(
  base: CatalogItem[],
  entries: CatalogEntry[],
  specs: SpecColumn[]
): CatalogChange[] {
  const byName = new Map(base.map((item) => [item.name, item]));

  return entries
    .map<CatalogChange>((entry) => {
      const original = byName.get(entry.name);
      const fields: CatalogFieldChange[] = [];

      for (const spec of specs) {
        const after = (entry.values[spec.short] ?? '').trim();
        const before = (original?.values[spec.short] ?? '').trim();
        if (after === before) continue;
        fields.push({ spec: spec.short, before: before || DASH, after: after || DASH });
      }

      return { name: entry.name, kind: original ? 'edited' : 'added', fields };
    })
    /* Позиция без единого расхождения в списке изменений не нужна: она
       появляется, например, если значение поправили и вернули обратно. */
    .filter((change) => change.kind === 'added' || change.fields.length > 0);
}

/**
 * Правка одной позиции поверх уже накопленных.
 *
 * Заменяет наложение целиком, а не дописывает к нему: форма правки
 * показывает все величины сразу, и то, что в ней осталось, и есть
 * полный ответ пользователя. Дописывание оставляло бы в хранилище
 * величины, которые он из формы стёр.
 */
export function withCatalogEntry(entries: CatalogEntry[], entry: CatalogEntry): CatalogEntry[] {
  const values = Object.fromEntries(
    Object.entries(entry.values)
      .map(([key, value]) => [key, value.trim()] as const)
      .filter(([, value]) => value !== '')
  );

  const next = { name: entry.name.trim(), values };
  const index = entries.findIndex((item) => item.name === next.name);

  if (index === -1) return [...entries, next];
  return entries.map((item, i) => (i === index ? next : item));
}

/**
 * Снимает правку с позиции: каталожная возвращается к паспортным
 * значениям, своя — исчезает из справочника совсем.
 *
 * Без этого правка необратима: «было → стало» показывает расхождение,
 * но убрать его можно было только вводом прежнего числа руками — то есть
 * пользователю пришлось бы помнить, каким оно было, хотя приложение
 * это прекрасно знает.
 */
export function withoutCatalogEntry(entries: CatalogEntry[], name: string): CatalogEntry[] {
  return entries.filter((entry) => entry.name !== name);
}
