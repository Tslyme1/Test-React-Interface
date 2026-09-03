import { useState } from 'react';
import { Box, Button, Chip, EmptyState, Field, Input, Popover, Stack, Text } from '@uralmash/design-system';
import type { GranData } from '@/types';
import { ORE_SAMPLES } from '@/data/oreSamples';
import { OptionCell } from '@/components/OptionCell/OptionCell';

export type GranStepProps = {
  data: GranData;
  onChange: (patch: Partial<GranData>) => void;
  /** Значения на момент создания проекта — опора для подсказки «было: X». */
  baseline: GranData;
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
export function GranStep({ data, onChange, baseline, ore, onRequestOrePicker }: GranStepProps) {
  // ── режим отображения: только дельта — диаграммы на этом шаге нет ──
  const [displayOpen, setDisplayOpen] = useState(false);
  const [deltaMode, setDeltaMode] = useState<'show' | 'hide'>('show');

  /** Пояснение под полем: было ли отредактировано после создания проекта — и на что. */
  const hintWithDelta = (key: keyof GranData): string | undefined => {
    if (deltaMode !== 'show') return undefined;
    const was = baseline[key];
    return was === data[key] ? undefined : `было: ${was}`;
  };

  return ore ? (
    <Stack gap="xl" direction="column">
      {/* Заголовок и его действия — одной строкой, как на шаге «Геометрия»:
          подпись слева, плашка пробы и режим отображения справа. Отдельная
          подпись «Проба руды» над чипсом убрана — назначение плашки понятно
          и без неё, а строка с чипсом под подписью разводила заголовок
          с действиями по разной высоте. */}
      <Stack direction="row" justify="between" align="center" gap="md" wrap>
        <Text variant="headingMd">Характеристический грансостав</Text>

        <Stack direction="row" align="center" gap="sm">
          <Chip icon="fileText" action={{ icon: 'pencil', label: 'Сменить пробу руды', onClick: onRequestOrePicker }}>
            {ore}
          </Chip>

          <Popover
            open={displayOpen}
            onClose={() => setDisplayOpen(false)}
            placement="bottom-end"
            width="md"
            title="Режим отображения"
            trigger={
              <Button variant="secondary" iconEnd="chevronDown" onClick={() => setDisplayOpen((o) => !o)}>
                Отображение
              </Button>
            }
          >
            <Stack gap="2xs" direction="column">
              <Box paddingX="sm">
                <Text variant="label">Дельта</Text>
              </Box>
              <Stack direction="column" gap="none">
                <OptionCell
                  label="Показывать изменения"
                  description="Отклонение от значений расчёта"
                  checked={deltaMode === 'show'}
                  onSelect={() => setDeltaMode('show')}
                />
                <OptionCell label="Не показывать изменения" checked={deltaMode === 'hide'} onSelect={() => setDeltaMode('hide')} />
              </Stack>
            </Stack>
          </Popover>
        </Stack>
      </Stack>

      <Stack direction="column" gap="md">
        <Field label="Минимальная крупность Dmin, мм" required hint={hintWithDelta('dMin')}>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.dMin} onChange={(e) => onChange({ dMin: e.target.value })} />
          )}
        </Field>

        <Field label="Максимальная крупность Dmax, мм" required hint={hintWithDelta('dMax')}>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.dMax} onChange={(e) => onChange({ dMax: e.target.value })} />
          )}
        </Field>

        <Field label="Параметр Z0" hint={hintWithDelta('z0')}>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.z0} onChange={(e) => onChange({ z0: e.target.value })} />
          )}
        </Field>

        <Field label="Параметр S00" hint={hintWithDelta('s00')}>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.s00} onChange={(e) => onChange({ s00: e.target.value })} />
          )}
        </Field>

        <Field label="Параметр N0" hint={hintWithDelta('n0')}>
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
