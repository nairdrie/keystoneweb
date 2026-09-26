'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import {
  AlertTriangle, Calendar, Check, Clock, DollarSign, FileText, Globe, Key, Mic, Package, Search, Wrench, X,
} from 'lucide-react';
import { LANES, STAGE_LABELS, cardAmount, cardStatus, daysOnLot, shortVehicleLabel, type StatusIcon } from '@/lib/shop/board';
import { formatCents } from '@/lib/shop/money';
import { formatShortDateTime } from '@/lib/shop/dates';
import type { JobSummary, Stage } from '@/lib/shop/types';
import { api, errorText } from './api';
import { useShop } from './ShopContext';
import { Avatar, ColorDot, KeyTag, Pill, Plate } from './ui';

export const STATUS_ICONS: Record<StatusIcon, typeof Key> = {
  key: Key, dollar: DollarSign, alert: AlertTriangle, file: FileText, wrench: Wrench, search: Search, mic: Mic,
  clock: Clock, package: Package, globe: Globe, calendar: Calendar, check: Check,
};

export function StatusPill({ job }: { job: JobSummary }) {
  const st = cardStatus(job);
  const Icon = STATUS_ICONS[st.icon];
  return <Pill tone={st.tone} icon={<Icon className="i" />}>{st.text}</Pill>;
}

function CardBody({ job }: { job: JobSummary }) {
  const amount = cardAmount(job);
  const days = daysOnLot(job);
  return (
    <>
      <div className="jc-top"><KeyTag>{job.key_tag}</KeyTag><span className="ro">RO-{job.ro_number}</span><span className="amt">{amount != null ? formatCents(amount) : ''}</span></div>
      <div className="jc-name">{job.customer.name}</div>
      <div className="jc-veh"><ColorDot color={job.vehicle.color} />{shortVehicleLabel(job.vehicle)}<Plate>{job.vehicle.plate}</Plate></div>
      <p className="jc-complaint">{job.complaint}</p>
      <div className="jc-foot"><StatusPill job={job} /><span className="age" title="Days on the lot">{days ? `${days}d on lot` : 'today'}</span><Avatar name={job.assigned_tech} /></div>
    </>
  );
}

function JobCard({ job, big, onOpen }: { job: JobSummary; big?: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: job.id });
  return (
    <article
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`jcard${big ? ' big' : ''}${isDragging ? ' dragging' : ''}`}
      aria-label={`RO-${job.ro_number}, ${job.customer.name}, ${shortVehicleLabel(job.vehicle)}. Enter to open, space to move.`}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter') onOpen(); else listeners?.onKeyDown?.(e); }}
    >
      <CardBody job={job} />
    </article>
  );
}

