import { test, expect } from '@playwright/test';
import { SAMPLE_PROJECT, seedSession } from './helpers';

/**
 * Что выбранная в каталоге машина приносит в расчёт.
 *
 * «D, мм» справочника и D методики — одна и та же величина, и не
 * подставить её значило бы заставить перепечатать в форму число,
 * которое только что выбрали в таблице. Разгрузочная щель оттуда
 * НЕ берётся: в каталоге это диапазон регулировки («15-25»), а не
 * установленное значение (см. `domain/crusherGeom.ts`).
 */
test.describe('Новый проект: что приходит из каталога', () => {
  test('диаметр основания подставляется из паспорта, щель остаётся по методике', async ({ page }) => {
    await seedSession(page, { empty: true });
    await page.getByRole('button', { name: 'Новый проект' }).first().click();

    const dialog = page.getByRole('dialog', { name: 'Новый проект' });
    // КМД-3000Т2 — диаметр конуса 3000 мм, а не 2200 по умолчанию.
    await dialog.getByRole('button', { name: 'КМД-3000Т2', exact: true }).click();
    await dialog.getByRole('button', { name: /Заказчик/ }).click();
    await page.getByRole('option', { name: SAMPLE_PROJECT.customer }).click();
    await dialog.getByRole('button', { name: 'Продолжить' }).click();

    const editor = page.getByRole('dialog', { name: /Исходные данные/ });
    await expect(editor).toBeVisible();
    await expect(editor.getByLabel('Диаметр основания D')).toHaveValue('3000');

    /* Щель — число контрольного примера §7, на котором стоит проверка
       расчёта профиля. Подмена её границей диапазона из паспорта
       поменяла бы исходные данные примера молча. */
    await expect(editor.getByLabel('Ширина разгрузочной щели S0')).toHaveValue('43');
  });
});
