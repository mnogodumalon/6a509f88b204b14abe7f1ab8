import type { Kurseinheiten } from './app';

export type EnrichedKurseinheiten = Kurseinheiten & {
  trainerName: string;
};
