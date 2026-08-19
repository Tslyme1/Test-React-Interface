import { useState } from 'react';
import { Button, Field, Input, Modal, SegmentedControl, Select } from '@uralmash/design-system';
import { CatalogPicker } from '@/components/CatalogPicker/CatalogPicker';
import { CRUSHERS, CRUSHER_SPECS, crusherFamily } from '@/data/crushers';
import { CUSTOMER_OPTIONS } from '@/data/reference';
import styles from './NewProjectModal.module.css';

export type NewProjectModalProps = {
  open: boolean;
  onClose: () => void;
  defaultExecutor: string;
  onCreate: (input: { name: string; customer: string; crusherName: string; executor: string }) => void;
};

type Family = 'all' | 'КМД' | 'КСД';

/**
 * Новый проект начинается с выбора дробилки.
 *
 * Не с формы: машина — единственное, без чего расчёта не существует,
 * и выбирают её сравнением характеристик по столбцам, то есть таблицей
 * во весь размер окна. Название и заказчик дописываются внизу, рядом
 * с «Продолжить», — так это устроено и в прототипе.
 *
 * Пробы руды здесь нет намеренно: она нужна только на шаге «Грансостав»,
 * там же и выбирается. Спрашивать её на входе — задерживать создание
 * проекта ради данных, которые понадобятся через два шага.
 */
export function NewProjectModal({ open, onClose, defaultExecutor, onCreate }: NewProjectModalProps) {
  const [crusherName, setCrusherName] = useState<string | null>(null);
  const [name, setName] = useState('');
  /**
   * Название, которое подставили мы. Пока пользователь не переписал его сам,
   * смена дробилки обновляет подсказку; после ручной правки — уже нет,
   * иначе выбор другой машины затирал бы введённое имя.
   */
  const [suggested, setSuggested] = useState('');
  const [customer, setCustomer] = useState<string | null>(null);
  const [family, setFamily] = useState<Family>('all');

  const canCreate = Boolean(crusherName && name.trim() && customer);

  const reset = () => {
    setCrusherName(null);
    setName('');
    setSuggested('');
    setCustomer(null);
    setFamily('all');
  };

  const close = () => {
    reset();
    onClose();
  };

  const pickCrusher = (picked: string) => {
    setCrusherName(picked);
    if (!name.trim() || name === suggested) {
      setName(picked);
      setSuggested(picked);
    }
  };

  const submit = () => {
    if (!canCreate || !crusherName || !customer) return;
    onCreate({ name: name.trim(), customer, crusherName, executor: defaultExecutor });
    reset();
  };

  const visibleCrushers =
    family === 'all' ? undefined : CRUSHERS.filter((c) => crusherFamily(c.name) === family).map((c) => c.name);

  return (
    <Modal
      open={open}
      onClose={close}
      title="Новый проект"
      size="lg"
      footer={
        <Modal.Footer
          aside={
            <div className={styles.footerFields}>
              <div className={styles.footerField}>
                {/* Плавающая подпись: она лежит в поле и уходит наверх при
                    вводе — ровно как в прототипе, где подписи в футере
                    не занимают отдельной строки над полями. */}
                <Field label="Название проекта" variant="floating" required>
                  {(props) => <Input {...props} fullWidth value={name} onChange={(e) => setName(e.target.value)} />}
                </Field>
              </div>
              <div className={styles.footerField}>
                <Field label="Заказчик" variant="floating" required>
                  {(props) => (
                    <Select
                      {...props}
                      fullWidth
                      options={CUSTOMER_OPTIONS}
                      value={customer}
                      onChange={(v) => setCustomer(v as string)}
                      allowCustom
                    />
                  )}
                </Field>
              </div>
            </div>
          }
        >
          <Button variant="secondary" onClick={close}>
            Отмена
          </Button>
          <Button variant="primary" disabled={!canCreate} onClick={submit}>
            Продолжить
          </Button>
        </Modal.Footer>
      }
    >
      <CatalogPicker
        specs={CRUSHER_SPECS}
        items={CRUSHERS}
        value={crusherName}
        onPick={pickCrusher}
        nameLabel="Дробилка"
        searchPlaceholder="КМД-2200, 2200, 500-655…"
        visibleNames={visibleCrushers}
        filter={
          /* Подписи над переключателем нет: он стоит в панели фильтров, где
             назначение читается из самих вариантов, а `legend` остаётся
             доступным именем для скринридера. В `Field` не заворачивается —
             у SegmentedControl свой fieldset, и id он не принимает. */
          <SegmentedControl
            legend="Семейство машины"
            options={[
              { value: 'all', label: 'Все' },
              { value: 'КМД', label: 'КМД' },
              { value: 'КСД', label: 'КСД' },
            ]}
            value={family}
            onChange={setFamily}
          />
        }
      />
    </Modal>
  );
}
