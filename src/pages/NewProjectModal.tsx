import { useState } from 'react';
import { Button, Field, Input, Modal, Select } from '@uralmash/design-system';
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

/**
 * Семейство машины. `null` — отбора нет.
 *
 * Не подставной вариант «Все» первой строкой списка: он выглядел бы
 * выбранным с самого начала, и «не отобрано» читалось бы как «отобрано
 * вот это». Пустое состояние поля выражает плейсхолдер.
 */
type Family = 'КМД' | 'КСД' | null;

const FAMILY_OPTIONS = [
  { value: 'КМД', label: 'КМД' },
  { value: 'КСД', label: 'КСД' },
];

/**
 * Новый проект начинается с выбора дробилки.
 *
 * Не с формы: машина — единственное, без чего расчёта не существует,
 * и выбирают её сравнением характеристик по столбцам, то есть таблицей
 * во весь размер окна. Название и заказчик стоят в футере справа, вплотную
 * к «Продолжить»: это последний шаг перед созданием проекта.
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
  /**
   * Применённое семейство и черновик из окна фильтров.
   *
   * Черновик нужен, потому что окно фильтров применяет условия по «Готово»:
   * пока оно открыто, таблица под ним не должна пересобираться на каждое
   * нажатие. Закрытие мимо «Готово» возвращает черновик к применённому.
   */
  const [family, setFamily] = useState<Family>(null);
  const [familyDraft, setFamilyDraft] = useState<Family>(null);

  const canCreate = Boolean(crusherName && name.trim() && customer);

  const reset = () => {
    setCrusherName(null);
    setName('');
    setSuggested('');
    setCustomer(null);
    setFamily(null);
    setFamilyDraft(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const pickCrusher = (picked: string | null) => {
    setCrusherName(picked);

    /* Отжали машину — подставленное по ней название уходит вместе с ней,
       но только если его не переписали руками. */
    if (!picked) {
      if (name === suggested) {
        setName('');
        setSuggested('');
      }
      return;
    }

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

  const visibleCrushers = family
    ? CRUSHERS.filter((c) => crusherFamily(c.name) === family).map((c) => c.name)
    : undefined;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Новый проект"
      size="lg"
      footer={
        /* Поля стоят справа, вплотную к главному действию: заполнение имени
           и заказчика — последний шаг перед «Продолжить», и разносить их
           по разным краям футера значило бы вести взгляд через всю ширину
           окна и обратно. `aside` не используется намеренно — он прижимает
           содержимое к левому краю, а слева здесь ничего быть не должно.

           «Отмена» убрана: окно закрывается крестиком в шапке, кликом по фону
           и клавишей Esc. Четвёртый способ уйти ничего не добавлял, но занимал
           место рядом с действием, ради которого окно открывали. */
        <Modal.Footer>
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
        onFiltersApply={() => setFamily(familyDraft)}
        onFiltersCancel={() => setFamilyDraft(family)}
        onFiltersReset={() => setFamilyDraft(null)}
        /* Отбор по характеристикам каталог ведёт сам — он же знает колонки.
           Отсюда приходит только семейство: «КМД или КСД» из имени машины,
           а не из значения характеристики, и вывести его из таблицы нельзя. */
        filterCount={family ? 1 : 0}
        filterDraftCount={familyDraft ? 1 : 0}
        /* Три условия вынесены в полосу поиска и применяются сразу: семейство
           машины и две величины, по которым подбор и начинается, — диаметр
           конуса и производительность. Остальные шесть характеристик остаются
           под кнопкой «Фильтры»: в полосу они не помещаются, а вынести часть
           и молчать про остальные хуже, чем показать, где лежит целое. */
        inlineFilter={
          <Select
            size="sm"
            options={FAMILY_OPTIONS}
            placeholder="Семейство"
            aria-label="Семейство машины"
            value={family}
            onChange={(next) => {
              const picked = (next as Family) ?? null;
              setFamily(picked);
              /* Черновик окна идёт следом: открытое после этого окно
                 обязано показывать то, что уже применено. */
              setFamilyDraft(picked);
            }}
          />
        }
        inlineSpecs={['D, мм', 'Q, т/ч']}
        filter={
          /* Тем же полем, что и в полосе над таблицей: в окне фильтров
             стоят рядом семейство и девять характеристик, и переключатель
             посреди списка полей читался бы как контрол другой природы.
             Подписи над ним нет — назначение написано в самом поле. */
          <Select
            fullWidth
            size="sm"
            options={FAMILY_OPTIONS}
            placeholder="Семейство"
            aria-label="Семейство машины"
            value={familyDraft}
            onChange={(next) => setFamilyDraft((next as Family) ?? null)}
          />
        }
      />
    </Modal>
  );
}
