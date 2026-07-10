import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichKurseinheiten } from '@/lib/enrich';
import type { EnrichedKurseinheiten } from '@/types/enriched';
import type { Trainer } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { format } from 'date-fns';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { IconAlertCircle, IconTool, IconRefresh, IconCheck, IconClock, IconCurrencyEuro, IconAlertTriangle, IconPlus, IconPencil, IconTrash, IconUsers } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { KurseinheitenDialog } from '@/components/dialogs/KurseinheitenDialog';
import { TrainerDialog } from '@/components/dialogs/TrainerDialog';
import {
  TableWidget,
  TableSkeleton,
  TableError,
  TableEmpty,
  type TableColumn,
  type TableRow,
  type TableTone,
} from '@/components/widgets/TableWidget';
import {
  ChartWidget,
  ChartSkeleton,
  ChartError,
  type ChartRow,
  type ChartSegment,
} from '@/components/widgets/ChartWidget';
import {
  RecordOverlay,
  RecordHeader,
  RecordSection,
  RecordField,
  RecordAttachments,
  useRecordOverlayStack,
} from '@/components/widgets/RecordView';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';

const APPGROUP_ID = '6a509f88b204b14abe7f1ab8';
const REPAIR_ENDPOINT = '/claude/build/repair';

type OverlayItem = { type: 'kurseinheit'; id: string } | { type: 'trainer'; id: string };