function DropZone({ id, className, label, children }: { id: string; className: string; label: string; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return <section ref={setNodeRef} className={`${className}${isOver ? ' drop-hover' : ''}`} aria-label={label}>{children}</section>;
}

export default function BoardView() {
  const { ws, loading, error, href, openIntake, openAuth, siteId, patchWs, refresh, toast } = useShop();
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const jobs = useMemo(() => (ws?.jobs || []).filter(j => j.status === 'open'), [ws]);
  const bays = ws?.settings.bays || [];
  const open = (id: string) => router.push(href(`/jobs/${id}`));

  async function move(job: JobSummary, target: string) {
    const [kind, id] = target.split(':');
    if (kind === 'bay') {
      if (job.bay === id) return;
      const inBay = jobs.find(j => j.bay === id && j.id !== job.id);
      const bay = bays.find(b => b.id === id);
      if (inBay) { toast(`${bay?.label} has the ${shortVehicleLabel(inBay.vehicle)} in it. Move that one out first.`, 'warn'); return; }
      if (job.invoice) { toast('This car is invoiced. It doesn’t need a bay.', 'warn'); return; }
      patchWs(w => ({ ...w, jobs: w.jobs.map(j => (j.id === job.id ? { ...j, bay: id } : j)) }));
      try {
        await api(siteId, `/jobs/${job.id}`, { body: { action: 'move', bay: id } });
        toast(`RO-${job.ro_number} moved into ${bay?.label}.`);
      } catch (err) { toast(errorText(err), 'warn'); }
      refresh();
      return;
    }
    const stage = id as Stage;
    if (job.stage === stage && !job.bay) return;
    if (stage === 'approved' && !job.approved) {
      if (job.estimate && (job.estimate.status === 'sent' || job.estimate.status === 'draft')) {
        openAuth({ jobId: job.id, estimateId: job.estimate.id });
      } else {
        toast('Write and send an estimate before this car can be approved.', 'warn');
      }
      return;
    }
    if (stage === 'waiting' && !(job.estimate && ['sent', 'approved'].includes(job.estimate.status))) {
      toast('Send the estimate first. Then the car waits on the customer.', 'warn');
      return;
    }
    if (job.invoice && stage !== 'done') { toast('This car is invoiced, so it stays in Done.', 'warn'); return; }
    patchWs(w => ({ ...w, jobs: w.jobs.map(j => (j.id === job.id ? { ...j, stage, bay: null } : j)) }));
    try {
      await api(siteId, `/jobs/${job.id}`, { body: { action: 'move', stage } });
      toast(`RO-${job.ro_number} moved to ${STAGE_LABELS[stage]}.`);
    } catch (err) { toast(errorText(err), 'warn'); }
    refresh();
  }

  function onDragStart(e: DragStartEvent) { setDragId(String(e.active.id)); }
  function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    const job = jobs.find(j => j.id === e.active.id);
    if (job && e.over) move(job, String(e.over.id));
  }

  async function dismiss(ref: string) {
    patchWs(w => ({ ...w, intake: w.intake.filter(i => i.ref !== ref) }));
    try { await api(siteId, '/settings', { body: { action: 'dismiss_intake', ref } }); } catch (err) { toast(errorText(err), 'warn'); refresh(); }
  }

  if (loading && !ws) return <div className="empty">Loading the board…</div>;
  if (error && !ws) return <div className="empty">{error}</div>;
  if (!ws) return null;

  const inBays = jobs.filter(j => j.bay).length;
  const waitingParts = jobs.filter(j => j.stage === 'approved' && !j.bay && j.parts.expected > j.parts.received).length;
  const owedOnLot = jobs.reduce((s, j) => s + (j.invoice ? j.invoice.balance_cents : 0), 0);
  const dragging = dragId ? jobs.find(j => j.id === dragId) : null;

  return (
    <>
      <div className="view-head">
        <div><h2>Board</h2><p>Every car on the property: where it is and what it’s waiting on. Drag a card to move it.</p></div>
        <div className="row"><button type="button" className="btn primary" onClick={() => openIntake()}><Key className="i" />Log a key drop-off</button></div>
      </div>
      <div className="board-stats">
        <span><b>{jobs.length}</b> car{jobs.length === 1 ? '' : 's'} on the property</span>
        <span><b>{inBays}</b> in bays</span>
        <span><b>{waitingParts}</b> waiting on parts</span>
        <span><b>{formatCents(owedOnLot)}</b> owed on cars still here</span>
      </div>
      {ws.intake.length > 0 && (
        <div className="intake intake-list">
          <div className="row"><Globe className="i" /><span><b>From your website:</b> {ws.intake.length} request{ws.intake.length === 1 ? '' : 's'} not on the board yet.</span></div>
          {ws.intake.slice(0, 6).map(i => (
            <div key={i.ref} className="intake-item">
              <span className="intake-text"><b>{i.name}</b> · {i.detail}{i.phone ? ` · ${i.phone}` : ''}<span className="note" style={{ display: 'block' }}>{i.message.slice(0, 160)}{i.kind === 'website_form' ? ` · ${formatShortDateTime(i.when)}` : ''}</span></span>
              <button type="button" className="btn sm primary" onClick={() => openIntake({ name: i.name, email: i.email, phone: i.phone, complaint: i.message, source: i.kind, source_ref: i.ref })}><Key className="i" />Put on the board</button>
              <button type="button" className="icon-btn" aria-label={`Dismiss ${i.name}`} onClick={() => dismiss(i.ref)}><X className="i" /></button>
            </div>
          ))}
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
        <div className="bays" style={{ gridTemplateColumns: bays.length > 2 ? `repeat(auto-fill, minmax(260px, 1fr))` : undefined }}>
          {bays.map(b => {
            const j = jobs.find(x => x.bay === b.id);
            return (
              <DropZone key={b.id} id={`bay:${b.id}`} className="bay" label={b.label}>
                <div className="bay-head"><span className="bay-label"><Wrench className="i" />{b.label}</span><span className="bay-meta">{j ? `${j.assigned_tech || 'No tech yet'} · ${j.approved ? 'repairing' : 'diagnosing'}` : 'Empty'}</span></div>
                {j ? <JobCard job={j} big onOpen={() => open(j.id)} /> : <div className="bay-empty">Empty. Drag a car here.</div>}
              </DropZone>
            );
          })}
        </div>
        <div className="lanes">
          {LANES.map(l => {
            const list = jobs.filter(j => j.stage === l.id && !j.bay);
            return (
              <DropZone key={l.id} id={`lane:${l.id}`} className="lane" label={l.label}>
                <div className="lane-head"><span className="lane-title">{l.label}</span><span className="count">{list.length}</span></div>
                <p className="lane-hint">{l.hint}</p>
                {list.length ? list.map(j => <JobCard key={j.id} job={j} onOpen={() => open(j.id)} />) : <div className="lane-empty">Nothing here</div>}
              </DropZone>
            );
          })}
        </div>
        <DragOverlay>{dragging ? <article className="jcard" style={{ boxShadow: 'var(--shadow-lg)' }}><CardBody job={dragging} /></article> : null}</DragOverlay>
      </DndContext>
    </>
  );
}
