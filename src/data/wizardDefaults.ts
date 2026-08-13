import type { WizardData } from '@/types';

export function defaultWizardData(): WizardData {
  return {
    geom: {
      D: '1750',
      H: '1200',
      l2: '180',
      S0: '32',
      theta: '2.5',
      beta10: '18',
      beta40: '22',
      angleUnit: 'deg',
    },
    gran: {
      dMin: '0',
      dMax: '300',
      z0: '1.2',
      s00: '0.85',
      n0: '0.6',
    },
    prod: {
      feedType: 'dry',
      dMin: '0',
      dMax: '35',
      wk: '12',
      wm: '14',
      kpd: '0.82',
      a0: '',
      va0: '',
      shapeMode: 'direct',
      sieveRows: [],
    },
  };
}
