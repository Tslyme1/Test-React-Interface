import type { GeomData, GranData, ProdData } from '@/types';

/**
 * Иллюстративные оценки для экрана результатов. В прототипе-источнике
 * реальных формул дробления тоже не было (комментарий в коде: «dummy
 * formulas so each screen feels calculated») — здесь та же честная
 * договорённость сохранена и явно показана в интерфейсе.
 */

const toNum = (v: string): number => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

export function estimateGeom(data: GeomData) {
  const D = toNum(data.D);
  const H = toNum(data.H);
  const l2 = toNum(data.l2);
  const S0 = toNum(data.S0);
  const theta = toNum(data.theta);
  const beta10 = toNum(data.beta10);

  return [
    { label: 'D/2', value: (D / 2).toFixed(1), unit: 'мм' },
    { label: 'h', value: Math.max(H - l2, 0).toFixed(1), unit: 'мм' },
    { label: 'S', value: S0.toFixed(1), unit: 'мм' },
    { label: 'α2', value: Math.max(180 - beta10 - theta, 0).toFixed(1), unit: data.angleUnit },
  ];
}

export function estimateGran(data: GranData) {
  const dMin = toNum(data.dMin);
  const dMax = toNum(data.dMax);
  const k = Math.max(toNum(data.n0), 0.1);
  const span = Math.max(dMax - dMin, 1);

  const buckets = [0.2, 0.4, 0.6, 0.8, 1];
  return buckets.map((frac) => {
    const d = dMin + span * frac;
    const pass = 100 * (1 - Math.exp(-k * frac * 3));
    return { class: `−${d.toFixed(0)}`, pass: Math.min(pass, 100).toFixed(1) };
  });
}

export function estimateProd(data: ProdData, geom: GeomData) {
  const D = toNum(geom.D);
  const S0 = toNum(geom.S0);
  const kpd = toNum(data.kpd) || 0.8;
  const capacity = (D * S0 * kpd) / 1000;

  return [
    { label: 'Производительность Q', value: capacity.toFixed(1), unit: 'т/ч' },
    { label: 'Максимальная крупность продукта', value: data.dMax, unit: 'мм' },
    { label: 'КПД дробления', value: (kpd * 100).toFixed(0), unit: '%' },
  ];
}