export default function DashboardOverview() {
  const clock = useClock();
  const {
    trainer, setTrainer, kurseinheiten, setKurseinheiten,
    trainerMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedKurseinheiten = enrichKurseinheiten(kurseinheiten, { trainerMap });

  // Dialog state
  const [kursDialog, setKursDialog] = useState(false);
  const [trainerDialog, setTrainerDialog] = useState(false);
  const [editingKurs, setEditingKurs] = useState<EnrichedKurseinheiten | null>(null);
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'kurs' | 'trainer'; id: string } | null>(null);

  // Overlay
  const overlay = useRecordOverlayStack<OverlayItem>();

  // Chart filter state
  const [trainerSel, setTrainerSel] = useState<ChartSegment<EnrichedKurseinheiten> | null>(null);

  // KPIs
  const offen = useMemo(() => enrichedKurseinheiten.filter(k => !k.fields.abgerechnet), [enrichedKurseinheiten]);
  const totalOffen = useMemo(() => offen.reduce((s, k) => s + (k.fields.honorar ?? 0), 0), [offen]);
  const gesamtHonorar = useMemo(() => enrichedKurseinheiten.reduce((s, k) => s + (k.fields.honorar ?? 0), 0), [enrichedKurseinheiten]);
  const gesamtStunden = useMemo(() => enrichedKurseinheiten.reduce((s, k) => s + (k.fields.dauer_stunden ?? 0), 0), [enrichedKurseinheiten]);

  // Context line
  const naechsteKurs = useMemo(() => {
    const now = format(clock, "yyyy-MM-dd'T'HH:mm");
    return enrichedKurseinheiten
      .filter(k => k.fields.kursdatum && k.fields.kursdatum > now)
      .sort((a, b) => (a.fields.kursdatum ?? '') < (b.fields.kursdatum ?? '') ? -1 : 1)[0];
  }, [enrichedKurseinheiten, clock]);

  const trainerNamen = useMemo(() => namen(trainer.map(t => `${t.fields.vorname ?? ''} ${t.fields.nachname ?? ''}`.trim())), [trainer]);

  const contextLine = useMemo(() => {
    if (trainer.length === 0 && kurseinheiten.length === 0) return 'Noch keine Daten — leg los!';
    if (naechsteKurs) {
      const tn = naechsteKurs.trainerName || 'Trainer';
      return `Nächster Kurs: „${naechsteKurs.fields.kursbezeichnung ?? '—'}" mit ${tn}.`;
    }
    if (trainer.length > 0) return `Trainer im System: ${trainerNamen}.`;
    return 'Alle Kurseinheiten im Überblick.';
  }, [naechsteKurs, trainerNamen, trainer.length, kurseinheiten.length]);

  // Table rows — filtered by chart selection
  const tableRows = useMemo((): TableRow<EnrichedKurseinheiten>[] =>
    enrichedKurseinheiten
      .filter(k => !trainerSel || trainerSel.test({ id: `kurseinheit:${k.record_id}`, data: k }))
      .map(k => ({
        id: `kurseinheit:${k.record_id}`,
        data: k,
        tone: (!k.fields.abgerechnet && (k.fields.honorar ?? 0) > 0 ? 'warning' : 'default') as TableTone,
      })),
    [enrichedKurseinheiten, trainerSel]
  );

  const chartRows = useMemo((): ChartRow<EnrichedKurseinheiten>[] =>
    enrichedKurseinheiten.map(k => ({ id: `kurseinheit:${k.record_id}`, data: k })),
    [enrichedKurseinheiten]
  );

  // Columns
  const columns = useMemo((): TableColumn<EnrichedKurseinheiten>[] => [
    {
      key: 'kursbezeichnung',
      label: 'Kursbezeichnung',
      accessor: row => row.data.fields.kursbezeichnung,
      format: 'text',
      priority: 100,
      cardRole: 'title',
      filterable: true,
    },
    {
      key: 'kursdatum',
      label: 'Datum & Uhrzeit',
      accessor: row => row.data.fields.kursdatum,
      format: 'datetime',
      priority: 90,
      cardRole: 'subtitle',
    },
    {
      key: 'trainerName',
      label: 'Trainer',
      accessor: row => row.data.trainerName,
      format: 'text',
      priority: 80,
      cardRole: 'body',
      filterable: true,
    },
    {
      key: 'dauer_stunden',
      label: 'Stunden',
      accessor: row => row.data.fields.dauer_stunden,
      format: 'number',
      align: 'right',
      priority: 70,
      aggregate: 'sum',
    },
    {
      key: 'stundensatz',
      label: 'Stundensatz (€)',
      accessor: row => row.data.fields.stundensatz,
      format: 'currency',
      align: 'right',
      priority: 60,
    },
    {
      key: 'honorar',
      label: 'Honorar gesamt (€)',
      accessor: row => row.data.fields.honorar,
      format: 'currency',
      align: 'right',
      priority: 100,
      aggregate: 'sum',
      responsive: 'keep',
    },
    {
      key: 'abgerechnet',
      label: 'Abgerechnet',
      accessor: row => row.data.fields.abgerechnet,
      format: 'bool',
      priority: 50,
      filterable: true,
      renderCell: (val) => (
        <span className={`text-xs font-medium ${val ? 'text-green-600' : 'text-amber-600'}`}>
          {val ? 'Ja' : 'Nein'}
        </span>
      ),
    },
  ], []);

  // Actions
  const handleMarkAbgerechnet = async (k: EnrichedKurseinheiten) => {
    const prev = k.fields.abgerechnet;
    setKurseinheiten(ks => ks.map(x => x.record_id === k.record_id ? { ...x, fields: { ...x.fields, abgerechnet: true } } : x));
    try {
      await LivingAppsService.updateKurseinheitenEntry(k.record_id, { abgerechnet: true });
      undoToast('Als abgerechnet markiert', async () => {
        setKurseinheiten(ks => ks.map(x => x.record_id === k.record_id ? { ...x, fields: { ...x.fields, abgerechnet: prev ?? false } } : x));
        await LivingAppsService.updateKurseinheitenEntry(k.record_id, { abgerechnet: prev ?? false });
      });
    } catch {
      fetchAll();
    }
  };

  const handleDeleteKurs = async () => {
    if (!deleteTarget || deleteTarget.type !== 'kurs') return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    const prev = kurseinheiten.find(k => k.record_id === id);
    setKurseinheiten(ks => ks.filter(k => k.record_id !== id));
    try {
      await LivingAppsService.deleteKurseinheitenEntry(id);
      undoToast('Kurseinheit gelöscht', async () => {
        if (prev) {
          await LivingAppsService.createKurseinheitenEntry(prev.fields as Parameters<typeof LivingAppsService.createKurseinheitenEntry>[0]);
          fetchAll();
        }
      });
    } catch {
      fetchAll();
    }
  };

  const handleDeleteTrainer = async () => {
    if (!deleteTarget || deleteTarget.type !== 'trainer') return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    const prev = trainer.find(t => t.record_id === id);
    setTrainer(ts => ts.filter(t => t.record_id !== id));
    try {
      await LivingAppsService.deleteTrainerEntry(id);
      undoToast('Trainer gelöscht', async () => {
        if (prev) {
          await LivingAppsService.createTrainerEntry(prev.fields as Parameters<typeof LivingAppsService.createTrainerEntry>[0]);
          fetchAll();
        }
      });
    } catch {
      fetchAll();
    }
  };

  // Overlay record resolution
  const overlayKurs = overlay.top?.type === 'kurseinheit'
    ? enrichedKurseinheiten.find(k => k.record_id === overlay.top!.id) ?? null
    : null;
  const overlayTrainer = overlay.top?.type === 'trainer'
    ? trainer.find(t => t.record_id === overlay.top!.id) ?? null
    : null;

  // Offene (nicht abgerechnete) Kurseinheiten für WorkList
  const offeneListe = useMemo(() =>
    offen
      .sort((a, b) => (a.fields.kursdatum ?? '') < (b.fields.kursdatum ?? '') ? -1 : 1)
      .slice(0, 8),
    [offen]
  );

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  return (
    <>
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{contextLine}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { setEditingTrainer(null); setTrainerDialog(true); }}>
            <IconUsers size={14} className="mr-1.5 shrink-0" />
            Trainer anlegen
          </Button>
          <Button size="sm" onClick={() => { setEditingKurs(null); setKursDialog(true); }}>
            <IconPlus size={14} className="mr-1.5 shrink-0" />
            Kurseinheit anlegen
          </Button>
        </div>
      </div>

      <DashboardGrid
        variant="wide"
        kpis={
          <StatStrip>
            <StatStripItem
              title="Abgerechnetes Honorar"
              value={formatCurrency(gesamtHonorar - totalOffen)}
              icon={<IconCurrencyEuro size={16} />}
              tone="default"
            />
            <StatStripItem
              title="Offen (nicht abgerechnet)"
              value={formatCurrency(totalOffen)}
              icon={<IconAlertTriangle size={16} />}
              tone={totalOffen > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title="Kursstunden gesamt"
              value={`${gesamtStunden} h`}
              icon={<IconClock size={16} />}
              tone="default"
            />
            <StatStripItem
              title="Trainer"
              value={String(trainer.length)}
              icon={<IconUsers size={16} />}
              tone="default"
            />
          </StatStrip>
        }
        aside={
          <>
            <WorkList
              title="Noch nicht abgerechnet"
              icon={<IconAlertTriangle size={14} className="shrink-0" />}
              items={offeneListe.map(k => ({
                id: k.record_id,
                title: k.fields.kursbezeichnung ?? '—',
                secondLine: (
                  <>
                    <span className="text-amber-600 font-medium">{formatCurrency(k.fields.honorar)}</span>
                    <span className="text-muted-foreground"> · {k.trainerName || '—'}</span>
                  </>
                ),
                action: {
                  label: '✓ Abrechnen',
                  onClick: () => handleMarkAbgerechnet(k),
                },
              }))}
              onItemClick={id => overlay.replace({ type: 'kurseinheit', id })}
              empty={{
                text: 'Alle Kurseinheiten wurden abgerechnet.',
                action: { label: 'Kurseinheit anlegen', onClick: () => { setEditingKurs(null); setKursDialog(true); } },
              }}
            />
            <ChartWidget
              title="Honorar pro Trainer"
              rows={chartRows}
              dimension={{ kind: 'category', accessor: r => r.data.trainerName || 'Kein Trainer' }}
              measure={{ aggregate: 'sum', label: 'Honorar', value: r => r.data.fields.honorar ?? null, format: 'currency' }}
              interaction={{ mode: 'filter', selectedKey: trainerSel?.key ?? null, onSelect: setTrainerSel }}
            />
          </>
        }
        primary={
          <TableWidget
            columns={columns}
            rows={tableRows}
            locale="de"
            onRowClick={row => overlay.replace({ type: 'kurseinheit', id: row.id.split(':')[1] ?? '' })}
            toneForRow={row => row.data.fields.abgerechnet ? 'default' : (row.data.fields.honorar ?? 0) > 0 ? 'warning' : 'default'}
            actions={[
              {
                icon: IconPencil,
                label: 'Bearbeiten',
                onClick: row => {
                  setEditingKurs(row.data);
                  setKursDialog(true);
                },
              },
              {
                icon: IconTrash,
                label: 'Löschen',
                tone: 'destructive',
                onClick: row => setDeleteTarget({ type: 'kurs', id: row.id.split(':')[1] ?? '' }),
              },
            ]}
            exportable
          />
        }
      />

      {/* Kurseinheiten-Overlay */}
      {overlay.open && overlay.top?.type === 'kurseinheit' && overlayKurs && (
        <RecordOverlay
          open
          onClose={overlay.close}
          onEdit={() => { setEditingKurs(overlayKurs); setKursDialog(true); }}
          footer={
            !overlayKurs.fields.abgerechnet ? (
              <Button size="sm" onClick={() => handleMarkAbgerechnet(overlayKurs)}>
                Jetzt abrechnen
              </Button>
            ) : undefined
          }
        >
          <RecordHeader
            title={overlayKurs.fields.kursbezeichnung ?? '—'}
            subtitle={formatDateTime(overlayKurs.fields.kursdatum)}
            badges={
            overlayKurs.fields.abgerechnet
              ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Abgerechnet</span>
              : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Offen</span>
          }
          />
          <RecordSection cols={2}>
            <RecordField label="Trainer" value={overlayKurs.trainerName || '—'} />
            <RecordField label="Datum & Uhrzeit" value={formatDateTime(overlayKurs.fields.kursdatum)} />
            <RecordField label="Dauer (Stunden)" value={overlayKurs.fields.dauer_stunden != null ? `${overlayKurs.fields.dauer_stunden} h` : '—'} />
            <RecordField label="Stundensatz (€)" value={overlayKurs.fields.stundensatz != null ? formatCurrency(overlayKurs.fields.stundensatz) : '—'} />
            <RecordField label="Honorar gesamt (€)" value={overlayKurs.fields.honorar != null ? formatCurrency(overlayKurs.fields.honorar) : '—'} emphasis />
            <RecordField label="Abgerechnet" value={overlayKurs.fields.abgerechnet ? 'Ja' : 'Nein'} />
          </RecordSection>
          {overlayKurs.fields.bemerkung && (
            <RecordSection title="Bemerkung">
              <RecordField label="" value={overlayKurs.fields.bemerkung} format="longtext" />
            </RecordSection>
          )}
          <RecordAttachments appId={APP_IDS.KURSEINHEITEN} recordId={overlayKurs.record_id} />
        </RecordOverlay>
      )}

      {/* Trainer-Overlay */}
      {overlay.open && overlay.top?.type === 'trainer' && overlayTrainer && (
        <RecordOverlay
          open
          onClose={overlay.close}
          onEdit={() => { setEditingTrainer(overlayTrainer); setTrainerDialog(true); }}
        >
          <RecordHeader
            title={`${overlayTrainer.fields.vorname ?? ''} ${overlayTrainer.fields.nachname ?? ''}`.trim() || '—'}
            subtitle={overlayTrainer.fields.email}
          />
          <RecordSection cols={2}>
            <RecordField label="Vorname" value={overlayTrainer.fields.vorname} />
            <RecordField label="Nachname" value={overlayTrainer.fields.nachname} />
            <RecordField label="E-Mail" value={overlayTrainer.fields.email} format="email" />
            <RecordField label="Standard-Stundensatz" value={overlayTrainer.fields.standard_stundensatz != null ? formatCurrency(overlayTrainer.fields.standard_stundensatz) : '—'} />
          </RecordSection>
          <RecordAttachments appId={APP_IDS.TRAINER} recordId={overlayTrainer.record_id} />
        </RecordOverlay>
      )}

      {/* Kurseinheit Dialog */}
      <KurseinheitenDialog
        open={kursDialog}
        onClose={() => { setKursDialog(false); setEditingKurs(null); }}
        onSubmit={async (fields) => {
          if (editingKurs) {
            await LivingAppsService.updateKurseinheitenEntry(editingKurs.record_id, fields);
          } else {
            await LivingAppsService.createKurseinheitenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingKurs?.fields}
        recordId={editingKurs?.record_id}
        trainerList={trainer}
        enablePhotoScan={AI_PHOTO_SCAN['Kurseinheiten']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Kurseinheiten']}
      />

      {/* Trainer Dialog */}
      <TrainerDialog
        open={trainerDialog}
        onClose={() => { setTrainerDialog(false); setEditingTrainer(null); }}
        onSubmit={async (fields) => {
          if (editingTrainer) {
            await LivingAppsService.updateTrainerEntry(editingTrainer.record_id, fields);
          } else {
            await LivingAppsService.createTrainerEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editingTrainer?.fields}
        recordId={editingTrainer?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Trainer']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Trainer']}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.type === 'kurs' ? 'Kurseinheit löschen' : 'Trainer löschen'}
        description="Wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
        onConfirm={deleteTarget?.type === 'kurs' ? handleDeleteKurs : handleDeleteTrainer}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
