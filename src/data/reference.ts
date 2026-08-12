import type { SelectOption } from '@uralmash/design-system';

/** Подмножество каталога дробилок КМД/КСД — для выбора в новом проекте. */
export const CRUSHER_OPTIONS: SelectOption[] = [
  { value: 'КСД-1750Т', label: 'КСД-1750Т', group: 'КСД' },
  { value: 'КСД-2200Т', label: 'КСД-2200Т', group: 'КСД' },
  { value: 'КСД-2200Гр', label: 'КСД-2200Гр', group: 'КСД' },
  { value: 'КМД-1750Т', label: 'КМД-1750Т', group: 'КМД' },
  { value: 'КМД-2200Т', label: 'КМД-2200Т', group: 'КМД' },
  { value: 'КМД-2200Гр', label: 'КМД-2200Гр', group: 'КМД' },
];

export const ORE_OPTIONS: SelectOption[] = [
  { value: 'Магнетитовая руда', label: 'Магнетитовая руда' },
  { value: 'Медно-никелевая руда', label: 'Медно-никелевая руда' },
  { value: 'Известняк', label: 'Известняк' },
  { value: 'Гранит', label: 'Гранит' },
];

export const CUSTOMER_OPTIONS: SelectOption[] = [
  { value: 'ЕВРАЗ КГОК', label: 'ЕВРАЗ КГОК' },
  { value: 'Михайловский ГОК', label: 'Михайловский ГОК' },
  { value: 'Лебединский ГОК', label: 'Лебединский ГОК' },
];
