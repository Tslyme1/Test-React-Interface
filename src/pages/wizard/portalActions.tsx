import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Stack } from '@uralmash/design-system';

/**
 * Рисует действия формы в шапке окна, если окно дало для них узел.
 *
 * Действия принадлежат форме — это её режимы отображения и её выбор
 * объекта, — а место им в шапке: они относятся к окну целиком, а не
 * к первой полосе его содержимого. Поднимать ради этого состояние формы
 * наверх значило бы размазать её по двум файлам; портал оставляет
 * состояние на месте и переносит только разметку. Контекст при этом
 * не теряется: он идёт по дереву React, а не по DOM, — поповер внутри
 * по-прежнему рисуется в то же окно (`LayerRootProvider` системы).
 *
 * Узла нет (форма показана не в окне) — действия остаются на месте,
 * строкой над содержимым.
 */
export function portalActions(slot: HTMLElement | null | undefined, actions: ReactNode): ReactNode {
  const row = (
    <Stack direction="row" justify="end" align="center" gap="sm" wrap>
      {actions}
    </Stack>
  );

  return slot ? createPortal(row, slot) : row;
}
