import { useState } from 'react';
import { Button, Field, Input, Modal, Select } from '@uralmash/design-system';
import { CatalogPicker } from '@/components/CatalogPicker/CatalogPicker';
import { CRUSHER_SPECS, crusherFamily } from '@/data/crushers';
import { useUserCatalog } from '@/state/userCatalog';
import { CatalogCreateButton } from '@/components/CatalogCreateButton/CatalogCreateButton';
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
 * Новый инженерный проект начинается с выбора дробилки.
 *
 * Не с формы и не с вопроса «из каталога или с нуля»: машина —
 * единственное, без чего расчёта не существует, и выбирают её
 * сравнением характеристик по столбцам, то есть таблицей во весь размер
 * окна. Своя, ещё не существующая машина заводится там же, кнопкой
 * «Новая» под таблицей, — отдельная развилка перед каталогом спрашивала
 * бы то, на что в самом каталоге уже есть ответ. Название и заказчик
 * стоят в футере справа, вплотную к «Продолжить»: это последний шаг
 * перед созданием проекта.
 *
 * Пробы руды здесь нет намеренно: она нужна только на шаге «Грансостав»,
 * там же и выбирается. Спрашивать её на входе — задерживать создание
 * проекта ради данных, которые понадобятся через два шага.
 *
 * Упрощённый режим создаётся отдельным окном (`SimplifiedProjectModal`) —
 * там выбор нескольких дробилок и вся остальная работа идут одним
 * непрерывным окном без переходов, а не формой с одной машиной здесь.
 */
export function NewProjectModal({ open, onClose, defaultExecutor, onCreate }: NewProjectModalProps) {
  /* Справочник с правками пользователя — один на приложение: заведённая
     своя машина обязана быть доступна и при создании проекта. */
  const crusherCatalog = useUserCatalog('crushers');
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
    ? crusherCatalog.items.filter((c) => crusherFamily(c.name) === family).map((c) => c.name)
    : undefined;

  const nameField = (
    <Field label="Название проекта" variant="floating" required>
      {(props) => <Input {...props} fullWidth value={name} onChange={(e) => setName(e.target.value)} />}
    </Field>
  );

  const customerField = (
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
  );

  const submitButton = (
    <Button variant="primary" disabled={!canCreate} onClick={submit}>
      Продолжить
    </Button>
  );

  const footer = (
    /* Поля стоят справа, вплотную к главному действию: заполнение имени
       и заказчика — последний шаг перед «Продолжить», и разносить их
       по разным краям футера значило бы вести взгляд через всю ширину
       окна и обратно.

       «Отмена» убрана: окно закрывается крестиком в шапке, кликом по фону
       и клавишей Esc. Четвёртый способ уйти ничего не добавлял, но занимал
       место рядом с действием, ради которого окно открывали. */
    <Modal.Footer
      /* Слева внизу — заведение своей машины: это второстепенное действие
         рядом с главным «Продолжить», и в полосе над таблицей оно отнимало
         бы ширину у поиска и условий отбора. Оно же закрывает случай
         «такой машины ещё нет»: заведённая позиция сразу выбрана. */
      aside={<CatalogCreateButton kind="crushers" nameLabel="Дробилка" onCreated={(name) => pickCrusher(name)} />}
    >
      <div className={styles.footerFields}>
        {/* Плавающая подпись: она лежит в поле и уходит наверх при
            вводе — ровно как в прототипе, где подписи в футере
            не занимают отдельной строки над полями. */}
        <div className={styles.footerField}>{nameField}</div>
        <div className={styles.footerField}>{customerField}</div>
      </div>

      {submitButton}
    </Modal.Footer>
  );

  const body = (
      <CatalogPicker
        specs={CRUSHER_SPECS}
        items={crusherCatalog.items}
        value={crusherName}
        onPick={pickCrusher}
        nameLabel="Дробилка"
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
          /* Размер не задан — тот же, что у поля поиска рядом (`md`
             по умолчанию): вся полоса условий одной высоты. */
          <Select
            fullWidth
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
  );

  return (
    <Modal open={open} onClose={close} title="Новый проект" size="lg" footer={footer}>
      {body}
    </Modal>
  );
}
