import { useState } from 'react';
import { Box, Button, Chip, EmptyState, Field, Input, Popover, SegmentedControl, Stack, Text } from '@uralmash/design-system';
import type { GranData } from '@/types';
import { ORE_SAMPLES } from '@/data/oreSamples';
import { GRAN_GLOSSARY } from '@/data/paramGlossary';
import { FieldHint } from '@/components/FieldHint/FieldHint';
import { OptionCell } from '@/components/OptionCell/OptionCell';
import { SieveAnalysis } from './SieveAnalysis';

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
  /** Тост о результате действия — например, записи a₀/Va₀ в параметры. */
  showToast: (message: string) => void;
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
export function GranStep({ data, onChange, baseline, ore, onRequestOrePicker, showToast }: GranStepProps) {
  // ── режим отображения: только дельта — диаграммы на этом шаге нет ──
  const [displayOpen, setDisplayOpen] = useState(false);
  const [deltaMode, setDeltaMode] = useState<'show' | 'hide'>('show');

  const applySieveToParams = (nextA0: number, nextVa0: number) => {
    onChange({ a0: String(nextA0), va0: String(nextVa0) });
    showToast(`Записано в параметры: a₀ = ${nextA0}, Va₀ = ${nextVa0}`);
  };

  /** Пояснение под полем: было ли отредактировано после создания проекта — и на что. */
  const hintWithDelta = (key: keyof GranData, base?: string): string | undefined => {
    if (deltaMode !== 'show') return base;
    const was = baseline[key];
    if (was === data[key]) return base;
    return base ? `${base} · было: ${was}` : `было: ${was}`;
  };

  return ore ? (
    <Stack gap="2xl" direction="column">
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
        <Field label="Минимальная крупность Dmin, мм" required hint={hintWithDelta('dMin')} labelHint={<FieldHint>{GRAN_GLOSSARY.dMin}</FieldHint>}>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.dMin} onChange={(e) => onChange({ dMin: e.target.value })} />
          )}
        </Field>

        <Field label="Кондиционная крупность Dk, мм" hint={hintWithDelta('dk')} labelHint={<FieldHint>{GRAN_GLOSSARY.dk}</FieldHint>}>
          {(props) => <Input {...props} fullWidth type="number" value={data.dk} onChange={(e) => onChange({ dk: e.target.value })} />}
        </Field>

        <Field label="Максимальная крупность Dmax, мм" required hint={hintWithDelta('dMax')} labelHint={<FieldHint>{GRAN_GLOSSARY.dMax}</FieldHint>}>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.dMax} onChange={(e) => onChange({ dMax: e.target.value })} />
          )}
        </Field>

        <Field label="Параметр Z0" hint={hintWithDelta('z0')} labelHint={<FieldHint>{GRAN_GLOSSARY.z0}</FieldHint>}>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.z0} onChange={(e) => onChange({ z0: e.target.value })} />
          )}
        </Field>

        <Field label="Параметр S00" hint={hintWithDelta('s00')} labelHint={<FieldHint>{GRAN_GLOSSARY.s00}</FieldHint>}>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.s00} onChange={(e) => onChange({ s00: e.target.value })} />
          )}
        </Field>

        <Field label="Параметр N0" hint={hintWithDelta('n0')} labelHint={<FieldHint>{GRAN_GLOSSARY.n0}</FieldHint>}>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.n0} onChange={(e) => onChange({ n0: e.target.value })} />
          )}
        </Field>
      </Stack>

      <Stack gap="lg" direction="column">
        <Stack direction="row" justify="between" align="start" gap="md" wrap>
          <Stack gap="xs" direction="column">
            <Text variant="headingSm">Параметры формы куска</Text>
            <Text variant="bodySm" color="textMuted">
              a₀ и Va₀ задаются напрямую или получаются из ситового анализа пробы питания.
            </Text>
          </Stack>

          {/* Не `Field` — см. пояснение выше по файлу и в GeometryStep: SegmentedControl
              не принимает id, обёртка оставила бы подпись без контрола. */}
          <Stack gap="2xs" direction="column" align="start">
            <Text variant="label">Способ задания a₀ и Va₀</Text>
            <SegmentedControl
              legend="Способ задания a₀ и Va₀"
              options={[
                { value: 'direct', label: 'Прямой ввод' },
                { value: 'sieve', label: 'Ситовый анализ' },
              ]}
              value={data.shapeMode}
              onChange={(v) => onChange({ shapeMode: v })}
            />
          </Stack>
        </Stack>

        {data.shapeMode === 'direct' ? (
          <Stack direction="column" gap="md">
            <Field label="Среднее относительное длины куска a₀" hint={hintWithDelta('a0', 'd̄ / dmax')} labelHint={<FieldHint>{GRAN_GLOSSARY.a0}</FieldHint>}>
              {(props) => (
                <Input {...props} fullWidth type="number" step="0.001" value={data.a0} onChange={(e) => onChange({ a0: e.target.value })} />
              )}
            </Field>

            <Field label="Коэффициент вариации длины Va₀" hint={hintWithDelta('va0', 'σ / d̄')} labelHint={<FieldHint>{GRAN_GLOSSARY.va0}</FieldHint>}>
              {(props) => (
                <Input
                  {...props}
                  fullWidth
                  type="number"
                  step="0.001"
                  value={data.va0}
                  onChange={(e) => onChange({ va0: e.target.value })}
                />
              )}
            </Field>
          </Stack>
        ) : (
          <SieveAnalysis
            rows={data.sieveRows}
            onRowsChange={(rows) => onChange({ sieveRows: rows })}
            mode={data.sieveMode}
            onModeChange={(sieveMode, sieveRows) => onChange({ sieveMode, sieveRows })}
            onApply={applySieveToParams}
          />
        )}
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
