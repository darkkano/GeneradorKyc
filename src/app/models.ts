export type FieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'file'
  | 'textarea'
  | 'money'
  | 'repeater';

export interface WhenRule {
  field: string;
  op: 'eq' | 'neq' | 'truthy';
  value?: unknown;
}

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldRule {
  key: string;
  type: FieldType;
  label: string;
  required?: boolean;
  hint?: string;
  pattern?: string;
  accept?: string;
  autocomplete?: string;
  min?: number;
  max?: number;
  minItems?: number;
  maxItems?: number;
  itemLabel?: string;
  value?: unknown;
  options?: FieldOption[];
  when?: WhenRule;
  fields?: FieldRule[];
}

export interface FormStep {
  id: string;
  title: string;
  description?: string;
  fields: FieldRule[];
}

export interface FormSchema {
  id: string;
  engine: string;
  version: number;
  country: string;
  countryName: string;
  activity: string;
  volumeUsd: number;
  risk: 'low' | 'mid' | 'high';
  currency: string;
  title: string;
  rationale: string;
  steps: FormStep[];
}

export interface CountryMeta {
  id: string;
  name: string;
  base: number;
  currency: string;
  idLabel: string;
}

export interface ActivityMeta {
  id: string;
  label: string;
}

export type FormValues = Record<string, unknown>;
