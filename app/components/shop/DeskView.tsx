'use client';

import Link from 'next/link';
import { AlertTriangle, Calendar, Car, Check, Clock, DollarSign, FileText, Globe, Inbox, Key, Landmark, Mic, Package, Phone, RotateCcw, Search, Wrench } from 'lucide-react';
import { deskTasks, shortVehicleLabel, type DeskTask } from '@/lib/shop/board';
import { formatDate, todayISO } from '@/lib/shop/dates';
import { useShop } from './ShopContext';

const ICONS: Record<DeskTask['icon'], typeof Key> = {
  key: Key, dollar: DollarSign, alert: AlertTriangle, file: FileText, wrench: Wrench, search: Search, mic: Mic, clock: Clock,
  package: Package, globe: Globe, calendar: Calendar, check: Check, landmark: Landmark, rotate: RotateCcw, phone: Phone, inbox: Inbox,
};
const GROUPS: { id: DeskTask['group']; label: string }[] = [
  { id: 'now', label: 'Do now' }, { id: 'customers', label: 'Waiting on customers' }, { id: 'money', label: 'Money' }, { id: 'paperwork', label: 'Paperwork' },
];

export default function DeskView() {
  const { ws, loading, error, href } = useShop();
  if (loading && !ws) return <div className="empty">Loading your desk…</div>;
  if (error && !ws) return <div className="empty">{error}</div>;
  if (!ws) return null;
  const tasks = deskTasks(ws);
  const jobs = ws.jobs.filter(j => j.status === 'open');
  const recent = [...jobs].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 4);
  const link = (t: DeskTask) => {
    if (t.action.jobId) return href(`/jobs/${t.action.jobId}`, t.action.tab ? { tab: t.action.tab } : undefined);
    if (t.action.view === 'money' && t.action.lienId) return href('/money', { lien: t.action.lienId });
    if (t.action.view === 'board') return href('');
    return href(`/${t.action.view || ''}`);
  };
  return (
    <>
      <div className="view-head"><div><h2>My desk</h2><p>Everything waiting on you, in order. Each item opens the file right where you left off.</p></div></div>
      <div className="desk-grid">
        <div>
          {GROUPS.map(g => {
            const items = tasks.filter(t => t.group === g.id);
            if (!items.length) return null;
            return (
              <div key={g.id} className="task-group">
                <span className="eyebrow">{g.label}</span>
                {items.map(t => {
                  const Icon = ICONS[t.icon] || FileText;
                  return (
                    <div key={t.key} className={`task ${t.tone}`}>
                      <span className="ti"><Icon className="i" /></span>
                      <div><b>{t.title}</b><p>{t.text}</p></div>
                      <Link className={`btn sm${g.id === 'now' ? ' primary' : ''}`} href={link(t)}>{t.action.label}</Link>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {!tasks.length && <div className="panel empty"><Check className="i" /> Nothing waiting on you. Every car is moving.</div>}
        </div>
        <aside className="side">
          <div className="panel">
            <div className="panel-head"><span className="panel-title"><Car className="i" />Today</span><span className="note">{formatDate(todayISO(), { year: undefined })}</span></div>
            <div className="panel-body stat-list">
              <div><span>Cars on the property</span><b>{jobs.length}</b></div>
              <div><span>In bays</span><b>{jobs.filter(j => j.bay).length} of {ws.settings.bays.length}</b></div>
              <div><span>Waiting on customers</span><b>{jobs.filter(j => j.stage === 'waiting').length}</b></div>
              <div><span>Ready to invoice</span><b>{jobs.filter(j => j.stage === 'done' && j.approved && !j.invoice).length}</b></div>
              <div><span>Parts invoices to match</span><b>{ws.pile_count}</b></div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title"><RotateCcw className="i" />You were last working on</span></div>
            <div className="panel-body stat-list">
              {recent.map(j => (
                <div key={j.id}>
                  <Link href={href(`/jobs/${j.id}`)} style={{ textDecoration: 'none' }}>
                    <b style={{ fontVariantNumeric: 'normal' }}>{shortVehicleLabel(j.vehicle)}</b> <span className="note">· {j.customer.name}</span><br />
                    <span className="note">{j.next_step || j.complaint}</span>
                  </Link>
                </div>
              ))}
              {!recent.length && <p className="note">No cars on the board.</p>}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
