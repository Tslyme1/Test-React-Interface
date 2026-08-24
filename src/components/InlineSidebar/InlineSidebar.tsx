import type { ReactNode } from 'react';
import { Button, Stack, Text } from '@uralmash/design-system';
import styles from './InlineSidebar.module.css';

export type InlineSidebarProps = {
  /** Развёрнута или свёрнута в рейку. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Заголовок панели — виден развёрнутым и как подпись рейки свёрнутым. */
  title: string;
  /** Действия у заголовка — например, поповеры режима отображения. Видны только развёрнутым. */
  actions?: ReactNode;
  children: ReactNode;
};

/**
 * Область экрана, которая выезжает и заезжает обратно, не покидая раскладку.
 *
 * От `Drawer` системы отличается ровно этим: `Drawer` перекрывает рабочую
 * область поверх, а эта панель — часть той же строки, что и соседняя
 * колонка, и раздвигает её собой. Свёрнутая рейка не имеет своей ширины —
 * её задаёт содержимое (кнопка-шеврон и подпись вбок), как и раньше.
 *
 * Содержимое при сворачивании не размонтируется и не переключается на другой
 * вид — просто уезжает за левый край своей полосы (`overflow: hidden`),
 * поэтому раскрытие обратно ничего не пересобирает, только возвращает ширину.
 */
export function InlineSidebar({ open, onOpenChange, title, actions, children }: InlineSidebarProps) {
  return (
    <div className={styles.root}>
      <div className={styles.rail}>
        <Button
          variant="ghost"
          size="sm"
          icon={open ? 'chevronRight' : 'chevronLeft'}
          aria-label={open ? `Свернуть: ${title}` : `Развернуть: ${title}`}
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
        />
        {!open ? (
          <div className={styles.railLabel}>
            <Text variant="caption" color="textMuted">
              {title}
            </Text>
          </div>
        ) : null}
      </div>

      <div className={styles.panel} data-open={open} aria-hidden={!open}>
        <div className={styles.panelInner}>
          <Stack gap="sm" direction="column">
            <Stack direction="row" justify="between" align="center" gap="sm">
              <Text variant="headingMd">{title}</Text>
              {actions ? <Stack direction="row" align="center" gap="xs">{actions}</Stack> : null}
            </Stack>
            {children}
          </Stack>
        </div>
      </div>
    </div>
  );
}
