import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { arcPath, buildChamberGeometry, dir, makeTransform, norm, phiOf, polar } from '@/domain/chamberGeometry';
import type { ChainResult, Vec2 } from '@/domain/chamberGeometry';
import type { ChamberProfileInput } from '@/domain/chamberProfile';
import styles from './ChamberScheme.module.css';

/**
 * Слои чертежа — те же пять, что и в прототипе-источнике
 * (`legacy-prototype/uploads/cone-crusher-chamber.html`).
 */
export type ChamberSchemeLayers = {
  /** Заливка зон входа, дробления и калибровки. */
  zones?: boolean;
  /** Лучи из точки подвеса и подписи r. */
  rays?: boolean;
  /** Дуги узловых углов β и якорных α. */
  arcs?: boolean;
  /** Зазоры S между бронями во всех пяти точках. */
  gaps?: boolean;
  /** Размеры D/2 и h. */
  dims?: boolean;
};

const DEFAULT_LAYERS: Required<ChamberSchemeLayers> = {
  zones: true,
  rays: false,
  arcs: false,
  gaps: false,
  dims: true,
};

/**
 * Участок чертежа — ключ связи со строкой формы. Тот же набор, что
 * `data-key` в прототипе: узлы обеих цепочек, якорные лучи, качание,
 * зазоры, размеры и именованные части машины.
 *
 * Наведение на участок подсвечивает строку формы с этим же ключом
 * и наоборот (см. `zoned` в `GeometryStep`).
 */
export type ChamberHighlightKey =
  | 'a40'
  | 't3'
  | 'a10'
  | 't2'
  | 'theta'
  | 'axis'
  | 'apex'
  | 'bowl'
  | 'cone'
  | 'dim-h'
  | 'dim-d'
  /* Узлы и зазоры нумерованы, а не перечислены поимённо: зон дробления
     столько, сколько задал пользователь, и закрытый список ключей
     упирался в потолок ровно там, где методика его не ставит. `nb0` —
     узел 40 у чаши, `nc0` — узел 10 у конуса, дальше по сечениям. */
  | `nb${number}`
  | `nc${number}`
  | `gap${number}`;

/**
 * Узлы, которыми кончается зона дробления `index` (считая с нуля), —
 * ключи подсветки для полей этой зоны в форме.
 *
 * Экспортируется, чтобы форма и чертёж брали ключ из одного места:
 * связь «поле ↔ участок» рвалась ровно тогда, когда её считали дважды.
 */
export function zoneNodeKeys(index: number): { bowl: ChamberHighlightKey; cone: ChamberHighlightKey } {
  return { bowl: `nb${index + 1}`, cone: `nc${index + 1}` };
}

export type ChamberSchemeProps = {
  /** Исходные данные этапа 1 — из них считается и профиль, и чертёж. */
  input: ChamberProfileInput;
  /** Какие группы элементов рисовать. Непереданные группы — по умолчанию. */
  layers?: ChamberSchemeLayers;
  /**
   * Режим «Линии построения»: середины брони чаши прячутся, зато
   * появляются технические подписи — так же, как пресет `build`
   * в прототипе.
   */
  construction?: boolean;
  /** Участок, подсвеченный наведением на поле формы. */
  highlight?: ChamberHighlightKey | null;
  /**
   * Наведение на участок самой схемы — обратное направление связи.
   * `null` — курсор ушёл с участка. Без этого пропа схема остаётся
   * неинтерактивной.
   */
  onZoneHover?: (key: ChamberHighlightKey | null) => void;
  className?: string;
};

const VB = { w: 1180, h: 840 };
/** Рабочая область построения внутри viewBox — те же значения, что в прототипе. */
const AREA = { x: 262, y: 78, w: 640, h: 690 };

/**
 * Подписи узлов зависят от числа зон дробления: оно исходное данное
 * методики и задаёт длину массивов l₁(i), β₁(i), β₄(i) — а значит,
 * и сколько узлов на чертеже. При N зонах узлов N + 2: по одному на
 * расчётное сечение 1…KU плюс основание конуса.
 *
 * Именование — как на чертеже методики: первый узел 40 / 10, дальше
 * 41, 42, …, последнее расчётное сечение 4i / 1i (i-е, отсюда индекс),
 * и основание 3 / 2.
 */
const SUB = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

function nodeNames(count: number, side: 'b' | 'c'): string[] {
  const head = side === 'b' ? '4' : '1';
  const base = side === 'b' ? '3' : '2';
  return Array.from({ length: count }, (_, j) => {
    if (j === count - 1) return base;
    if (j === count - 2) return `${head}i`;
    return `${head}${j}`;
  });
}

function nodeKeys(count: number, side: 'b' | 'c'): ChamberHighlightKey[] {
  const prefix = side === 'b' ? 'nb' : 'nc';
  const last: ChamberHighlightKey = side === 'b' ? 't3' : 't2';
  return Array.from({ length: count }, (_, j) =>
    j === count - 1 ? last : (`${prefix}${j}` as ChamberHighlightKey)
  );
}

