import { useState } from 'react';
import { Button, Modal, Stack, Stepper, Text } from '@uralmash/design-system';
import type { ProjectMode } from '@/types';

type GuideStep = { label: string; title: string; text: string };

const ENGINEERING_STEPS: GuideStep[] = [
  {
    label: 'Дробилка',
    title: 'Геометрия камеры дробления',
    text: 'Выберите дробилку из каталога — её геометрия подставится значениями по умолчанию, которые можно поправить. Нажмите «Выполнить расчёт», чтобы получить параметры камеры и её профиль.',
  },
  {
    label: 'Руда',
    title: 'Характеристический грансостав',
    text: 'Выберите пробу руды. Задайте её грансостав напрямую или через ситовый анализ, затем рассчитайте шаг.',
  },
  {
    label: 'Продукт',
    title: 'Продукт дробления и усилия',
    text: 'Укажите тип питания и параметры продукта — минимальную и максимальную крупность, работу разрушения. «Выполнить расчёт» даёт итоговый отчёт по продукту.',
  },
  {
    label: 'Результат',
    title: 'Отчёт по каждому шагу',
    text: 'На любом посчитанном шаге кнопка «Смотреть результат» открывает отчёт: таблицы величин, экспорт в Excel и печать, а для геометрии — ещё и экспорт в Компас 3D.',
  },
];

const SIMPLIFIED_STEPS: GuideStep[] = [
  {
    label: 'Дробилка',
    title: 'Одна или несколько дробилок',
    text: 'В упрощённом режиме можно выбрать сразу несколько дробилок из каталога — расчёт пройдёт по каждой из них.',
  },
  {
    label: 'Руда',
    title: 'Одна или несколько проб',
    text: 'Так же выберите одну или несколько проб руды — без ручного ввода грансостава, он берётся из каталога.',
  },
  {
    label: 'Продукт',
    title: 'Минимум параметров',
    text: 'Здесь нужно указать только тип питания и максимальную крупность продукта — остальное посчитается по значениям из каталога.',
  },
  {
    label: 'Результат',
    title: 'Отчёт по каждой комбинации',
    text: 'Расчёт проходит сразу по всем парам «дробилка × проба руды» — переключайтесь между комбинациями прямо в отчёте.',
  },
];

export type HowToModalProps = {
  open: boolean;
  onClose: () => void;
  mode: ProjectMode;
};

/**
 * Пошаговая справка «Как пользоваться программой» — отдельно от `HelpModal`
 * (тот объясняет смысл конкретных параметров расчёта, этот — сам порядок
 * действий по шагам визарда). Содержание зависит от режима: инженерный
 * и упрощённый идут по одним и тем же трём этапам, но по-разному — форма
 * против выбора из каталога.
 *
 * Степпер здесь не ведёт настоящий расчёт — `onStepClick` переключает
 * только сам рассказ, поэтому шаги не помечены `completed`/`disabled`.
 */
export function HowToModal({ open, onClose, mode }: HowToModalProps) {
  const [step, setStep] = useState(0);
  const guide = mode === 'simplified' ? SIMPLIFIED_STEPS : ENGINEERING_STEPS;
  const current = guide[step];
  const isLast = step === guide.length - 1;

  const handleClose = () => {
    onClose();
    setStep(0);
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Как пользоваться программой"
      size="sm"
      footer={
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
            Назад
          </Button>
          {isLast ? (
            <Button variant="primary" onClick={handleClose}>
              Готово
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setStep((s) => s + 1)}>
              Далее
            </Button>
          )}
        </Modal.Footer>
      }
    >
      <Stack gap="xl" direction="column">
        <Stepper steps={guide.map(({ label }) => ({ label }))} current={step} onStepClick={setStep} />
        <Stack gap="sm" direction="column">
          <Text variant="headingSm">{current.title}</Text>
          <Text variant="bodySm" color="textMuted">
            {current.text}
          </Text>
        </Stack>
      </Stack>
    </Modal>
  );
}
