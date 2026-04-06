'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminContext } from '../admin-context';
import {
  Users, Package, Settings, Mail, Search, Plus, Trash2, Loader2, Download,
  MoreVertical, Check, X, Edit2, Send, Calendar, CreditCard, AlertTriangle,
  Eye, ChevronDown, ChevronUp, Palette,
} from 'lucide-react';
import { buildMemberEmailHtml } from '@/lib/membership/email-template';

type TabId = 'members' | 'packages' | 'form' | 'campaigns' | 'settings';

export default function AdminMembershipPage() {
  const { siteId, palette, siteBlockTypes, site } = useAdminContext();
  const [activeTab, setActiveTab] = useState<TabId>('members');

  if (!siteId) return null;

  if (!siteBlockTypes.has('membershipPortal')) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Users className="w-7 h-7 text-slate-300" />
        </div>
        <h2 className="text-base font-bold text-slate-900 mb-1">No Members Only block on this site</h2>
        <p className="text-sm text-slate-500 max-w-xs mb-5">
          Add a <strong>Members Only</strong> block to your site to start accepting memberships
          and managing your members.
        </p>
        <a
          href={`/design?siteId=${siteId}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors"
        >
          Open Designer
        </a>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'members', label: 'Members', icon: Users },
    { id: 'packages', label: 'Packages', icon: Package },
    { id: 'form', label: 'Signup Form', icon: Edit2 },
    { id: 'campaigns', label: 'Emails', icon: Mail },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'members' && <MembersTab siteId={siteId} />}
      {activeTab === 'packages' && <PackagesTab siteId={siteId} />}
      {activeTab === 'form' && <SignupFormTab siteId={siteId} />}
      {activeTab === 'campaigns' && <CampaignsTab siteId={siteId} />}
      {activeTab === 'settings' && <SettingsTab siteId={siteId} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEMBERS TAB
// ═══════════════════════════════════════════════════════════════════════════════

const BUILT_IN_FIELD_KEYS = new Set(['name', 'email', 'password']);

function MembersTab({ siteId }: { siteId: string }) {
  const [members, setMembers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('signed_up_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [formFields, setFormFields] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/membership/settings?siteId=${siteId}`)
      .then(r => r.json())
      .then(data => {
        const fields = data.settings?.signup_form_fields;
        setFormFields(Array.isArray(fields) ? fields : []);
      })
      .catch(() => {});
  }, [siteId]);

  const customColumns = formFields.filter(f => !BUILT_IN_FIELD_KEYS.has(f.key));

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPage(1);
  };

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        siteId,
        page: String(page),
        limit: '50',
        sortBy,
        sortDir,
      });
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/membership/members?${params}`);
      const data = await res.json();
      setMembers(data.members || []);
      setTotal(data.total || 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [siteId, page, search, statusFilter, sortBy, sortDir]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const handleExportCSV = () => {
    const customHeaders = customColumns.map(f => f.label);
    const headers = ['Name', 'Email', 'Status', 'Package', 'Subscription', 'Signed Up', 'Last Login', ...customHeaders, 'Marketing Opt-In'];
    const csv = [
      headers.join(','),
      ...members.map(m => {
        const customValues = customColumns.map(f => {
          const v = m.custom_fields?.[f.key];
          return Array.isArray(v) ? v.join('; ') : (v ?? '');
        });
        return [
          m.name || '',
          m.email,
          m.status,
          m.membership_packages?.name || '',
          m.subscription_status === 'none' ? '' : (m.subscription_status || ''),
          m.signed_up_at ? new Date(m.signed_up_at).toLocaleDateString() : '',
          m.last_login_at ? new Date(m.last_login_at).toLocaleDateString() : '',
          ...customValues,
          m.marketing_opt_in ? 'Yes' : 'No',
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
      }),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `members-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to delete this member?')) return;
    await fetch('/api/membership/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId, memberId }),
    });
    fetchMembers();
  };

  const handleUpdateStatus = async (memberId: string, status: string) => {
    await fetch('/api/membership/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId, memberId, status }),
    });
    fetchMembers();
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    suspended: 'bg-red-100 text-red-700',
    cancelled: 'bg-slate-100 text-slate-500',
  };

  const SortIndicator = ({ col }: { col: string }) => (
    <span className={`ml-1 text-[10px] ${sortBy === col ? 'text-slate-700' : 'text-slate-300'}`}>
      {sortBy === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  );

  const SortTh = ({ col, label, className = '' }: { col: string; label: string; className?: string }) => (
    <th
      className={`text-left px-4 py-2.5 font-medium whitespace-nowrap cursor-pointer select-none hover:text-slate-700 ${className}`}
      onClick={() => handleSort(col)}
    >
      {label}<SortIndicator col={col} />
    </th>
  );

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
        >
          <Download className="w-4 h-4" />
          CSV
        </button>
      </div>

      {/* Count */}
      <p className="text-xs text-slate-400">{total} member{total !== 1 ? 's' : ''} total</p>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-12 text-sm text-slate-400">
          No members yet. Members will appear here when they sign up on your site.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: `${600 + customColumns.length * 160}px` }}>
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th
                    className="text-left px-4 py-2.5 font-medium whitespace-nowrap cursor-pointer select-none hover:text-slate-700 sticky left-0 bg-slate-50 z-10 shadow-[1px_0_0_0_#e2e8f0]"
                    onClick={() => handleSort('name')}
                  >
                    Member<SortIndicator col="name" />
                  </th>
                  <SortTh col="status" label="Status" />
                  <SortTh col="package" label="Package" />
                  <SortTh col="subscription_status" label="Subscription" />
                  <SortTh col="signed_up_at" label="Joined" />
                  <SortTh col="last_login_at" label="Last Login" />
                  {customColumns.map(f => (
                    <th key={f.key} className="text-left px-4 py-2.5 font-medium whitespace-nowrap">
                      {f.label}
                    </th>
                  ))}
                  <th className="text-right px-4 py-2.5 font-medium sticky right-0 bg-slate-50 z-10 shadow-[-1px_0_0_0_#e2e8f0]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-4 py-3 sticky left-0 bg-white group-hover:bg-slate-50/80 z-10 shadow-[1px_0_0_0_#e2e8f0]">
                      <div>
                        <p className="font-medium text-slate-900">{m.name || 'Unnamed'}</p>
                        <p className="text-xs text-slate-400">{m.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[m.status] || ''}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {m.membership_packages?.name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${
                        m.subscription_status === 'active' ? 'text-green-600' :
                        m.subscription_status === 'past_due' ? 'text-yellow-600' :
                        'text-slate-400'
                      }`}>
                        {m.subscription_status === 'none' ? '—' : (m.subscription_status || '—')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                      {m.signed_up_at ? new Date(m.signed_up_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                      {m.last_login_at ? new Date(m.last_login_at).toLocaleDateString() : '—'}
                    </td>
                    {customColumns.map(f => {
                      const val = m.custom_fields?.[f.key];
                      const display = val === null || val === undefined ? '—'
                        : Array.isArray(val) ? (val.length ? val.join(', ') : '—')
                        : val === true ? 'Yes'
                        : val === false ? 'No'
                        : String(val) || '—';
                      return (
                        <td key={f.key} className="px-4 py-3 text-slate-600 max-w-[200px]">
                          <span className="block truncate" title={display !== '—' ? String(display) : undefined}>
                            {display}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right sticky right-0 bg-white group-hover:bg-slate-50/80 z-10 shadow-[-1px_0_0_0_#e2e8f0]">
                      <div className="flex items-center justify-end gap-1">
                        {m.status === 'active' && (
                          <button
                            onClick={() => handleUpdateStatus(m.id, 'suspended')}
                            className="p-1.5 rounded text-slate-400 hover:text-yellow-600 hover:bg-yellow-50"
                            title="Suspend"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {m.status === 'suspended' && (
                          <button
                            onClick={() => handleUpdateStatus(m.id, 'active')}
                            className="p-1.5 rounded text-slate-400 hover:text-green-600 hover:bg-green-50"
                            title="Reactivate"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteMember(m.id)}
                          className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-sm text-slate-500">Page {page} of {Math.ceil(total / 50)}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page * 50 >= total}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PACKAGES TAB
// ═══════════════════════════════════════════════════════════════════════════════

function PackagesTab({ siteId }: { siteId: string }) {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editPkg, setEditPkg] = useState<any>(null);

  const fetchPackages = useCallback(async () => {
    try {
      const res = await fetch(`/api/membership/packages?siteId=${siteId}`);
      const data = await res.json();
      setPackages(data.packages || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { fetchPackages(); }, [fetchPackages]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{packages.length} package{packages.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => { setShowAdd(true); setEditPkg(null); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-700"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Package
        </button>
      </div>

      {packages.length === 0 && !showAdd ? (
        <div className="text-center py-12 text-sm text-slate-400">
          No packages yet. Create your first membership package.
        </div>
      ) : (
        <div className="grid gap-4">
          {packages.map(pkg => (
            <div key={pkg.id} className="border border-slate-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">{pkg.name}</h3>
                {pkg.description && <p className="text-xs text-slate-500 mt-0.5">{pkg.description}</p>}
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-sm font-bold text-slate-700">
                    {pkg.price_cents > 0
                      ? `$${(pkg.price_cents / 100).toFixed(2)} ${pkg.currency}/${pkg.billing_interval}`
                      : 'Free'}
                  </span>
                  {pkg.trial_days > 0 && (
                    <span className="text-xs text-blue-600">{pkg.trial_days}-day trial</span>
                  )}
                </div>
                {pkg.features && pkg.features.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {pkg.features.map((f: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-600">{f}</span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={async () => {
                  if (confirm('Deactivate this package?')) {
                    await fetch('/api/membership/packages', {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ siteId, packageId: pkg.id }),
                    });
                    fetchPackages();
                  }
                }}
                className="p-2 text-slate-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <PackageForm
          siteId={siteId}
          onSaved={() => { setShowAdd(false); fetchPackages(); }}
          onCancel={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

function PackageForm({
  siteId, onSaved, onCancel,
}: {
  siteId: string; onSaved: () => void; onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceCents, setPriceCents] = useState(0);
  const [billingInterval, setBillingInterval] = useState('free');
  const [trialDays, setTrialDays] = useState(0);
  const [featuresStr, setFeaturesStr] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/membership/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          name,
          description,
          priceCents: billingInterval === 'free' ? 0 : priceCents,
          billingInterval,
          trialDays: billingInterval === 'free' ? 0 : trialDays,
          features: featuresStr.split('\n').map(f => f.trim()).filter(Boolean),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create package');
        return;
      }
      onSaved();
    } catch {
      setError('Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-slate-200 rounded-xl p-5 space-y-4 bg-white">
      <h3 className="font-semibold text-slate-900">New Package</h3>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="e.g. Premium" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Billing</label>
          <select value={billingInterval} onChange={e => setBillingInterval(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
            <option value="free">Free</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
            <option value="one_time">One-time</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
        <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
      </div>
      {billingInterval !== 'free' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Price (cents)</label>
            <input type="number" value={priceCents} onChange={e => setPriceCents(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" min={0} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Trial Days</label>
            <input type="number" value={trialDays} onChange={e => setTrialDays(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" min={0} />
          </div>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Features (one per line)</label>
        <textarea value={featuresStr} onChange={e => setFeaturesStr(e.target.value)} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Unlimited access&#10;Priority support&#10;..." />
      </div>
      <div className="flex items-center gap-2 pt-2">
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50">
          {saving ? 'Creating...' : 'Create Package'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-slate-200 text-sm rounded-lg text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNUP FORM TAB
// ═══════════════════════════════════════════════════════════════════════════════

interface SignupFormField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
}

interface SignupFormStage {
  id: string;
  title: string;
  fields: SignupFormField[];
}

const STAGE1_LOCKED_KEYS = ['email', 'password'];

function defaultStages(): SignupFormStage[] {
  return [{
    id: 'stage_1',
    title: 'Account Details',
    fields: [
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
    ],
  }];
}

function rawToStages(raw: any): SignupFormStage[] {
  if (!raw) return defaultStages();
  if (raw.stages) return raw.stages;
  if (Array.isArray(raw)) {
    // Backwards compat: old flat array → single stage, email+password first
    const locked = raw.filter((f: any) => STAGE1_LOCKED_KEYS.includes(f.key));
    const rest = raw.filter((f: any) => !STAGE1_LOCKED_KEYS.includes(f.key));
    return [{ id: 'stage_1', title: 'Account Details', fields: [...locked, ...rest] }];
  }
  return defaultStages();
}

function SignupFormTab({ siteId }: { siteId: string }) {
  const [stages, setStages] = useState<SignupFormStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/membership/settings?siteId=${siteId}`);
        const data = await res.json();
        setStages(rawToStages(data.settings?.signup_form_fields));
      } catch {
        setStages(defaultStages());
      } finally {
        setLoading(false);
      }
    })();
  }, [siteId]);

  // ── Stage operations ────────────────────────────────────────────────────────

  const addStage = () => {
    setStages(prev => [...prev, {
      id: `stage_${Date.now()}`,
      title: `Step ${prev.length + 1}`,
      fields: [],
    }]);
  };

  const removeStage = (si: number) => {
    setStages(prev => prev.filter((_, i) => i !== si));
  };

  const updateStageTitle = (si: number, title: string) => {
    setStages(prev => prev.map((s, i) => i === si ? { ...s, title } : s));
  };

  // ── Field operations ────────────────────────────────────────────────────────

  const addField = (si: number) => {
    setStages(prev => prev.map((s, i) => i === si ? {
      ...s,
      fields: [...s.fields, { key: `custom_${Date.now()}`, label: 'New Field', type: 'text', required: false }],
    } : s));
  };

  const removeField = (si: number, fi: number) => {
    setStages(prev => prev.map((s, i) => i === si ? {
      ...s, fields: s.fields.filter((_, j) => j !== fi),
    } : s));
  };

  const updateField = (si: number, fi: number, key: string, value: any) => {
    setStages(prev => prev.map((s, i) => i === si ? {
      ...s,
      fields: s.fields.map((f, j) => {
        if (j !== fi) return f;
        const updated = { ...f, [key]: value };
        // Clear options when switching away from select/multiselect
        if (key === 'type' && value !== 'select' && value !== 'multiselect') {
          delete updated.options;
        }
        return updated;
      }),
    } : s));
  };

  // ── Option operations ───────────────────────────────────────────────────────

  const addOption = (si: number, fi: number) => {
    setStages(prev => prev.map((s, i) => i === si ? {
      ...s,
      fields: s.fields.map((f, j) => j === fi ? { ...f, options: [...(f.options || []), ''] } : f),
    } : s));
  };

  const updateOption = (si: number, fi: number, oi: number, value: string) => {
    setStages(prev => prev.map((s, i) => i === si ? {
      ...s,
      fields: s.fields.map((f, j) => j === fi ? {
        ...f, options: (f.options || []).map((o, k) => k === oi ? value : o),
      } : f),
    } : s));
  };

  const removeOption = (si: number, fi: number, oi: number) => {
    setStages(prev => prev.map((s, i) => i === si ? {
      ...s,
      fields: s.fields.map((f, j) => j === fi ? {
        ...f, options: (f.options || []).filter((_, k) => k !== oi),
      } : f),
    } : s));
  };

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/membership/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, signupFormFields: { stages } }),
      });
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        Break your signup into stages — users see a progress bar as they move through each step.
        Stage 1 always requires email and password.
      </p>

      {stages.map((stage, si) => (
        <div key={stage.id} className="border border-slate-200 rounded-xl overflow-hidden">
          {/* Stage header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
            <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs flex items-center justify-center font-bold shrink-0">
              {si + 1}
            </span>
            <input
              type="text"
              value={stage.title}
              onChange={e => updateStageTitle(si, e.target.value)}
              className="flex-1 bg-transparent text-sm font-semibold text-slate-800 focus:outline-none"
              placeholder="Stage title"
            />
            {si > 0 && (
              <button onClick={() => removeStage(si)} className="p-1 text-slate-400 hover:text-red-500" title="Remove stage">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Fields */}
          <div className="p-4 space-y-3">
            {stage.fields.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-2">No fields yet.</p>
            )}
            {stage.fields.map((field, fi) => {
              const isLocked = si === 0 && STAGE1_LOCKED_KEYS.includes(field.key);
              const needsOptions = field.type === 'select' || field.type === 'multiselect';
              return (
                <div key={field.key} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 p-3">
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <input
                        type="text"
                        value={field.label}
                        onChange={e => updateField(si, fi, 'label', e.target.value)}
                        disabled={isLocked}
                        className="px-3 py-1.5 border border-slate-200 rounded text-sm disabled:bg-slate-50 disabled:text-slate-400"
                        placeholder="Label"
                      />
                      <select
                        value={field.type}
                        onChange={e => updateField(si, fi, 'type', e.target.value)}
                        disabled={isLocked}
                        className="px-3 py-1.5 border border-slate-200 rounded text-sm disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        <option value="text">Text</option>
                        <option value="email">Email</option>
                        <option value="password">Password</option>
                        <option value="phone">Phone</option>
                        <option value="date">Date</option>
                        <option value="select">Select (dropdown)</option>
                        <option value="multiselect">Multi-select</option>
                        <option value="textarea">Textarea</option>
                        <option value="checkbox">Checkbox</option>
                      </select>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={e => updateField(si, fi, 'required', e.target.checked)}
                          disabled={isLocked}
                          className="rounded"
                        />
                        Required
                      </label>
                    </div>
                    {!isLocked && (
                      <button onClick={() => removeField(si, fi)} className="p-1.5 text-slate-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Options editor for select / multiselect */}
                  {needsOptions && (
                    <div className="px-3 pb-3 pt-2 border-t border-slate-100 bg-slate-50">
                      <p className="text-xs font-medium text-slate-500 mb-2">Options</p>
                      <div className="space-y-1.5">
                        {(field.options || []).map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={opt}
                              onChange={e => updateOption(si, fi, oi, e.target.value)}
                              className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                              placeholder={`Option ${oi + 1}`}
                            />
                            <button onClick={() => removeOption(si, fi, oi)} className="text-slate-300 hover:text-red-400">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addOption(si, fi)}
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mt-1"
                        >
                          <Plus className="w-3 h-3" /> Add option
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <button
              onClick={() => addField(si)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-slate-300 text-sm rounded-lg text-slate-500 hover:bg-slate-50 w-full justify-center"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Field
            </button>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          onClick={addStage}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-sm rounded-lg text-slate-600 hover:bg-slate-50"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Stage
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Form'}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL PREVIEW MODAL
// ═══════════════════════════════════════════════════════════════════════════════

function EmailPreviewModal({ html, onClose }: { html: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
          <span className="text-sm font-semibold text-slate-700">Email Preview</span>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden bg-slate-100">
          <iframe
            srcDoc={html}
            className="w-full h-full border-0"
            title="Email Preview"
            sandbox="allow-same-origin"
            style={{ minHeight: '500px' }}
          />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAMPAIGNS TAB (Email management)
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_HEADER_COLOR = '#1e293b';
const DEFAULT_ACCENT_COLOR = '#334155';

function CampaignsTab({ siteId }: { siteId: string }) {
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);

  // Email design
  const [logoUrl, setLogoUrl] = useState('');
  const [headerColor, setHeaderColor] = useState(DEFAULT_HEADER_COLOR);
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT_COLOR);
  const [footerText, setFooterText] = useState('');
  const [savingDesign, setSavingDesign] = useState(false);
  const [designSaved, setDesignSaved] = useState(false);

  // System email templates
  const [templates, setTemplates] = useState({
    verification: { subject: '', body: '' },
    passwordReset: { subject: '', body: '' },
    welcome: { subject: '', body: '' },
  });
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState<string | null>(null);
  const [templateSaved, setTemplateSaved] = useState<string | null>(null);

  // Preview
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  // Campaign creation
  const [showCreate, setShowCreate] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ subject: '', body: '', scheduledAt: '' });
  const [sendingCampaign, setSendingCampaign] = useState(false);
  const [previewingCampaign, setPreviewingCampaign] = useState(false);

  // Load settings + campaigns
  useEffect(() => {
    fetch(`/api/membership/settings?siteId=${siteId}`)
      .then(r => r.json())
      .then(data => {
        const s = data.settings || {};
        const b = s.branding || {};
        setLogoUrl(b.logoUrl || '');
        setHeaderColor(b.headerColor || DEFAULT_HEADER_COLOR);
        setAccentColor(b.accentColor || DEFAULT_ACCENT_COLOR);
        setFooterText(b.footerText || '');
        setTemplates({
          verification: { subject: s.email_verification_subject || '', body: s.email_verification_body || '' },
          passwordReset: { subject: s.password_reset_subject || '', body: s.password_reset_body || '' },
          welcome: { subject: s.welcome_email_subject || '', body: s.welcome_email_body || '' },
        });
      })
      .catch(() => {})
      .finally(() => setSettingsLoading(false));

    fetch(`/api/membership/campaigns?siteId=${siteId}`)
      .then(r => r.json())
      .then(data => setCampaigns(data.campaigns || []))
      .catch(() => {})
      .finally(() => setCampaignsLoading(false));
  }, [siteId]);

  const branding = { logoUrl, headerColor, accentColor, footerText };

  const buildPreview = (heading: string, body: string, ctaLabel: string, note?: string) =>
    buildMemberEmailHtml({
      heading,
      bodyLines: body.trim() ? body.split('\n').filter(Boolean) : [`Example body text for "${heading}".`],
      ctaLabel,
      ctaUrl: '#preview',
      note,
      branding,
    });

  // ── Design save ─────────────────────────────────────────────────────────────

  const saveDesign = async () => {
    setSavingDesign(true);
    try {
      await fetch('/api/membership/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, branding }),
      });
      setDesignSaved(true);
      setTimeout(() => setDesignSaved(false), 2000);
    } catch {} finally {
      setSavingDesign(false);
    }
  };

  // ── Template save ────────────────────────────────────────────────────────────

  const saveTemplate = async (key: 'verification' | 'passwordReset' | 'welcome') => {
    setSavingTemplate(key);
    const t = templates[key];
    const payload: Record<string, string> = { siteId };
    if (key === 'verification') {
      payload.emailVerificationSubject = t.subject;
      payload.emailVerificationBody = t.body;
    } else if (key === 'passwordReset') {
      payload.passwordResetSubject = t.subject;
      payload.passwordResetBody = t.body;
    } else {
      payload.welcomeEmailSubject = t.subject;
      payload.welcomeEmailBody = t.body;
    }
    try {
      await fetch('/api/membership/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setTemplateSaved(key);
      setTimeout(() => setTemplateSaved(null), 2000);
    } catch {} finally {
      setSavingTemplate(null);
    }
  };

  const updateTemplate = (key: 'verification' | 'passwordReset' | 'welcome', field: 'subject' | 'body', value: string) => {
    setTemplates(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  // ── Campaign send ────────────────────────────────────────────────────────────

  const handleSendCampaign = async (sendNow: boolean) => {
    if (!newCampaign.subject.trim() || !newCampaign.body.trim()) return;
    setSendingCampaign(true);
    try {
      await fetch('/api/membership/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          subject: newCampaign.subject,
          bodyText: newCampaign.body,
          scheduledAt: !sendNow && newCampaign.scheduledAt ? newCampaign.scheduledAt : undefined,
          sendNow,
        }),
      });
      setShowCreate(false);
      setNewCampaign({ subject: '', body: '', scheduledAt: '' });
      const res = await fetch(`/api/membership/campaigns?siteId=${siteId}`);
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch {} finally {
      setSendingCampaign(false);
    }
  };

  if (settingsLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  // ── System template definitions ──────────────────────────────────────────────

  const SYSTEM_TEMPLATES = [
    {
      key: 'verification' as const,
      label: 'Email Confirmation',
      description: 'Sent when a member signs up and needs to verify their email address.',
      defaultSubject: 'Verify your email',
      ctaLabel: 'Verify Email',
      note: 'This link expires in 24 hours. If you didn\'t sign up, you can safely ignore this email.',
      heading: 'Verify Your Email',
      subjectPlaceholder: 'Verify your email',
      bodyPlaceholder: 'Thanks for signing up! Click the button below to verify your email address and activate your account.',
    },
    {
      key: 'passwordReset' as const,
      label: 'Forgot Password',
      description: 'Sent when a member requests a password reset link.',
      defaultSubject: 'Reset your password',
      ctaLabel: 'Reset Password',
      note: 'This link expires in 1 hour. If you didn\'t request a password reset, you can safely ignore this email.',
      heading: 'Reset Your Password',
      subjectPlaceholder: 'Reset your password',
      bodyPlaceholder: 'We received a request to reset your password. Click the button below to set a new one.',
    },
    {
      key: 'welcome' as const,
      label: 'Welcome Email',
      description: 'Sent after a member\'s email address is verified.',
      defaultSubject: 'Welcome!',
      ctaLabel: null as string | null,
      note: undefined as string | undefined,
      heading: 'Welcome!',
      subjectPlaceholder: 'Welcome to [your community]!',
      bodyPlaceholder: 'Thanks for joining! Your account is now active.',
    },
  ];

  return (
    <div className="space-y-6">
      {previewHtml && (
        <EmailPreviewModal html={previewHtml} onClose={() => setPreviewHtml(null)} />
      )}

      {/* ── Email Design ────────────────────────────────────────────────────── */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 bg-slate-50 border-b border-slate-200">
          <Palette className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-800">Email Design</span>
          <span className="text-xs text-slate-400 ml-1">— applied to all emails</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Logo URL</label>
              <input
                type="url"
                value={logoUrl}
                onChange={e => setLogoUrl(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="https://yourdomain.com/logo.png"
              />
              <p className="text-xs text-slate-400 mt-1">Shown in the email header. Leave blank for a default icon.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Footer Text</label>
              <input
                type="text"
                value={footerText}
                onChange={e => setFooterText(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="© 2025 Your Company. All rights reserved."
              />
            </div>
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">Header Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={headerColor}
                  onChange={e => setHeaderColor(e.target.value)}
                  className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={headerColor}
                  onChange={e => setHeaderColor(e.target.value)}
                  className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">Button Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={e => setAccentColor(e.target.value)}
                  className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={e => setAccentColor(e.target.value)}
                  className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                />
              </div>
            </div>
            <div className="pt-5 ml-auto flex items-center gap-2">
              <button
                onClick={() => setPreviewHtml(buildPreview('Preview Email', 'This is how your branded email will look when sent to members.', 'Example Button'))}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
              <button
                onClick={saveDesign}
                disabled={savingDesign}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50"
              >
                {savingDesign ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : designSaved ? <Check className="w-3.5 h-3.5" /> : null}
                {designSaved ? 'Saved!' : 'Save Design'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── System Email Templates ───────────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-800">System Emails</span>
          <span className="text-xs text-slate-400 ml-1">— sent automatically</span>
        </div>

        {SYSTEM_TEMPLATES.map(tmpl => {
          const isExpanded = expandedTemplate === tmpl.key;
          const t = templates[tmpl.key];
          return (
            <div key={tmpl.key} className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                onClick={() => setExpandedTemplate(isExpanded ? null : tmpl.key)}
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{tmpl.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{tmpl.description}</p>
                </div>
                {t.subject && (
                  <span className="text-xs text-slate-400 hidden sm:block truncate max-w-[200px]">{t.subject}</span>
                )}
                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 pt-2 border-t border-slate-100 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Subject Line</label>
                    <input
                      type="text"
                      value={t.subject}
                      onChange={e => updateTemplate(tmpl.key, 'subject', e.target.value)}
                      placeholder={tmpl.subjectPlaceholder}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      Message
                      {tmpl.ctaLabel && <span className="text-slate-400 font-normal ml-1">— shown above the "{tmpl.ctaLabel}" button</span>}
                    </label>
                    <textarea
                      value={t.body}
                      onChange={e => updateTemplate(tmpl.key, 'body', e.target.value)}
                      placeholder={tmpl.bodyPlaceholder}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-y"
                    />
                    <p className="text-xs text-slate-400 mt-1">Leave blank to use the default message.</p>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => setPreviewHtml(buildPreview(
                        tmpl.heading,
                        t.body || tmpl.bodyPlaceholder,
                        tmpl.ctaLabel || 'Continue',
                        tmpl.note,
                      ))}
                      className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </button>
                    <button
                      onClick={() => saveTemplate(tmpl.key)}
                      disabled={savingTemplate === tmpl.key}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50"
                    >
                      {savingTemplate === tmpl.key
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : templateSaved === tmpl.key
                          ? <Check className="w-3.5 h-3.5" />
                          : null}
                      {templateSaved === tmpl.key ? 'Saved!' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Campaigns ───────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-slate-800">Member Campaigns</span>
            <span className="text-xs text-slate-400 ml-2">— send to opted-in members</span>
          </div>
          {!showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-700"
            >
              <Plus className="w-3.5 h-3.5" />
              New Campaign
            </button>
          )}
        </div>

        {showCreate && (
          <div className="border border-slate-200 rounded-xl p-5 space-y-4 bg-white">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Subject</label>
              <input
                type="text"
                value={newCampaign.subject}
                onChange={e => setNewCampaign(p => ({ ...p, subject: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="Monthly update for our members"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Message</label>
              <textarea
                value={newCampaign.body}
                onChange={e => setNewCampaign(p => ({ ...p, body: e.target.value }))}
                rows={6}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-y"
                placeholder="Write your message here..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Schedule <span className="text-slate-400 font-normal">(optional — leave blank to send now)</span>
              </label>
              <input
                type="datetime-local"
                value={newCampaign.scheduledAt}
                onChange={e => setNewCampaign(p => ({ ...p, scheduledAt: e.target.value }))}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <button
                onClick={() => {
                  if (newCampaign.subject && newCampaign.body) {
                    setPreviewHtml(buildPreview(newCampaign.subject, newCampaign.body, ''));
                    setPreviewingCampaign(true);
                  }
                }}
                disabled={!newCampaign.subject || !newCampaign.body}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <Eye className="w-3.5 h-3.5" />
                Preview
              </button>
              <button
                onClick={() => handleSendCampaign(true)}
                disabled={sendingCampaign || !newCampaign.subject.trim() || !newCampaign.body.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50"
              >
                {sendingCampaign ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send Now
              </button>
              {newCampaign.scheduledAt && (
                <button
                  onClick={() => handleSendCampaign(false)}
                  disabled={sendingCampaign}
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-sm font-semibold rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Schedule
                </button>
              )}
              <button
                onClick={() => { setShowCreate(false); setNewCampaign({ subject: '', body: '', scheduledAt: '' }); }}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {campaignsLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-10 text-sm text-slate-400">No campaigns yet.</div>
        ) : (
          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
            {campaigns.map(c => (
              <div key={c.id} className="flex items-center gap-4 px-4 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm truncate">{c.subject}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {c.status === 'sent'
                      ? `Sent to ${c.recipient_count} member${c.recipient_count !== 1 ? 's' : ''} · ${new Date(c.sent_at).toLocaleDateString()}`
                      : c.status === 'scheduled' && c.scheduled_at
                        ? `Scheduled for ${new Date(c.scheduled_at).toLocaleString()}`
                        : c.status}
                  </p>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                  c.status === 'sent' ? 'bg-green-100 text-green-700' :
                  c.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                  c.status === 'sending' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS TAB
// ═══════════════════════════════════════════════════════════════════════════════

function SettingsTab({ siteId }: { siteId: string }) {
  const [settings, setSettings] = useState<any>(null);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/membership/settings?siteId=${siteId}`);
        const data = await res.json();
        setSettings(data.settings || {
          require_email_verification: true,
          welcome_email_subject: 'Welcome!',
          welcome_email_body: '',
          notification_email: '',
          privacy_policy_url: '',
          marketing_opt_in_label: 'Send me updates and news',
        });
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [siteId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/membership/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          requireEmailVerification: settings.require_email_verification,
          welcomeEmailSubject: settings.welcome_email_subject,
          welcomeEmailBody: settings.welcome_email_body,
          notificationEmail: settings.notification_email,
          privacyPolicyUrl: settings.privacy_policy_url,
          marketingOptInLabel: settings.marketing_opt_in_label,
        }),
      });
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6 max-w-xl">
      {/* Stripe Connect */}
      <div className="border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-3">
          <CreditCard className="w-4 h-4" />
          Stripe Payments
        </h3>
        {stripeAccountId ? (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <Check className="w-4 h-4" />
            Stripe account connected
          </div>
        ) : (
          <div>
            <p className="text-sm text-slate-500 mb-3">Connect your Stripe account to accept paid memberships.</p>
            <button
              onClick={async () => {
                const res = await fetch('/api/stripe/connect', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ siteId }),
                });
                const data = await res.json();
                if (data.url) window.location.href = data.url;
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
            >
              <CreditCard className="w-4 h-4" />
              Connect Stripe
            </button>
          </div>
        )}
      </div>

      {/* Privacy Policy */}
      {!settings.privacy_policy_url && (
        <div className="border border-yellow-200 bg-yellow-50 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Privacy Policy Recommended</p>
            <p className="text-xs text-yellow-700 mt-0.5">Add a privacy policy URL to display on your signup form. This is recommended for GDPR compliance.</p>
          </div>
        </div>
      )}

      {/* Settings fields */}
      <div className="space-y-4">
        <div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.require_email_verification}
              onChange={e => setSettings((s: any) => ({ ...s, require_email_verification: e.target.checked }))}
              className="rounded"
            />
            Require email verification before sign in
          </label>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Notification Email</label>
          <input
            type="email"
            value={settings.notification_email || ''}
            onChange={e => setSettings((s: any) => ({ ...s, notification_email: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            placeholder="Get notified when new members sign up"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Privacy Policy URL</label>
          <input
            type="url"
            value={settings.privacy_policy_url || ''}
            onChange={e => setSettings((s: any) => ({ ...s, privacy_policy_url: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            placeholder="https://..."
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Marketing Opt-in Label</label>
          <input
            type="text"
            value={settings.marketing_opt_in_label || ''}
            onChange={e => setSettings((s: any) => ({ ...s, marketing_opt_in_label: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Welcome Email Subject</label>
          <input
            type="text"
            value={settings.welcome_email_subject || ''}
            onChange={e => setSettings((s: any) => ({ ...s, welcome_email_subject: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Welcome Email Body</label>
          <textarea
            value={settings.welcome_email_body || ''}
            onChange={e => setSettings((s: any) => ({ ...s, welcome_email_body: e.target.value }))}
            rows={4}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            placeholder="Welcome to our community..."
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