/** Подписи сегментов: зоны дробления l₁₁…l₁ᵢ и зона калибровки l₂. */
function segmentLabels(segments: number): string[] {
  return Array.from({ length: segments }, (_, j) => {
    if (j === segments - 1) return 'l₂';
    if (j === segments - 2) return 'l₁ᵢ';
    return `l₁${sub(j + 1)}`;
  });
}

/** Нижний индекс числом. За пределами одной цифры — как есть: подписей
    столько, сколько зон, а зон пользователь волен задать и больше девяти. */
function sub(value: number): string {
  return SUB[value] ?? String(value);
}

/** Подписи раскрытия камеры в узлах: S₁…Sᵢ по сечениям, S₀ на разгрузке. */
function gapLabels(count: number): string[] {
  return Array.from({ length: count }, (_, j) => (j === count - 1 ? 'S₀' : `S${sub(j + 1)}`));
}
const gapKey = (i: number): ChamberHighlightKey => `gap${i}`;

/** Ширина прозрачной цели для курсора поверх тонкой линии. */
const HIT_WIDTH = 18;

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

function fmt(v: number, digits = 0): string {
  /* Степень десятки, а не «есть знаки / нет знаков»: прежняя версия
     округляла до одного знака при любом ненулевом `digits`, и подпись
     угла 63,96° показывала 64°. */
  const k = 10 ** digits;
  return (Math.round(v * k) / k).toLocaleString('ru-RU');
}

function pathFrom(points: Vec2[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'}${round(p.x)} ${round(p.y)}`).join(' ');
}

function polygonFrom(points: Vec2[]): string {
  return `${pathFrom(points)} Z`;
}

/** Пересечение горизонтали `y` с ломаной — точка, от которой ведут выноску. */
function xAtY(points: Vec2[], y: number): number | null {
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) {
      const t = (y - a.y) / (b.y - a.y);
      return a.x + t * (b.x - a.x);
    }
  }
  return null;
}

/** Фигурная скобка слева от чертежа — та же форма, что в прототипе. */
function bracket(x: number, y1: number, y2: number, out: number): string {
  const m = (y1 + y2) / 2;
  return (
    `M${round(x + out)} ${round(y1)} L${round(x)} ${round(y1 + 7)} L${round(x)} ${round(m - 7)} ` +
    `L${round(x - 6)} ${round(m)} L${round(x)} ${round(m + 7)} L${round(x)} ${round(y2 - 7)} ` +
    `L${round(x + out)} ${round(y2)}`
  );
}

/**
 * Параметрическая схема профиля камеры дробления.
 *
 * Декларативный React-SVG, без единой строки через `dangerouslySetInnerHTML`:
 * весь чертёж — дерево `<path>`/`<circle>`/`<text>` из точек, посчитанных
 * `computeChamberGeometry` (см. `src/domain/chamberGeometry.ts`).
 *
 * Каждый участок несёт свой ключ и прозрачную цель для курсора: по ключу
 * чертёж связан со строкой формы в обе стороны — наведение на одно
 * подсвечивает другое.
 */
