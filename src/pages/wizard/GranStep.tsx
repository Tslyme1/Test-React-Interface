import { Button, Chip, EmptyState, Field, Input, Stack, Text } from '@uralmash/design-system';
import type { GranData } from '@/types';
import { ORE_SAMPLES } from '@/data/oreSamples';

export type GranStepProps = {
  data: GranData;
  onChange: (patch: Partial<GranData>) => void;
  /** Месторождение выбранной пробы. Пусто — шаг закрыт заглушкой. */
  ore: string;
  /**
   * Открыть выбор пробы. Сама модалка живёт в `WizardPage`: переход на этот
   * шаг без выбранной пробы должен открыть её поверх шага «Дробилка», не
   * переключая степпер сюда, — значит, окно обязано существовать независимо
   * от того, смонтирован ли этот компонент вообще.
   */
  onRequestOrePicker: () => void;
};

/**
 * Шаг закрыт, пока не выбрана проба руды.
 *
 * Так же в прототипе: данные пробы не подтягиваются автоматически, и пускать
 * в форму до выбора — предлагать заполнять параметры распределения питания
 * неизвестно какой руды. На практике сюда почти всегда приходят уже с пробой —
 * `WizardPage` перехватывает переход без неё раньше; ветка ниже — подстраховка
 * на случай, если проба всё же оказалась пустой.
 */
export function GranStep({ data, onChange, ore, onRequestOrePicker }: GranStepProps) {
  return ore ? (
    <Stack gap="xl" direction="column">
      <Stack gap="xs" direction="column">
        <Text variant="headingMd">Характеристический грансостав</Text>
        <Text variant="bodySm" color="textMuted">
          Границы крупности питания и параметры характеристики распределения.
        </Text>
      </Stack>

      {/* Плашка выбранной пробы: на этом шаге все числа относятся именно
          к ней, и без неё непонятно, для какой руды заполняется форма. */}
      <Stack gap="2xs" direction="column" align="start">
        <Text variant="label">Проба руды</Text>
        <Chip
          icon="folder"
          active
          onClick={onRequestOrePicker}
          action={{ icon: 'pencil', label: 'Сменить пробу руды', onClick: onRequestOrePicker }}
        >
          {ore}
        </Chip>
      </Stack>

      <Stack direction="column" gap="md">
        <Field label="Минимальная крупность Dmin, мм" required>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.dMin} onChange={(e) => onChange({ dMin: e.target.value })} />
          )}
        </Field>

        <Field label="Максимальная крупность Dmax, мм" required>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.dMax} onChange={(e) => onChange({ dMax: e.target.value })} />
          )}
        </Field>

        <Field label="Параметр Z0">
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.z0} onChange={(e) => onChange({ z0: e.target.value })} />
          )}
        </Field>

        <Field label="Параметр S00">
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.s00} onChange={(e) => onChange({ s00: e.target.value })} />
          )}
        </Field>

        <Field label="Параметр N0">
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.n0} onChange={(e) => onChange({ n0: e.target.value })} />
          )}
        </Field>
      </Stack>
    </Stack>
  ) : (
    <EmptyState
      icon="folder"
      title="Выберите пробу руды"
      description="Данные не подтягиваются автоматически — выберите пробу, чтобы продолжить расчёт."
      action={
        <Button variant="primary" iconStart="search" onClick={onRequestOrePicker}>
          Выбрать пробу руды — {ORE_SAMPLES.length} проб
        </Button>
      }
    />
  );
}
