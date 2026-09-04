import { useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  applyCalibration,
  arcPath,
  computeChamberGeometry,
  dir,
  makeTransform,
  norm,
  phiOf,
  polar,
} from '@/domain/chamberGeometry';
import type { ChamberCalibration, ChamberGeometryInput, ChainResult, Vec2 } from '@/domain/chamberGeometry';
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
  | 'n40'
  | 'n41'
  | 'n42'
  | 'n4i'
  | 't3'
  | 'a10'
  | 'n10'
  | 'n11'
  | 'n12'
  | 'n1i'
  | 't2'
  | 'theta'
  | 'axis'
  | 'apex'
  | 'bowl'
  | 'cone'
  | 'gap0'
  | 'gap1'
  | 'gap2'
  | 'gap3'
  | 'gap4'
  | 'dim-h'
  | 'dim-d';

export type ChamberSchemeProps = {
  /** Полный набор параметров профиля — как в `st` прототипа-источника. */
  input: ChamberGeometryInput;
  /** Целевые D, H, S0 — независимый ввод формы, накладывается поверх построенной цепочки. */
  calibration?: ChamberCalibration;
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

const NAMES_B = ['40', '41', '42', '4i', '3'];
const NAMES_C = ['10', '11', '12', '1i', '2'];
const KEYS_B: ChamberHighlightKey[] = ['n40', 'n41', 'n42', 'n4i', 't3'];
const KEYS_C: ChamberHighlightKey[] = ['n10', 'n11', 'n12', 'n1i', 't2'];
const LLAB = ['l₁₁', 'l₁₂', 'l₁ᵢ', 'l₂'];
const SLAB = ['S₁₁', 'S₁₂', 'Sᵢ₂', 'S₁ᵢ', 'S₀'];
const GAP_KEYS: ChamberHighlightKey[] = ['gap0', 'gap1', 'gap2', 'gap3', 'gap4'];

/** Ширина прозрачной цели для курсора поверх тонкой линии. */
const HIT_WIDTH = 18;

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

function fmt(v: number, digits = 0): string {
  const k = digits ? 10 : 1;
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
  calibration,
  layers,
  construction = false,
  highlight,
  onZoneHover,
  className,
}: ChamberSchemeProps) {
  const L = { ...DEFAULT_LAYERS, ...layers };
  const geometry = useMemo(() => computeChamberGeometry(input), [input]);
  const calibrated = useMemo(() => applyCalibration(geometry, calibration ?? {}), [geometry, calibration]);

  const transform = useMemo(
    () => makeTransform([{ x: 0, y: 0 }, ...calibrated.bowl.points, ...calibrated.cone.points], AREA),
    [calibrated]
  );

  const bowlRaw = calibrated.bowl.points;
  const coneRaw = calibrated.cone.points;
  const B = bowlRaw.map(transform.point);
  const C = coneRaw.map(transform.point);
  const apex = transform.point({ x: 0, y: 0 });
  const bottom = AREA.y + AREA.h + 30;
  const top = AREA.y - 24;

  /** Истинные (некалиброванные) точки — из них считаются подписи r и β. */
  const bowlTrue = geometry.bowl.points;
  const coneTrue = geometry.cone.points;

  /**
   * Габариты в подписях берутся из полей формы, а не меряются по чертежу.
   *
   * Мерить нельзя: калибровка сначала растягивает профиль под заданные
   * D и H, а затем сдвигает конус целиком ради S₀ — и после сдвига конус
   * уже не там, где по нему мерили диаметр. Подпись начинала противоречить
   * полю формы: в поле 1750, на чертеже 1862.
   *
   * Замер остаётся запасным вариантом, когда цель не задана.
   */
  const gapRaw = calibration?.targetGap0 ?? Math.hypot(bowlRaw[4].x - coneRaw[4].x, bowlRaw[4].y - coneRaw[4].y);
  const diameterRaw = calibration?.targetDiameter ?? Math.abs(coneRaw[4].x) * 2;
  const heightRaw = calibration?.targetHeight ?? coneRaw[4].y;

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
    const zones: { key: ChamberHighlightKey; poly: Vec2[]; fill: string; title: string }[] = [
      {
        key: 'n40',
        poly: [B[0], B[1], C[1], C[0]],
        fill: 'var(--color-accent-subtle)',
        title: 'Зона входа — участок 40–41 / 10–11',
      },
      {
        key: 'n41',
        poly: [B[1], B[2], B[3], C[3], C[2], C[1]],
        fill: 'var(--color-surface-sunken)',
        title: 'Зоны дробления — участок 41–42–4i / 11–12–1i',
      },
      {
        key: 'n4i',
        poly: [B[3], B[4], C[4], C[3]],
        fill: 'var(--color-warning-subtle)',
        title: 'Зона калибровки — участок 4i–3 / 1i–2',
      },
    ];
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
    const coneAxisEnd = polar(apex, bottom - apex.y + 40, input.theta);
    const R = 46;
    const labelPoint = polar(apex, R + 16, input.theta / 2);
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
        {input.theta !== 0 ? (
          <path d={arcPath(apex, R, 0, input.theta)} fill="none" stroke="var(--color-text-muted)" strokeWidth={1}>
            <title>θ — угол нутации конуса: {fmt(input.theta, 1)}°</title>
          </path>
        ) : null}
        <text x={labelPoint.x - 4} y={labelPoint.y + 4} textAnchor="end" className={styles.fsXl} fontStyle="italic" fill="var(--color-text-muted)">
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
      { list: B, raw: bowlTrue, names: NAMES_B, keys: ['a40', ...KEYS_B.slice(0, 4)] as ChamberHighlightKey[], anchor: { x: apex.x - 286, y: apex.y - 46 } },
      { list: C, raw: coneTrue, names: NAMES_C, keys: ['a10', ...KEYS_C.slice(0, 4)] as ChamberHighlightKey[], anchor: { x: apex.x - 158, y: apex.y + 206 } },
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
    const from = L.gaps ? 0 : 4;
    for (let i = from; i < 5; i += 1) {
      const a = B[i];
      const b = C[i];
      /* У S₀ есть своя цель в форме — она и показывается; у остальных
         зазоров цели нет, их меряем по уже откалиброванному профилю. */
      const raw = i === 4 ? gapRaw : Math.hypot(bowlRaw[i].x - coneRaw[i].x, bowlRaw[i].y - coneRaw[i].y);
      const key = GAP_KEYS[i];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      parts.push(
        <g key={`gap-${i}`} className={cls(key)} {...zone(key)}>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={HIT_WIDTH} pointerEvents="stroke" />
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--color-accent)" strokeWidth={1.8}>
            <title>
              {SLAB[i]} — зазор {NAMES_B[i]}–{NAMES_C[i]}: {fmt(raw)} мм
            </title>
          </line>
          <text x={mid.x} y={mid.y - 6} textAnchor="middle" className={styles.fsMd} fontStyle="italic" fill="var(--color-accent-text)">
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

  /* ── дуги узловых углов β ── */
  if (L.arcs) {
    const drawArcs = (P: Vec2[], chain: ChainResult, keys: ChamberHighlightKey[], names: string[], isCone: boolean) => {
      chain.info.forEach((node, i) => {
        const c = P[i];
        const R = 34;
        const a0 = node.phiRay + 180;
        const a1 = node.phiSeg;
        const d = arcPath(c, R, a0, a1);
        const midAngle = a0 + norm(a1 - a0) / 2;
        const labelPoint = polar(c, R + 18, midAngle);
        const key = keys[i];
        parts.push(
          <g key={`arc-${isCone ? 'c' : 'b'}-${i}`} className={cls(key)} {...zone(key)}>
            <path d={d} fill="none" stroke="transparent" strokeWidth={HIT_WIDTH} pointerEvents="stroke" />
            <path d={d} fill="none" stroke="var(--color-text-muted)" strokeWidth={1}>
              <title>
                β{names[i]} = {fmt(node.beta, 1)}°{isCone ? ` · действующий β−θ = ${fmt(node.eff, 1)}°` : ''}
              </title>
            </path>
            {node.terminal ? (
              <line
                x1={c.x}
                y1={c.y}
                x2={c.x + dir(node.phiSeg).x * 62}
                y2={c.y + dir(node.phiSeg).y * 62}
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
    ([
      ['a40', input.bowl.anchorAngle, '40'],
      ['a10', input.cone.anchorAngle, '10'],
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
    const p2 = C[4];

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
          <title>h = {fmt(heightRaw)} мм</title>
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
          <title>D/2 = {fmt(diameterRaw / 2)} мм</title>
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
        x: apex.x + (level(0.56) - apex.y) * Math.tan((input.theta * Math.PI) / 180) * -1,
        text: 'Ось конуса',
        key: 'theta',
      },
      { y: level(0.8), x: null, text: 'Броня конуса', key: 'cone' },
    ];

    rights.forEach((r) => {
      const x = r.x ?? xAtY(C, r.y) ?? C[3].x;
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

    const bands: { text: string; y1: number; y2: number; key: ChamberHighlightKey }[] = [
      { text: 'Зона входа', y1: B[0].y, y2: B[1].y, key: 'n40' },
      { text: 'Зоны дробления', y1: B[1].y, y2: B[3].y, key: 'n41' },
      { text: 'Зона калибровки', y1: B[3].y, y2: B[4].y, key: 'n4i' },
    ];
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
