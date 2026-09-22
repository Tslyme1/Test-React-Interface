import type { ProjectMode } from '@/types';
import styles from './ModeIllustration.module.css';

export type ModeIllustrationProps = {
  mode: ProjectMode;
};

/**
 * Чем режимы отличаются — одной схемой.
 *
 * Схемы построены как пара: в обеих есть один и тот же столбец полей
 * расчёта, и разница ровно в том, откуда в них берутся числа. В
 * инженерном поля набирают — над ними курсор и карандаш. В упрощённом
 * те же поля заполняются сами от отмеченной строки справочника — слева
 * таблица, от неё стрелка к полям, и поля уже заполнены.
 *
 * Раньше схемы показывали чертёж камеры в одной карточке и отчёт
 * в другой. Это сбивало: чертёж и отчёт есть в обоих режимах, и картинка
 * обещала различие там, где его нет. Показывать надо то, что различает,
 * а не то, что в режиме вообще есть.
 *
 * Свой SVG, а не растровые картинки из `public/assets`: рисунок обязан
 * следовать теме, акценту и размеру шрифта, а PNG пришлось бы держать
 * в двух вариантах и всё равно промахнуться мимо границ системы. Тот же
 * приём, что у `ChamberScheme` и `GranulometryChart`.
 *
 * `aria-hidden`: рядом с картинкой стоят название режима, строка-сводка
 * и три пункта списка — всё, что схема показывает, уже сказано словами,
 * и озвучивать её второй раз значит читать одно и то же дважды.
 *
 * Левый верхний угол в обеих схемах оставлен пустым: там лежит
 * переключатель карточки (см. `LoginPage.module.css`).
 */
export function ModeIllustration({ mode }: ModeIllustrationProps) {
  return (
    <div className={styles.frame}>
      {mode === 'engineering' ? <EngineeringScheme /> : <SimplifiedScheme />}
    </div>
  );
}

/** Общие свойства линий: толщина и скругления — одни на оба рисунка. */
const LINE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** Заполненная строка — набранное или подставленное значение. */
const FILL = { fill: 'currentColor', opacity: 0.35 } as const;

/** Три строки полей расчёта — общая часть обеих схем. */
const ROWS = [0, 1, 2];

/**
 * Инженерный: те же поля, но их набирают. Курсор в первом поле
 * и карандаш рядом — вводит человек.
 */
function EngineeringScheme() {
  return (
    <svg className={styles.svg} viewBox="0 0 220 112" role="presentation" aria-hidden="true" focusable="false">
      {ROWS.map((i) => {
        const y = 12 + i * 34;
        return (
          <g key={i}>
            <rect x="40" y={y} width="34" height="5" rx="2.5" {...FILL} />
            <rect x="40" y={y + 9} width="132" height="18" rx="3" {...LINE} />
            <rect x="47" y={y + 15} width={[52, 34, 68][i]} height="5" rx="2.5" {...FILL} />
          </g>
        );
      })}

      <g className={styles.accent}>
        {/* Курсор в первом поле — в него сейчас и печатают. */}
        <path d="M105 24 V38" {...LINE} strokeWidth={2} />
        {/* Карандаш у поля: значения приходят с клавиатуры, а не откуда-то. */}
        <g transform="translate(182 20)">
          <path d="M2 22 h5" {...LINE} />
          <path d="M14 1.5 a2.1 2.1 0 0 1 3 3 L6 15.5 l-4 1 1-4 Z" {...LINE} />
        </g>
      </g>
    </svg>
  );
}

/**
 * Упрощённый: слева справочник с отмеченной строкой, от неё стрелка
 * к тем же полям — и поля уже заполнены.
 */
function SimplifiedScheme() {
  return (
    <svg className={styles.svg} viewBox="0 0 220 112" role="presentation" aria-hidden="true" focusable="false">
      {/* Справочник: шапка и четыре строки, одна отмечена. */}
      <rect x="6" y="24" width="86" height="82" rx="4" {...LINE} />
      <path d="M6 40 H92" {...LINE} opacity="0.6" />
      <rect x="14" y="29" width="32" height="5" rx="2.5" {...FILL} />

      {[0, 1, 2, 3].map((i) => {
        const y = 48 + i * 14;
        const picked = i === 1;
        return (
          <g key={i} className={picked ? styles.accent : undefined}>
            {picked ? <path d="M14 0 l3 3.5 l5.5 -6" {...LINE} transform={`translate(0 ${y + 1})`} /> : null}
            <rect x={picked ? 26 : 14} y={y} width={picked ? 50 : [58, 0, 44, 52][i]} height="5" rx="2.5" {...FILL} />
          </g>
        );
      })}

      <g className={styles.accent}>
        {/* Значения идут из справочника в поля, а не с клавиатуры. */}
        <path d="M98 65 H112 M107 60 L112 65 L107 70" {...LINE} />

        {ROWS.map((i) => {
          const y = 12 + i * 34;
          return (
            <g key={i}>
              <rect x="120" y={y} width="30" height="5" rx="2.5" {...FILL} />
              <rect x="120" y={y + 9} width="94" height="18" rx="3" {...LINE} />
              <rect x="127" y={y + 15} width={[46, 30, 58][i]} height="5" rx="2.5" {...FILL} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
