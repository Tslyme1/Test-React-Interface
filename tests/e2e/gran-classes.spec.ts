import { test, expect } from '@playwright/test';
import { estimateGran, estimateProdGran } from '../../src/domain/estimates';
import { defaultWizardData } from '../../src/data/wizardDefaults';

/**
 * Шкала классов крупности — на чистых функциях, без интерфейса: здесь
 * проверяется арифметика таблицы, а не то, как она нарисована.
 */
test.describe('Классы крупности: порядок и накопленный выход', () => {
  test('таблица читается сверху вниз: крупный класс первым, 100 % и по уменьшению', () => {
    const rows = estimateGran(defaultWizardData().gran);

    expect(rows.length).toBeGreaterThan(1);
    // Верхняя строка — самый крупный класс, и он же вмещает всё питание.
    expect(rows[0].class).toContain('−300.0');
    expect(rows[0].pass).toBe('100.0');

    const pass = rows.map((r) => Number(r.pass));
    for (let i = 1; i < pass.length; i += 1) {
      expect(pass[i], `строка ${i}: ${pass[i]} не меньше предыдущего ${pass[i - 1]}`).toBeLessThan(pass[i - 1]);
    }
  });

  test('накопленный выход доходит до 100 %, а не упирается в 83,5 %', () => {
    /* Сырая экспонента насыщается медленнее шкалы классов: без нормировки
       верхний класс давал 83,5 %, то есть таблица утверждала, что 16,5 %
       питания крупнее собственного `dMax`. */
    for (const n0 of ['0.3', '0.6', '1.2']) {
      const rows = estimateGran({ ...defaultWizardData().gran, n0 });
      expect(Number(rows[0].pass), `n₀ = ${n0}`).toBeCloseTo(100, 1);
    }
  });

  test('частные классы в сумме дают сто процентов', () => {
    const rows = estimateGran(defaultWizardData().gran);
    const sum = rows.reduce((acc, r) => acc + Number(r.gamma), 0);
    expect(sum).toBeCloseTo(1, 3);
  });

  test('то же правило у грансостава продукта — таблица одна и та же', () => {
    const rows = estimateProdGran(defaultWizardData().prod);

    expect(rows[0].pass).toBe('100.0');
    expect(Number(rows[rows.length - 1].pass)).toBeLessThan(100);
  });
});