export function ChamberScheme({
  input,
  layers,
  construction = false,
  highlight,
  onZoneHover,
  className,
}: ChamberSchemeProps) {
  const L = { ...DEFAULT_LAYERS, ...layers };
  const geometry = useMemo(() => buildChamberGeometry(input), [input]);

  const transform = useMemo(
    () => makeTransform([{ x: 0, y: 0 }, ...geometry.bowl.points, ...geometry.cone.points], AREA),
    [geometry]
  );

  const bowlRaw = geometry.bowl.points;
  const coneRaw = geometry.cone.points;
  const B = bowlRaw.map(transform.point);
  const C = coneRaw.map(transform.point);

  /* Число узлов диктует число зон дробления — исходное данное методики,
     а не константа чертежа: при одной зоне узлов три, при трёх — пять. */
  const NODES = B.length;
  const LAST = NODES - 1;
  const NAMES_B = nodeNames(NODES, 'b');
  const NAMES_C = nodeNames(NODES, 'c');
  const KEYS_B = nodeKeys(NODES, 'b');
  const KEYS_C = nodeKeys(NODES, 'c');
  const LLAB = segmentLabels(NODES - 1);
  const SLAB = gapLabels(NODES);
  const apex = transform.point({ x: 0, y: 0 });
  const bottom = AREA.y + AREA.h + 30;
  const top = AREA.y - 24;

  /* Точки чертежа теперь и есть истинные координаты в миллиметрах: под
     габариты ничего не подгоняется, поэтому подписи r, β и размеров можно
     читать прямо с них. Раньше здесь была вторая, «некалиброванная» копия
     геометрии — она понадобилась именно потому, что нарисованное расходилось
     с посчитанным. */
  const bowlTrue = bowlRaw;
  const coneTrue = coneRaw;

  /* Габариты берутся из исходных данных — и совпадают с чертежом точно:
     узел 2 построен как (D/2, H), а щель S₀ входит в рекурсию раскрытия. */
  const gapRaw = input.S0;
  const diameterRaw = input.D;
  const heightRaw = input.H;

  /* Раскрытие камеры по сечениям — методика различает S1 (вдоль хода
     эксцентрика) и SOT (просвет по нормали, фактический размер для куска).
     Прямое расстояние между узлами не равно ни тому, ни другому, поэтому
     подписи зазоров берутся из расчёта, а не меряются по картинке. */
  const sectionGaps = geometry.profile.sections.slice(1);

  /* Вход методики — в радианах, чертёж считает углы в градусах (конвенция
     `dir`/`polar`). Переводим один раз здесь, а не в каждой подписи. */
  const thetaDeg = (input.theta * 180) / Math.PI;

  /** Середины брони чаши прячутся в режиме построения — как в прототипе. */
  const showMid = !construction;

  const on = (key: ChamberHighlightKey) => highlight === key;
  /** Приглушение всего, что не подсвечено: активный участок читается сразу. */
  const dim = highlight != null;

  /**
   * Группа участка: свой ключ в разметке плюс обработчики наведения.
   *
   * `data-zone` стоит всегда, даже когда наведение выключено: по нему
   * участок находят тесты, и искать его по подписи было бы гаданием —
   * рамка группы зависит от метрик шрифта и в разных системах разная.
   */
  const zone = (key: ChamberHighlightKey) => ({
    'data-zone': key,
    ...(onZoneHover ? { onMouseEnter: () => onZoneHover(key), onMouseLeave: () => onZoneHover(null) } : {}),
  });

  /** Класс элемента: подсвеченный, приглушённый или обычный. */
  const cls = (key: ChamberHighlightKey): string | undefined => {
    if (on(key)) return styles.on;
    return dim ? styles.off : undefined;
  };

  const parts: ReactNode[] = [];

  /* ── зоны ── */
  if (L.zones) {
    /* По одной заливке на зону: их столько же, сколько задано зон
       дробления, плюс зона калибровки последней. Раньше здесь было
       жёстко три полигона по пяти узлам — при другом числе зон они
       ложились мимо. */
    const zones: { key: ChamberHighlightKey; poly: Vec2[]; fill: string; title: string }[] = [];
    for (let j = 0; j < LAST; j += 1) {
      const calibration = j === LAST - 1;
      zones.push({
        key: KEYS_B[j],
        poly: [B[j], B[j + 1], C[j + 1], C[j]],
        /* Все зоны залиты одинаково и нейтрально. Раньше первая была
           акцентной, а зона калибровки — предупреждающей: цвет обещал
           смысл, которого нет, — первая зона ничем не важнее второй,
           а зона калибровки ни о чём не предупреждает. Границы между
           зонами и так видны: их рисуют линии профиля поверх заливки.
           Цвет здесь остаётся за подсветкой — он означает «вот этот
           участок», а не «этот участок особенный сам по себе». */
        fill: 'var(--color-surface-sunken)',
        title: calibration
          ? `Зона калибровки — участок ${NAMES_B[j]}–${NAMES_B[j + 1]} / ${NAMES_C[j]}–${NAMES_C[j + 1]}, длина ${LLAB[j]}. Щель здесь постоянна и равна S₀`
          : `Зона дробления ${j + 1} — участок ${NAMES_B[j]}–${NAMES_B[j + 1]} / ${NAMES_C[j]}–${NAMES_C[j + 1]}, длина ${LLAB[j]}`,
      });
    }
    for (const z of zones) {
      parts.push(
        <g key={`zone-${z.key}`} className={cls(z.key)} {...zone(z.key)}>
          <path d={polygonFrom(z.poly)} fill={z.fill} stroke="none">
            <title>{z.title}</title>
          </path>
        </g>
      );
    }
  }

  /* ── оси ── */
  parts.push(
    <g key="axis" className={cls('axis')} {...zone('axis')}>
      <line x1={apex.x} y1={top} x2={apex.x} y2={bottom} stroke="transparent" strokeWidth={HIT_WIDTH} pointerEvents="stroke" />
      <line x1={apex.x} y1={top} x2={apex.x} y2={bottom} stroke="var(--color-border-strong)" strokeWidth={1}>
        <title>Ось дробилки</title>
      </line>
    </g>
  );

  {
    /**
     * Ось конуса и дуга угла нутации — от точки подвеса, а не от условной
     * верхней границы рабочей области.
     *
     * Раньше обе линии стартовали в `(apex.x, top)`: `top` — отступ сверху
     * рабочей зоны (`AREA.y - 24`), а не координата самой точки подвеса
     * (`apex.y`). Пока апекс совпадал с верхом профиля лишь примерно, эти
     * 24px были незаметны, но дуга угла строилась радиусом в 86% высоты
     * оси — при таком масштабе даже небольшое расхождение вершины дуги
     * с точкой подвеса растягивалось в заметный сдвиг: дуга и подпись θ
     * оказывались у нижнего края чертежа, будто угол мерят там, а не
     * у точки подвеса наверху.
     *
     * Вершина обеих линий — `apex`, дуга — небольшим радиусом рядом
     * с точкой, тем же приёмом, что и у дуг якорных углов α40/α10 ниже.
     */
    const coneAxisEnd = polar(apex, bottom - apex.y + 40, thetaDeg);
    const R = 46;
    /* Подпись уезжает вниз по оси, а не жмётся к дуге. У точки подвеса
       сходятся ось, оба контура и все якорные лучи — буква там тонула
       среди линий. Ниже по оси, внутри конуса, место свободно, а к чему
       относится подпись, видно по самой оси, вдоль которой она стоит. */
    const labelPoint = polar(apex, R + 110, thetaDeg / 2);
    parts.push(
      <g key="theta" className={cls('theta')} {...zone('theta')}>
        <line
          x1={apex.x}
          y1={apex.y}
          x2={coneAxisEnd.x}
          y2={coneAxisEnd.y}
          stroke="transparent"
          strokeWidth={HIT_WIDTH}
          pointerEvents="stroke"
        />
        <line
          x1={apex.x}
          y1={apex.y}
          x2={coneAxisEnd.x}
          y2={coneAxisEnd.y}
          stroke="var(--color-text-muted)"
          strokeWidth={1}
          strokeDasharray="14 4 2 4"
        >
          <title>Ось конуса (наклонена на угол нутации θ)</title>
        </line>
        {thetaDeg !== 0 ? (
          <path d={arcPath(apex, R, 0, thetaDeg)} fill="none" stroke="var(--color-text-muted)" strokeWidth={1}>
            <title>θ — угол нутации конуса: {fmt(thetaDeg, 2)}°</title>
          </path>
        ) : null}
        <text x={labelPoint.x - 8} y={labelPoint.y + 4} textAnchor="end" className={styles.fsXl} fontStyle="italic" fill="var(--color-text-muted)">
          θ
        </text>
      </g>
    );
  }

  /* ── лучи из точки подвеса ── */
  if (L.rays) {
    const rays: { p: Vec2; raw: Vec2; key: ChamberHighlightKey; name: string }[] = [];
    B.forEach((p, i) => rays.push({ p, raw: bowlTrue[i], key: i === 0 ? 'a40' : KEYS_B[i - 1], name: `r${NAMES_B[i]}` }));
    C.forEach((p, i) => rays.push({ p, raw: coneTrue[i], key: i === 0 ? 'a10' : KEYS_C[i - 1], name: `r${NAMES_C[i]}` }));

    rays.forEach((r, i) => {
      const radius = Math.hypot(r.raw.x, r.raw.y);
      parts.push(
        <g key={`ray-${i}`} className={cls(r.key)} {...zone(r.key)}>
          <line x1={apex.x} y1={apex.y} x2={r.p.x} y2={r.p.y} stroke="transparent" strokeWidth={HIT_WIDTH} pointerEvents="stroke" />
          <line x1={apex.x} y1={apex.y} x2={r.p.x} y2={r.p.y} stroke="var(--color-border-strong)" strokeWidth={0.7}>
            <title>
              {r.name} = {fmt(radius)} мм, α = {fmt(phiOf(r.raw), 1)}°
            </title>
          </line>
        </g>
      );
    });

    /* Подписи радиусов — двумя выносками, как на исходном чертеже. */
    const packs = [
      { list: B, raw: bowlTrue, names: NAMES_B, keys: ['a40', ...KEYS_B] as ChamberHighlightKey[], anchor: { x: apex.x - 286, y: apex.y - 46 } },
      { list: C, raw: coneTrue, names: NAMES_C, keys: ['a10', ...KEYS_C] as ChamberHighlightKey[], anchor: { x: apex.x - 158, y: apex.y + 206 } },
    ];
    packs.forEach((pack, packIndex) => {
      pack.names.forEach((name, i) => {
        const lx = pack.anchor.x + i * 36;
        const ly = pack.anchor.y;
        const mid = {
          x: apex.x + (pack.list[i].x - apex.x) * 0.34,
          y: apex.y + (pack.list[i].y - apex.y) * 0.34,
        };
        const key = pack.keys[i];
        const radius = Math.hypot(pack.raw[i].x, pack.raw[i].y);
        parts.push(
          <g key={`rlab-${packIndex}-${i}`} className={cls(key)} {...zone(key)}>
            <rect x={lx - 3} y={ly - 13} width={34} height={19} fill="transparent" />
            <line x1={lx + 11} y1={ly + 5} x2={mid.x} y2={mid.y} stroke="var(--color-border-strong)" strokeWidth={0.7} />
            <text x={lx} y={ly} className={styles.fsMd} fontStyle="italic" fill="var(--color-text-muted)">
              r
              <tspan className={styles.fsXs} dy={3}>
                {name}
              </tspan>
              {i < 4 ? <tspan dy={-3}>,</tspan> : null}
              <title>
                r{name} = {fmt(radius)} мм
              </title>
            </text>
          </g>
        );
      });
    });
  }

  /**
   * ── зазоры S ──
   *
   * Все пять — по слою `gaps`, как в прототипе. Но S₀ рисуется и без него,
   * вместе с размерами: в отличие от прототипа, где S₀ — производная
   * величина в таблице сбоку, здесь это поле формы, которое пользователь
   * задаёт сам. Без линии на чертеже наводить на это поле было бы не на что.
   */
  if (L.gaps || L.dims) {
    const from = L.gaps ? 0 : LAST;
    for (let i = from; i <= LAST; i += 1) {
      const a = B[i];
      const b = C[i];
      /* Раскрытие берётся из расчёта. Отрезок между парными узлами — это
         и есть S1: конус нарисован в рабочем положении (повёрнут на θ),
         а в нём хорда «узел чаши — узел конуса» равна раскрытию точно,
         что и проверено на контрольном примере методики. В зоне
         калибровки раскрытие постоянно и равно S₀. */
      const section = sectionGaps[i];
      const raw = i === LAST ? gapRaw : (section?.S1 ?? gapRaw);
      const key = gapKey(i);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      parts.push(
        <g key={`gap-${i}`} className={cls(key)} {...zone(key)}>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={HIT_WIDTH} pointerEvents="stroke" />
          {/* Нейтрально, как и всё остальное на чертеже: акцент здесь —
              признак подсветки (`.on`), а не постоянный вид линии. */}
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--color-text-muted)" strokeWidth={1.8}>
            <title>
              {SLAB[i]} — раскрытие {NAMES_B[i]}–{NAMES_C[i]}: {fmt(raw)} мм
              {section && i !== 4 ? ` · просвет по нормали ${fmt(section.SOT)} мм` : ''}
            </title>
          </line>
          <text x={mid.x} y={mid.y - 6} textAnchor="middle" className={styles.fsMd} fontStyle="italic" fill="var(--color-text-muted)">
            {SLAB[i]}
          </text>
        </g>
      );
    }
  }

  /* ── цепочки профилей ── */
  const drawChain = (
    P: Vec2[],
    raw: Vec2[],
    keys: ChamberHighlightKey[],
    names: string[],
    labels: string[] | null,
    isCone: boolean
  ) => {
    for (let i = 0; i < P.length - 1; i += 1) {
      if (!isCone && !showMid && (i === 1 || i === 2)) continue;
      const key = keys[i];
      const len = Math.hypot(raw[i].x - raw[i + 1].x, raw[i].y - raw[i + 1].y);
      const dx = P[i + 1].x - P[i].x;
      const dy = P[i + 1].y - P[i].y;
      const norm2 = Math.hypot(dx, dy) || 1;
      const nx = dy / norm2;
      const ny = -dx / norm2;
      const off = isCone ? -19 : 24;
      const mid = { x: (P[i].x + P[i + 1].x) / 2 - nx * off, y: (P[i].y + P[i + 1].y) / 2 - ny * off };
      parts.push(
        <g key={`chain-${isCone ? 'c' : 'b'}-${i}`} className={cls(key)} {...zone(key)}>
          <line
            x1={P[i].x}
            y1={P[i].y}
            x2={P[i + 1].x}
            y2={P[i + 1].y}
            stroke="transparent"
            strokeWidth={HIT_WIDTH}
            pointerEvents="stroke"
          />
          <line x1={P[i].x} y1={P[i].y} x2={P[i + 1].x} y2={P[i + 1].y} stroke="var(--color-text)" strokeWidth={1.6} strokeLinejoin="round">
            <title>
              Сегмент {names[i]}→{names[i + 1]} = {fmt(len)} мм
            </title>
          </line>
          {labels ? (
            <text
              x={mid.x}
              y={mid.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className={styles.fsMd}
              fontStyle="italic"
              fill="var(--color-text-muted)"
            >
              {labels[i]}
            </text>
          ) : null}
        </g>
      );
    }
  };
  drawChain(B, bowlRaw, KEYS_B, NAMES_B, LLAB, false);
  drawChain(C, coneRaw, KEYS_C, NAMES_C, null, true);

  /* ── зона входа ──
     Приёмная часть камеры лежит выше первого расчётного сечения: её стенки
     задают углы β₄₀ и β₁₀, и на профиль этап 1 они не влияют (сечение 0
     дублирует первое — шаг 8 методики), зато определяют, куда сядет кусок
     на этапе 2. Рисуются штрихом, чтобы было видно: это продолжение броней
     вверх, а не ещё один расчётный участок. */
  {
    const stub = (node: Vec2, betaRad: number, key: ChamberHighlightKey, label: string) => {
      const len = Math.hypot(C[1].x - C[0].x, C[1].y - C[0].y) * 0.45;
      const end = { x: node.x + Math.cos(betaRad) * len, y: node.y - Math.sin(betaRad) * len };
      parts.push(
        <g key={`entry-${key}`} className={cls(key)} {...zone(key)}>
          <line x1={node.x} y1={node.y} x2={end.x} y2={end.y} stroke="transparent" strokeWidth={HIT_WIDTH} pointerEvents="stroke" />
          <line
            x1={node.x}
            y1={node.y}
            x2={end.x}
            y2={end.y}
            stroke="var(--color-text-muted)"
            strokeWidth={1.2}
            strokeDasharray="6 4"
          >
            <title>{label}</title>
          </line>
        </g>
      );
    };
    stub(B[0], input.beta40, 'nb0', `Зона входа, броня чаши: β₄₀ = ${fmt((input.beta40 * 180) / Math.PI, 2)}°`);
    stub(C[0], input.beta10 - input.theta, 'nc0', `Зона входа, броня конуса: β₁₀ = ${fmt((input.beta10 * 180) / Math.PI, 2)}° (действующий β₁₀−θ)`);
  }

  /* ── дуги узловых углов β ── */
  if (L.arcs) {
    const drawArcs = (P: Vec2[], chain: ChainResult, keys: ChamberHighlightKey[], names: string[], isCone: boolean) => {
      chain.info.forEach((node, i) => {
        const c = P[i];
        const R = 34;
        /*
         * Угол β — наклон образующей к плоскости основания, то есть
         * к горизонтали («угол при основании конуса» в исходных данных).
         *
         * Дуга кладётся ровно туда же, где она на чертеже методики: между
         * горизонтальной линией уровня, идущей от узла К ОСИ дробилки,
         * и образующей, уходящей от узла ВВЕРХ. Обе стороны угла при этом
         * настоящие — горизонталь нарисована штрихом рядом, а вторая
         * сторона лежит на самой образующей.
         *
         * Направления в конвенции `dir`: φ = −90° — горизонталь к оси
         * (в этой системе ось справа), φ = phiSeg + 180° — образующая
         * вверх (`phiSeg` смотрит по ходу построения, то есть вниз).
         *
         * Прошлая версия открывала дугу наружу и вниз — в сторону, где
         * никакой линии нет, и угол читался как отложенный от чего-то
         * своего, а не от горизонтали.
         */
        const a0 = -90;
        const a1 = node.phiSeg + 180;
        const d = arcPath(c, R, a0, a1);
        const midAngle = a0 + norm(a1 - a0) / 2;
        const labelPoint = polar(c, R + 18, midAngle);
        const key = keys[i];
        parts.push(
          <g key={`arc-${isCone ? 'c' : 'b'}-${i}`} className={cls(key)} {...zone(key)}>
            <path d={d} fill="none" stroke="transparent" strokeWidth={HIT_WIDTH} pointerEvents="stroke" />
            <path d={d} fill="none" stroke="var(--color-text-muted)" strokeWidth={1}>
              <title>
                β{names[i]} = {fmt(node.beta, 2)}° к горизонтали
                {isCone ? ' · конус показан в рабочем положении, поэтому это β − θ' : ''}
              </title>
            </path>
            {/* Горизонталь, от которой отложен угол: без неё дуга висит
                в воздухе и β читается как угол к чему-то другому. Идёт
                к оси дробилки — как линии уровней на чертеже методики. */}
            <line
              x1={c.x}
              y1={c.y}
              x2={c.x + dir(-90).x * (R + 26)}
              y2={c.y + dir(-90).y * (R + 26)}
              stroke="var(--color-border-strong)"
              strokeWidth={0.7}
              strokeDasharray="4 4"
            />
            {node.terminal ? (
              /* У верхнего узла участка выше нет — вторую сторону угла
                 (стенку приёмной части) достраиваем пунктиром. */
              <line
                x1={c.x}
                y1={c.y}
                x2={c.x + dir(node.phiSeg + 180).x * 62}
                y2={c.y + dir(node.phiSeg + 180).y * 62}
                stroke="var(--color-text-muted)"
                strokeWidth={0.7}
                strokeDasharray="4 4"
              />
            ) : null}
            <text
              x={labelPoint.x}
              y={labelPoint.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className={styles.fsMd}
              fontStyle="italic"
              fill="var(--color-text-muted)"
            >
              β
              <tspan className={styles.fsXs} dy={3}>
                {names[i]}
              </tspan>
              {isCone ? <tspan dy={-3}>−θ</tspan> : null}
            </text>
          </g>
        );
      });
    };
    drawArcs(B, geometry.bowl, KEYS_B, NAMES_B, false);
    drawArcs(C, geometry.cone, KEYS_C, NAMES_C, true);
  }

  /* ── точки профиля ── */
  const drawPoints = (P: Vec2[], raw: Vec2[], keys: ChamberHighlightKey[], names: string[], side: 'b' | 'c') => {
    P.forEach((p, i) => {
      const key = i === 0 ? (side === 'b' ? 'a40' : 'a10') : keys[i - 1];
      const active = on(key);
      const dx = side === 'b' ? -11 : -10;
      const dy = side === 'b' ? 3 : 15;
      const radius = Math.hypot(raw[i].x, raw[i].y);
      parts.push(
        <g key={`pt-${side}-${i}`} className={cls(key)} {...zone(key)}>
          <circle cx={p.x} cy={p.y} r={HIT_WIDTH / 2} fill="transparent" />
          <circle
            cx={p.x}
            cy={p.y}
            r={active ? 4.6 : 3.4}
            fill="var(--color-surface)"
            stroke="var(--color-text)"
            strokeWidth={active ? 1.8 : 1.2}
          />
          <circle cx={p.x} cy={p.y} r={1.1} fill="var(--color-text)" />
          <text x={p.x + dx} y={p.y + dy} textAnchor="end" className={styles.fsSm} fill="var(--color-text)">
            {names[i]}
          </text>
          <title>
            Точка {names[i]} · r = {fmt(radius)} мм · α = {fmt(phiOf(raw[i]), 1)}°
          </title>
        </g>
      );
    });
  };
  drawPoints(B, bowlTrue, KEYS_B, NAMES_B, 'b');
  drawPoints(C, coneTrue, KEYS_C, NAMES_C, 'c');

  /* точка подвеса */
  parts.push(
    <g key="apex" className={cls('apex')} {...zone('apex')}>
      <circle cx={apex.x} cy={apex.y} r={11} fill="transparent" />
      <circle cx={apex.x} cy={apex.y} r={3.4} fill="var(--color-surface)" stroke="var(--color-text)" strokeWidth={1.2} />
      <circle cx={apex.x} cy={apex.y} r={1.1} fill="var(--color-text)" />
      <title>Точка подвеса — начало отсчёта всех лучей</title>
    </g>
  );

  /* якорные углы α у подвеса */
  if (L.arcs || L.rays) {
    /* α узла 40 и узла 10 — выход рекурсии (§3.2, шаги 3 и 6), а не поле
       формы: берём их из расчёта первого сечения, которому эти узлы и
       соответствуют. */
    ([
      ['a40', phiOf(bowlRaw[0]), '40'],
      ['a10', phiOf(coneRaw[0]), '10'],
    ] as [ChamberHighlightKey, number, string][]).forEach(([key, value, sub], i) => {
      const R = 62 + i * 26;
      const d = arcPath(apex, R, 0, value);
      const labelPoint = polar(apex, R + 15, value / 2);
      parts.push(
        <g key={`anchor-${key}`} className={cls(key)} {...zone(key)}>
          <path d={d} fill="none" stroke="transparent" strokeWidth={HIT_WIDTH} pointerEvents="stroke" />
          <path d={d} fill="none" stroke="var(--color-text-muted)" strokeWidth={1}>
            <title>
              α{sub} = {fmt(value, 1)}° от оси дробилки
            </title>
          </path>
          <text
            x={labelPoint.x}
            y={labelPoint.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className={styles.fsMd}
            fontStyle="italic"
            fill="var(--color-text-muted)"
          >
            α
            <tspan className={styles.fsXs} dy={3}>
              {sub}
            </tspan>
          </text>
        </g>
      );
    });
  }

  /* ── размеры D/2 и h ── */
  if (L.dims) {
    const p2 = C[LAST];

    /* Уровневые штриховые линии по точкам конуса. */
    C.forEach((p, i) => {
      const key: ChamberHighlightKey = i === 0 ? 'a10' : KEYS_C[i - 1];
      parts.push(
        <line
          key={`lvl-${i}`}
          className={cls(key)}
          x1={p.x}
          y1={p.y}
          x2={apex.x + 24}
          y2={p.y}
          stroke="var(--color-border)"
          strokeWidth={0.7}
          strokeDasharray="4 4"
        />
      );
    });

    const hx = apex.x - 74;
    parts.push(
      <g key="dim-h" className={cls('dim-h')} {...zone('dim-h')}>
        <line x1={hx} y1={apex.y} x2={hx} y2={p2.y} stroke="transparent" strokeWidth={HIT_WIDTH} pointerEvents="stroke" />
        <line
          x1={hx}
          y1={apex.y}
          x2={hx}
          y2={p2.y}
          stroke="var(--color-text-muted)"
          strokeWidth={1}
          markerStart="url(#chamber-arrow)"
          markerEnd="url(#chamber-arrow)"
        >
          <title>
            h = {fmt(heightRaw)} мм — от точки подвеса до основания конуса. Задаётся для нейтрального
            положения конуса, а нарисован он в рабочем, повёрнутым на θ, поэтому выносная линия
            короче на доли процента.
          </title>
        </line>
        <line x1={apex.x} y1={apex.y} x2={hx - 8} y2={apex.y} stroke="var(--color-text-muted)" strokeWidth={0.7} />
        <line x1={p2.x} y1={p2.y} x2={hx - 8} y2={p2.y} stroke="var(--color-text-muted)" strokeWidth={0.7} />
        <text
          x={hx - 7}
          y={(apex.y + p2.y) / 2}
          textAnchor="end"
          dominantBaseline="middle"
          className={styles.fsXl}
          fontStyle="italic"
          fill="var(--color-text-muted)"
        >
          h
        </text>
      </g>
    );

    const dy = p2.y + 42;
    parts.push(
      <g key="dim-d" className={cls('dim-d')} {...zone('dim-d')}>
        <line x1={p2.x} y1={dy} x2={apex.x} y2={dy} stroke="transparent" strokeWidth={HIT_WIDTH} pointerEvents="stroke" />
        <line
          x1={p2.x}
          y1={dy}
          x2={apex.x}
          y2={dy}
          stroke="var(--color-text-muted)"
          strokeWidth={1}
          markerStart="url(#chamber-arrow)"
          markerEnd="url(#chamber-arrow)"
        >
          <title>
            D/2 = {fmt(diameterRaw / 2)} мм — половина диаметра основания дробящего конуса.
            Как и h, задаётся для нейтрального положения.
          </title>
        </line>
        <line x1={p2.x} y1={p2.y} x2={p2.x} y2={dy + 8} stroke="var(--color-text-muted)" strokeWidth={0.7} />
        <text x={(p2.x + apex.x) / 2} y={dy - 7} textAnchor="middle" className={styles.fsMd} fontStyle="italic" fill="var(--color-text-muted)">
          D / 2
        </text>
      </g>
    );
  }

  /* ── описательные выноски ── */
  if (!construction) {
    const LX = 214;
    const BRX = 240;
    const RX = 928;
    const level = (f: number) => AREA.y + AREA.h * f;

    const rights: { y: number; x: number | null; text: string; key: ChamberHighlightKey }[] = [
      { y: level(0.3), x: apex.x, text: 'Ось дробилки', key: 'axis' },
      {
        y: level(0.56),
        x: apex.x + (level(0.56) - apex.y) * Math.tan(input.theta) * -1,
        text: 'Ось конуса',
        key: 'theta',
      },
      { y: level(0.8), x: null, text: 'Броня конуса', key: 'cone' },
    ];

    rights.forEach((r) => {
      const x = r.x ?? xAtY(C, r.y) ?? C[Math.max(0, LAST - 1)].x;
      parts.push(
        <g key={`callout-${r.key}-${r.text}`} className={cls(r.key)} {...zone(r.key)}>
          <rect x={RX - 8} y={r.y - 21} width={130} height={20} fill="transparent" />
          <polyline
            points={`${round(x)},${round(r.y)} ${round(RX - 10)},${round(r.y)}`}
            fill="none"
            stroke="var(--color-border-strong)"
            strokeWidth={0.7}
          />
          <line x1={RX - 10} y1={r.y} x2={RX + 118} y2={r.y} stroke="var(--color-text-muted)" strokeWidth={0.7} />
          <text x={RX - 6} y={r.y - 7} className={styles.fsLg} fill="var(--color-text-muted)">
            {r.text}
            <title>{r.text}</title>
          </text>
        </g>
      );
    });

    parts.push(
      <g key="callout-apex" className={cls('apex')} {...zone('apex')}>
        <rect x={RX - 8} y={apex.y - 21} width={140} height={20} fill="transparent" />
        <line x1={apex.x + 6} y1={apex.y} x2={RX + 118} y2={apex.y} stroke="var(--color-text-muted)" strokeWidth={0.7} />
        <text x={RX - 6} y={apex.y - 7} className={styles.fsLg} fill="var(--color-text-muted)">
          Точка подвеса
          <title>Точка подвеса — начало отсчёта всех лучей</title>
        </text>
      </g>
    );

    const bandY = Math.min(B[0].y, AREA.y + 40) - 46;
    const mid01 = { x: (B[0].x + B[1].x) / 2, y: (B[0].y + B[1].y) / 2 };
    parts.push(
      <g key="callout-bowl" className={cls('bowl')} {...zone('bowl')}>
        <rect x={LX - 96} y={bandY - 14} width={104} height={19} fill="transparent" />
        <polyline
          points={`${round(LX + 8)},${round(bandY - 4)} ${round(LX + 118)},${round(bandY - 4)} ${round(mid01.x - 4)},${round(mid01.y - 4)}`}
          fill="none"
          stroke="var(--color-border-strong)"
          strokeWidth={0.7}
        />
        <text x={LX} y={bandY} textAnchor="end" className={styles.fsLg} fill="var(--color-text-muted)">
          Броня чаши
          <title>Броня чаши — неподвижный профиль камеры</title>
        </text>
      </g>
    );

    /* Полосы слева повторяют тот же список зон, что и заливки: сколько
       зон дробления задано, столько и подписей, плюс калибровка. */
    const bands: { text: string; y1: number; y2: number; key: ChamberHighlightKey }[] = [];
    for (let j = 0; j < LAST; j += 1) {
      bands.push({
        text: j === LAST - 1 ? 'Зона калибровки' : `Зона дробления ${j + 1}`,
        y1: B[j].y,
        y2: B[j + 1].y,
        key: KEYS_B[j],
      });
    }
    bands.forEach((band) => {
      parts.push(
        <g key={`band-${band.key}`} className={cls(band.key)} {...zone(band.key)}>
          <rect x={LX - 120} y={(band.y1 + band.y2) / 2 - 11} width={128} height={20} fill="transparent" />
          <path d={bracket(BRX, band.y1 + 3, band.y2 - 3, 9)} fill="none" stroke="var(--color-text-muted)" strokeWidth={0.7} />
          <text x={LX} y={(band.y1 + band.y2) / 2 + 4} textAnchor="end" className={styles.fsLg} fill="var(--color-text-muted)">
            {band.text}
            <title>{band.text}</title>
          </text>
        </g>
      );
    });
  }

  return (
    <svg
      className={[styles.scheme, className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${VB.w} ${VB.h}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Схема профиля камеры дробления"
      data-testid="chamber-scheme"
      data-highlight={highlight ?? undefined}
    >
      <defs>
        <marker id="chamber-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,1 L10,5 L0,9 Z" fill="var(--color-text-muted)" />
        </marker>
      </defs>

      <rect x={0} y={0} width={VB.w} height={VB.h} fill="var(--color-surface)" />

      {parts}
    </svg>
  );
}
