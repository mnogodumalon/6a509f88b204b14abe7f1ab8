// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Trainer {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    vorname?: string;
    nachname?: string;
    email?: string;
    standard_stundensatz?: number;
  };
}

export interface Kurseinheiten {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    kursdatum?: string; // Format: YYYY-MM-DD oder ISO String
    kursbezeichnung?: string;
    trainer?: string; // applookup -> URL zu 'Trainer' Record
    dauer_stunden?: number;
    stundensatz?: number;
    honorar?: number;
    abgerechnet?: boolean;
    bemerkung?: string;
  };
}

export const APP_IDS = {
  TRAINER: '6a509f73416a75cf1f7d44e6',
  KURSEINHEITEN: '6a509f750863413a12d7681c',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'trainer': {
    'vorname': 'string/text',
    'nachname': 'string/text',
    'email': 'string/email',
    'standard_stundensatz': 'number',
  },
  'kurseinheiten': {
    'kursdatum': 'date/datetimeminute',
    'kursbezeichnung': 'string/text',
    'trainer': 'applookup/select',
    'dauer_stunden': 'number',
    'stundensatz': 'number',
    'honorar': 'number',
    'abgerechnet': 'bool',
    'bemerkung': 'string/textarea',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateTrainer = StripLookup<Trainer['fields']>;
export type CreateKurseinheiten = StripLookup<Kurseinheiten['fields']>;