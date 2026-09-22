import { useState } from 'react';
import { Button, Cell, EmptyState, Field, Icon, Input, Modal, Select, Stack, Text } from '@uralmash/design-system';
import { CatalogPicker } from '@/components/CatalogPicker/CatalogPicker';
import { CRUSHER_SPECS, crusherFamily } from '@/data/crushers';
import { useUserCatalog } from '@/state/userCatalog';
import { CatalogCreateButton } from '@/components/CatalogCreateButton/CatalogCreateButton';
import { CUSTOMER_OPTIONS } from '@/data/reference';
import { NEW_DESIGN_LABEL } from '@/domain/projectLabels';
import styles from './NewProjectModal.module.css';

/**
 * С чего начинается расчёт.
 *
 * `catalog` — считаем существующую машину: её выбирают в каталоге,
 * а геометрия камеры подставляется из её паспорта и дальше правится.
 * `blank` — проектируем новую: каталога нет вовсе, камера задаётся
 * с нуля значениями методики по умолчанию.
 *
 * Вопрос задаётся первым, до каталога: это развилка, а не фильтр —
 * в одной ветке машину выбирают, в другой её ещё не существует, и
 * каталог в ней предлагал бы выбрать то, чего в расчёте не будет.
 */
export type ProjectStart = 'catalog' | 'blank';

