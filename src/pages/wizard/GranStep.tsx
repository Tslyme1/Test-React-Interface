import { useState } from 'react';
import { Button, Chip, EmptyState, Field, Input, Modal, Stack, Text } from '@uralmash/design-system';
import type { GranData } from '@/types';
import { CatalogPicker } from '@/components/CatalogPicker/CatalogPicker';
import { ORE_SAMPLES, ORE_SPECS } from '@/data/oreSamples';

export type GranStepProps = {
  data: GranData;
  onChange: (patch: Partial<GranData>) => void;
  /** Месторождение выбранной пробы. Пусто — шаг закрыт заглушкой. */
  ore: string;
  onPickOre: (ore: string) => void;
};

/**
 * Шаг закрыт, пока не выбрана проба руды.
 *
 * Так же в прототипе: данные пробы не подтягиваются автоматически, и пускать
 * в форму до выбора — предлагать заполнять параметры распределения питания
 * неизвестно какой руды.
 */
export function GranStep({ data, onChange, ore, onPickOre }: GranStepProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      {ore ? (
        <Stack gap="xl" direction="column">
          <Stack gap="xs" direction="column">
            <Text variant="headingSm">Характеристический грансостав</Text>
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
              onClick={() => setPickerOpen(true)}
              action={{ icon: 'pencil', label: 'Сменить пробу руды', onClick: () => setPickerOpen(true) }}
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
            <Button variant="primary" iconStart="search" onClick={() => setPickerOpen(true)}>
              Выбрать пробу руды — {ORE_SAMPLES.length} проб
            </Button>
          }
        />
      )}

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Выбор пробы руды"
        size="lg"
        footer={
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setPickerOpen(false)}>
              Отмена
            </Button>
          </Modal.Footer>
        }
      >
        <CatalogPicker
          specs={ORE_SPECS}
          items={ORE_SAMPLES}
          value={ore || null}
          onPick={(picked) => {
            /* Снятие выбора здесь ничего не даёт: шаг без пробы закрыт
               заглушкой, и уйти из окна ни с чем можно крестиком. */
            if (!picked) return;
            onPickOre(picked);
            setPickerOpen(false);
          }}
          nameLabel="Проба руды"
          searchPlaceholder="Костомукшская, X, 14-16…"
        />
      </Modal>
    </>
  );
}
