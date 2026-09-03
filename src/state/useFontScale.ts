import { useCallback, useEffect, useState } from 'react';

/** Масштаб шрифта интерфейса — дискретные ступени, а не свободный ползунок. */
export type FontScalePreference = 'sm' | 'md' | 'lg' | 'xl';

const STORAGE_KEY = 'uztm-font-scale';

const SCALE_FACTOR: Record<FontScalePreference, number> = {
  sm: 0.9,
  md: 1,
  lg: 1.15,
  xl: 1.3,
};

/**
 * Кегли ролей типографики системы, в px — те же числа, что заданы
 * в `:root` токенов дизайн-системы (`--text-*-size`).
 *
 * Захардкожены, а не считаны из `getComputedStyle` в рантайме: если читать
 * текущее значение переменной как «базу» для масштабирования, то после
 * первого же применения ненулевого масштаба «база» уже содержит прошлый
 * масштаб, и повторное применение множит одно на другое, а не на исходный
 * размер. Если дизайн-система когда-нибудь изменит эти числа — то же
 * место придётся поправить и здесь.
 */
const BASE_SIZE_PX: Record<string, number> = {
  '--text-body-sm-size': 12,
  '--text-body-size': 14,
  '--text-body-lg-size': 16,
  '--text-label-size': 12,
  '--text-heading-sm-size': 16,
  '--text-heading-md-size': 24,
  '--text-heading-lg-size': 32,
};

/**
 * Отступы (`--space-*`), в px — та же логика захардкоженной «базы», что
 * у `BASE_SIZE_PX` выше, и по той же причине: `getComputedStyle` в рантайме
 * после первого масштабирования уже видел бы не исходное значение.
 *
 * Растут вместе с кеглем — при крупном шрифте тот же зазор между полем
 * и соседним блоком читается ощутимо теснее, чем при обычном, потому что
 * сама буква стала выше, а расстояние вокруг неё нет. Масштабируется тем
 * же коэффициентом, что и текст: это тот же читаемый интерфейс, увеличенный
 * целиком, а не текст покрупнее в разметке, рассчитанной под прежний размер.
 */
const BASE_SPACE_PX: Record<string, number> = {
  '--space-2xs': 2,
  '--space-xs': 4,
  '--space-sm': 8,
  '--space-md': 12,
  '--space-lg': 16,
  '--space-xl': 24,
  '--space-2xl': 32,
};

function isPreference(value: unknown): value is FontScalePreference {
  return value === 'sm' || value === 'md' || value === 'lg' || value === 'xl';
}

function readStored(): FontScalePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isPreference(raw) ? raw : 'md';
  } catch {
    return 'md';
  }
}

/**
 * Масштаб шрифта — тем же приёмом, что тема (`useTheme`): переопределение
 * переменных на корне документа, без правки самой дизайн-системы.
 *
 * `--text-*-size` и `--space-*` — открытая часть контракта токенов: их явно
 * объявленное назначение — задавать кегль каждой типографической роли и шаг
 * отступов, и любой компонент системы читает их именно отсюда.
 * Переопределение этих переменных на `:root` — использование контракта по
 * назначению, а не обход системы: тот же приём, каким `[data-theme]` меняет
 * цвет токенов, не трогая ни один файл системы.
 *
 * `--text-*-line` (интерлиньяж) трогать не нужно: он задан безразмерным
 * числом (`1.4`, а не `1.4rem`), и при таком виде пересчитывается сам
 * вместе с кеглем — это стандартное поведение CSS `line-height`.
 *
 * Отступы масштабируются вместе с шрифтом, а не только он сам: иначе
 * крупный текст в разметке, рассчитанной на обычный размер, читался бы
 * теснее прежнего — те же пиксели зазора вокруг заметно выросшей буквы.
 */
export function useFontScale() {
  const [scale, setScaleState] = useState<FontScalePreference>(readStored);

  useEffect(() => {
    const root = document.documentElement;
    const factor = SCALE_FACTOR[scale];

    for (const [variable, basePx] of Object.entries({ ...BASE_SIZE_PX, ...BASE_SPACE_PX })) {
      if (factor === 1) {
        root.style.removeProperty(variable);
      } else {
        root.style.setProperty(variable, `${Math.round(basePx * factor * 100) / 100}px`);
      }
    }

    try {
      localStorage.setItem(STORAGE_KEY, scale);
    } catch {
      // Масштаб — предпочтение, а не данные пользователя: не сохранился,
      // значит в следующий раз откроется обычный. Это не повод падать.
    }
  }, [scale]);

  const setScale = useCallback((next: FontScalePreference) => setScaleState(next), []);

  return { scale, setScale };
}