export type NewProjectModalProps = {
  open: boolean;
  onClose: () => void;
  defaultExecutor: string;
  onCreate: (input: {
    name: string;
    customer: string;
    /** Пусто у `blank`: машины из каталога в этом проекте нет. */
    crusherName: string;
    executor: string;
    start: ProjectStart;
  }) => void;
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
 * Новый инженерный проект начинается с вопроса, с чего его считают:
 * с готовой машины из каталога или с чистого листа.
 *
 * Раньше окно открывалось сразу каталогом, и второй случай выразить
 * было нечем — приходилось выбрать какую-нибудь машину и стереть её
 * данные руками, то есть соврать в поле «Дробилка» ради того, чтобы
 * дойти до формы геометрии. Развилка спрашивается до каталога, потому
 * что от неё зависит, существует ли каталог в этом проекте вообще.
 *
 * Ветка каталога — прежнее окно без изменений: машина — единственное,
 * без чего расчёта существующей дробилки не бывает, и выбирают её
 * сравнением характеристик по столбцам, то есть таблицей во весь размер
 * окна. Название и заказчик стоят в футере справа, вплотную
 * к «Продолжить»: это последний шаг перед созданием проекта.
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
  /**
   * Выбранная ветка. `null` — вопрос ещё не задан, и окно показывает
   * именно его: до ответа неизвестно даже, нужен ли здесь каталог.
   */
  const [start, setStart] = useState<ProjectStart | null>(null);
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

  /* В ветке «с нуля» машины нет и быть не может — требовать её значило бы
     не выпустить из окна вовсе. */
  const canCreate = Boolean(name.trim() && customer && (start === 'blank' || crusherName));

  const reset = () => {
    setStart(null);
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

  /**
   * Ответ на развилку. «Новая разработка» подсказывает название проекта
   * так же, как выбранная машина в другой ветке: пустое поле там, где
   * ответ очевиден, — лишняя работа, а не свобода.
   */
  const chooseStart = (next: ProjectStart) => {
    setStart(next);
    if (next === 'blank' && (!name.trim() || name === suggested)) {
      setName(NEW_DESIGN_LABEL);
      setSuggested(NEW_DESIGN_LABEL);
    }
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
    if (!canCreate || !customer || start === null) return;
    onCreate({
      name: name.trim(),
      customer,
      crusherName: start === 'blank' ? '' : (crusherName ?? ''),
      executor: defaultExecutor,
      start,
    });
    reset();
  };

  const visibleCrushers = family
    ? crusherCatalog.items.filter((c) => crusherFamily(c.name) === family).map((c) => c.name)
    : undefined;

  /* Возврат к развилке. Введённое по пути не стирается: передумать
     насчёт ветки — не то же самое, что начать заново. */
  const backToStart = (
    <Button variant="secondary" iconStart="arrowLeft" onClick={() => setStart(null)}>
      Назад
    </Button>
  );

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

  /* У развилки футера нет: её строки сами и есть действия, а пустая полоса
     с одной «Отменой» под ними обещала бы, что решение надо ещё подтвердить. */
  const footer =
    start === null ? undefined : start === 'catalog' ? (
      /* Поля стоят справа, вплотную к главному действию: заполнение имени
         и заказчика — последний шаг перед «Продолжить», и разносить их
         по разным краям футера значило бы вести взгляд через всю ширину
         окна и обратно.

         «Отмена» убрана: окно закрывается крестиком в шапке, кликом по фону
         и клавишей Esc. Четвёртый способ уйти ничего не добавлял, но занимал
         место рядом с действием, ради которого окно открывали. */
      <Modal.Footer
        /* Слева внизу — возврат к развилке и заведение своей машины: оба
           второстепенны рядом с «Продолжить», и в полосе над таблицей
           отнимали бы ширину у поиска и условий отбора. */
        aside={
          <Stack direction="row" gap="sm" align="center">
            {backToStart}
            <CatalogCreateButton kind="crushers" nameLabel="Дробилка" onCreated={(name) => pickCrusher(name)} />
          </Stack>
        }
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
    ) : (
      /* В ветке «с нуля» поля стоят в теле окна, а не в футере: тело там
         не занято каталогом, и прятать два поля в полосу под пустым
         экраном значило бы оставить окно выглядеть незаполненным. */
      <Modal.Footer aside={backToStart}>{submitButton}</Modal.Footer>
    );

  const body =
    start === null ? (
      <Stack direction="column" gap="lg">
        <Text variant="body">С чего начинается расчёт?</Text>

        {/* Строки списка, а не две кнопки в ряд: у каждой ветки есть
            пояснение, и в подпись кнопки оно не помещается. Шеврон
            справа — обещание перехода: ответ ведёт дальше по окну,
            а не переключает что-то на месте.

            Пояснение — в одну строку: `Cell` обрезает описание по ширине,
            и длинная фраза теряла бы хвост многоточием ровно там, где
            начиналось самое важное. Подробности каждой ветки стоят
            на её собственном экране — каталог показывает себя сам,
            а ветка «с нуля» объясняется на следующем шаге. */}
        <Stack direction="column" gap="none">
          <Cell
            size="lg"
            leading={<Icon name="folder" size="sm" />}
            trailing={<Icon name="chevronRight" size="sm" />}
            description="Машина из справочника, дальше — правка её параметров"
            onClick={() => chooseStart('catalog')}
          >
            Расчёт дробилки из каталога
          </Cell>
          <Cell
            size="lg"
            leading={<Icon name="pencil" size="sm" />}
            trailing={<Icon name="chevronRight" size="sm" />}
            description="Каталога нет: камера дробления задаётся с нуля"
            onClick={() => chooseStart('blank')}
          >
            Новое проектирование
          </Cell>
        </Stack>
      </Stack>
    ) : start === 'blank' ? (
      <Stack direction="column" gap="xl">
        <EmptyState
          icon="pencil"
          title="Камера дробления задаётся с нуля"
          description="Дробилки из каталога в этом проекте нет. Сразу после создания откроется окно геометрии камеры: диаметр основания D, высота H от подвеса, разгрузочная щель S₀, углы броней по зонам. Пока они не поправлены, в расчёт идут значения методики по умолчанию."
        />
        <div className={styles.startFields}>
          {nameField}
          {customerField}
        </div>
      </Stack>
    ) : (
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
    /* Одно окно на все три экрана, а не три окна подряд: смена ветки —
       это шаг внутри «Нового проекта», и переоткрывать окно на каждом
       шаге значило бы каждый раз проигрывать появление заново.
       Широкое — только там, где в нём стоит каталог из тридцати машин. */
    <Modal open={open} onClose={close} title="Новый проект" size={start === 'catalog' ? 'lg' : 'sm'} footer={footer}>
      {body}
    </Modal>
  );
}
