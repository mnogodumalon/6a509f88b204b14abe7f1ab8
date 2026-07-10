import type { EnrichedKurseinheiten } from '@/types/enriched';
import type { Kurseinheiten, Trainer } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface KurseinheitenMaps {
  trainerMap: Map<string, Trainer>;
}

export function enrichKurseinheiten(
  kurseinheiten: Kurseinheiten[],
  maps: KurseinheitenMaps
): EnrichedKurseinheiten[] {
  return kurseinheiten.map(r => ({
    ...r,
    trainerName: resolveDisplay(r.fields.trainer, maps.trainerMap, 'vorname', 'nachname'),
  }));
}
