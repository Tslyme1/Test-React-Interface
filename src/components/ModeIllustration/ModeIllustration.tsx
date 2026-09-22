import type { ProjectMode } from '@/types';
import styles from './ModeIllustration.module.css';

export type ModeIllustrationProps = {
  mode: ProjectMode;
};

/**
 * Что происходит в режиме — одной схемой.
 *
 * Обе картинки читаются слева направо: слева то, что делает человек,
 * справа то, что он получает. В инженерном слева — поля, которые
 * заполняют по одному, справа — чертёж камеры; в упрощённом слева —
 * три условия отбора, справа — список подходящих машин и отчёт.
 * Разницу режимов («ввожу сам» против «выбираю из готового») словами
 * приходится объяснять абзацем, схемой — видно сразу.
 *
 * Свой SVG, а не растровые картинки из `public/assets`: рисунок обязан
 * следовать теме, акценту и размеру шрифта, а PNG пришлось бы держать
 * в двух вариантах и всё равно промахнуться мимо границ системы. Тот же
 * приём, что у `ChamberScheme` и `GranulometryChart`.
 *
 * `aria-hidden`: рядом с картинкой стоят название режима, строка-сводка
 * и четыре пункта списка — всё, что схема показывает, уже сказано
 * словами, и озвучивать её второй раз значит читать одно и то же дважды.
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

/** Заполненная строка поля — «уже введённое значение». */
const FILL = { fill: 'currentColor', opacity: 0.35 } as const;

/**
 * Инженерный: столбец полей слева, чертёж камеры справа.
 *
 * Камера нарисована тем же силуэтом, что и настоящая схема этапа 1, —
 * две сходящиеся книзу образующие с щелью между ними внизу.
 */
function EngineeringScheme() {
  return (
    <svg className={styles.svg} viewBox="0 0 220 112" role="presentation" aria-hidden="true" focusable="false">
      {/* Поля ввода: подпись и рамка — по одному на строку, как в форме этапа. */}
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(4 ${6 + i * 26})`}>
          <rect x="0" y="0" width="34" height="5" rx="2.5" {...FILL} />
          <rect x="0" y="9" width="84" height="15" rx="3" {...LINE} />
          <rect x="6" y="14" width={[40, 26, 52, 33][i]} height="5" rx="2.5" {...FILL} />
        </g>
      ))}

      {/* Чертёж камеры — то, что из этих полей выходит. */}
      <g className={styles.accent}>
        {/* Ось дробилки. */}
        <path d="M150 8 V104" {...LINE} strokeDasharray="4 4" opacity="0.5" />
        {/* Броня чаши: наружный контур, ломаный по зонам. */}
        <path d="M112 12 L126 58 L134 88 L139 98" {...LINE} />
        {/* Броня конуса: внутренний контур, сходящийся к разгрузочной кромке. */}
        <path d="M150 20 L146 62 L144 90 L143 98" {...LINE} />
        {/* Разгрузочная щель S₀ — то, ради чего профиль и считают. */}
        <path d="M139 101 H143" {...LINE} strokeWidth={3} />
        {/* Выносная линия диаметра основания. */}
        <path d="M112 12 H150" {...LINE} strokeDasharray="3 3" opacity="0.6" />
        {/* Зеркальная половина — чтобы силуэт читался как камера, а не как угол. */}
        <g transform="translate(300 0) scale(-1 1)">
          <path d="M112 12 L126 58 L134 88 L139 98" {...LINE} opacity="0.45" />
          <path d="M150 20 L146 62 L144 90 L143 98" {...LINE} opacity="0.45" />
        </g>
      </g>
    </svg>
  );
}

/**
 * Упрощённый: три условия слева, список подходящих позиций справа.
 *
 * Флажки у названий — набор, а не одна строка: в этом режиме выбирают
 * сразу несколько машин, и отчёт считает каждую комбинацию.
 */
function SimplifiedScheme() {
  return (
    <svg className={styles.svg} viewBox="0 0 220 112" role="presentation" aria-hidden="true" focusable="false">
      {/* Условия отбора: поле и заданная в нём граница. */}
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(4 ${12 + i * 30})`}>
          <rect x="0" y="0" width="30" height="5" rx="2.5" {...FILL} />
          <rect x="0" y="9" width="76" height="15" rx="3" {...LINE} />
          <rect x="6" y="14" width={[46, 30, 38][i]} height="5" rx="2.5" {...FILL} />
        </g>
      ))}

      {/* Стрелка «условия → подходящие позиции». */}
      <path d="M88 56 H104 M99 51 L104 56 L99 61" {...LINE} opacity="0.7" />

      {/* Подобранные позиции: только названия и флажки — характеристики
          заданы слева, и повторять их справа значит отвечать на уже
          заданный вопрос. */}
      <g className={styles.accent}>
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(114 ${16 + i * 22})`}>
            <rect x="0" y="0" width="12" height="12" rx="3" {...LINE} />
            {i < 2 ? <path d="M3 6.5 L5 9 L9.5 3.5" {...LINE} /> : null}
            <rect x="18" y="3.5" width={[64, 50, 58][i]} height="5" rx="2.5" {...FILL} />
          </g>
        ))}

        {/* Отчёт по набору — лист с таблицей под списком. */}
        <g transform="translate(114 84)">
          <path d="M0 3 a3 3 0 0 1 3-3 h48 l8 8 v17 a3 3 0 0 1-3 3 H3 a3 3 0 0 1-3-3 z" {...LINE} />
          <path d="M51 0 v8 h8" {...LINE} />
          <rect x="7" y="13" width="44" height="4" rx="2" {...FILL} />
          <rect x="7" y="20" width="30" height="4" rx="2" {...FILL} />
        </g>
      </g>
    </svg>
  );
}
