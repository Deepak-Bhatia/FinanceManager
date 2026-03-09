import { useEffect, useState } from 'react';
import { getEmis, updateEmi, deleteEmi, getEmiAttachments } from '../api';
import { ChevronDown, ChevronRight, CreditCard, IndianRupee, Clock, Wallet, Pencil, Trash2, X } from 'lucide-react';

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type Emi = {
  id: number;
  card: string;
  card_id: number;
  product_name: string;
  duration_months: number;
  booking_month: string;
  loan_expiry: string;
  total_outstanding: number;
  monthly_emi: number;
  principal_component: number | null;
  interest_component: number | null;
  loan_amount: number | null;
  pending_installments: number | null;
  source_file: string | null;
  custom_description: string | null;
};

type Installment = {
  index: number;
  cycleStr: string;
  linked: number;
  status: 'paid' | 'current' | 'upcoming' | 'missed';
};

function parseBookingMonth(s: string): { month: number; year: number } | null {
  if (!s) return null;

  // Handle DD/MM/YYYY or DD/MM/YY (e.g. "23/02/2026", "23-02-26")
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    let yr = parseInt(dmy[3]);
    if (yr < 100) yr += 2000;
    return { month: parseInt(dmy[2]) - 1, year: yr };
  }

  // Handle "Feb.'26", "Feb 2026", "Feb-26", "February 2026" etc.
  const mo_map: Record<string, number> = {
    jan:0, feb:1, mar:2, apr:3, may:4, jun:5,
    jul:6, aug:7, sep:8, oct:9, nov:10, dec:11,
  };
  const m = s.toLowerCase().match(/([a-z]{3})[^a-z0-9]*'?(\d{2,4})/);
  if (!m) return null;
  const mo = mo_map[m[1]];
  if (mo === undefined) return null;
  let yr = parseInt(m[2]);
  if (yr < 100) yr += 2000;
  return { month: mo, year: yr };
}

export function generateInstallments(emi: Emi, attachments: any[]): Installment[] {
  const parsed = parseBookingMonth(emi.booking_month);
  if (!parsed || !emi.duration_months) return [];
  const now = new Date();
  const result: Installment[] = [];
  for (let i = 0; i < emi.duration_months; i++) {
    const d = new Date(parsed.year, parsed.month + i);
    const cycleStr = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    const linked = attachments.filter(a => a.emi_id === emi.id && a.cycle === cycleStr).length;
    const isCurrentMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    const isPast = d < new Date(now.getFullYear(), now.getMonth());
    let status: Installment['status'];
    if (linked > 0) status = 'paid';
    else if (isCurrentMonth) status = 'current';
    else if (isPast) status = 'missed';
    else status = 'upcoming';
    result.push({ index: i + 1, cycleStr, linked, status });
  }
  return result;
}

const STATUS_STYLE: Record<Installment['status'], { label: string; cls: string }> = {
  paid:     { label: '✓ Paid',     cls: 'bg-green-500/15 text-green-500 border-green-500/30' },
  current:  { label: '● Current',  cls: 'bg-blue-500/15 text-blue-400 border-blue-400/30' },
  upcoming: { label: '○ Upcoming', cls: 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border)]' },
  missed:   { label: '! Missed',   cls: 'bg-orange-500/15 text-orange-400 border-orange-400/30' },
};

const EMPTY_FORM = {
  product_name: '', duration_months: '', booking_month: '', loan_expiry: '',
  monthly_emi: '', total_outstanding: '', loan_amount: '',
  principal_component: '', interest_component: '', pending_installments: '',
  custom_description: '',
};

export default function EMIs() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [editingEmi, setEditingEmi] = useState<Emi | null>(null);
  const [editForm, setEditForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    getEmis().then(setData).finally(() => setLoading(false));
    getEmiAttachments().then(setAttachments);
  }, []);

  const toggle = (i: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const openEdit = (e: React.MouseEvent, emi: Emi) => {
    e.stopPropagation();
    setEditingEmi(emi);
    setEditForm({
      product_name: emi.product_name || '',
      duration_months: emi.duration_months != null ? String(emi.duration_months) : '',
      booking_month: emi.booking_month || '',
      loan_expiry: emi.loan_expiry || '',
      monthly_emi: emi.monthly_emi != null ? String(emi.monthly_emi) : '',
      total_outstanding: emi.total_outstanding != null ? String(emi.total_outstanding) : '',
      loan_amount: emi.loan_amount != null ? String(emi.loan_amount) : '',
      principal_component: emi.principal_component != null ? String(emi.principal_component) : '',
      interest_component: emi.interest_component != null ? String(emi.interest_component) : '',
      pending_installments: emi.pending_installments != null ? String(emi.pending_installments) : '',
      custom_description: emi.custom_description || '',
    });
  };

  const saveEdit = async () => {
    if (!editingEmi) return;
    setSaving(true);
    const payload: Record<string, any> = { product_name: editForm.product_name.trim() };
    if (editForm.duration_months !== '') payload.duration_months = Number(editForm.duration_months);
    if (editForm.booking_month !== '') payload.booking_month = editForm.booking_month.trim();
    if (editForm.loan_expiry !== '') payload.loan_expiry = editForm.loan_expiry.trim();
    if (editForm.monthly_emi !== '') payload.monthly_emi = Number(editForm.monthly_emi);
    if (editForm.total_outstanding !== '') payload.total_outstanding = Number(editForm.total_outstanding);
    payload.loan_amount = editForm.loan_amount !== '' ? Number(editForm.loan_amount) : null;
    payload.principal_component = editForm.principal_component !== '' ? Number(editForm.principal_component) : null;
    payload.interest_component = editForm.interest_component !== '' ? Number(editForm.interest_component) : null;
    payload.pending_installments = editForm.pending_installments !== '' ? Number(editForm.pending_installments) : null;
    payload.custom_description = editForm.custom_description.trim() || null;
    try {
      const updated = await updateEmi(editingEmi.id, payload);
      setData((prev: any) => ({
        ...prev,
        emis: prev.emis.map((e: Emi) => (e.id === updated.id ? { ...e, ...updated } : e)),
      }));
      setEditingEmi(null);
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof typeof EMPTY_FORM, val: string) =>
    setEditForm(prev => ({ ...prev, [key]: val }));

  const handleDelete = async (emiId: number) => {
    await deleteEmi(emiId);
    setData((prev: any) => ({
      ...prev,
      emis: prev.emis.filter((e: Emi) => e.id !== emiId),
    }));
    setConfirmDeleteId(null);
  };

  if (loading) return <p className="text-[var(--text-secondary)]">Loading…</p>;
  if (!data || data.emis.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">EMIs</h2>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-8 text-center text-[var(--text-secondary)]">
          No EMIs detected yet. Parse credit card statements to detect EMIs.
        </div>
      </div>
    );
  }

  const s = data.summary;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">EMIs</h2>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon={CreditCard} label="Total EMIs" value={s.total_emi_count.toString()} color="text-blue-400" />
        <SummaryCard icon={Clock} label="Active" value={s.active_count.toString()} color="text-yellow-400" />
        <SummaryCard icon={IndianRupee} label="Monthly Outgo" value={fmt(s.total_monthly)} color="text-red-400" />
        <SummaryCard icon={Wallet} label="Total Outstanding" value={fmt(s.total_outstanding)} color="text-orange-400" />
      </div>

      {/* EMI Cards */}
      <div className="space-y-3">
        {data.emis.map((emi: Emi, i: number) => {
          const isOpen = expanded.has(i);
          const installments = generateInstallments(emi, attachments);
          const paidCount = installments.filter(x => x.status === 'paid').length;

          return (
            <div key={emi.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
              {/* Header row */}
              <div className="flex items-center hover:bg-[var(--bg-secondary)] transition-colors">
                <button onClick={() => toggle(i)} className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-w-0">
                  <span className="text-[var(--text-secondary)] shrink-0">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{emi.custom_description || emi.product_name}</span>
                      {emi.custom_description && (
                        <span className="text-xs text-[var(--text-secondary)] truncate">({emi.product_name})</span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                        {emi.duration_months} months
                      </span>
                      {installments.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-500">
                          {paidCount}/{installments.length} paid
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {emi.card} · Booked {emi.booking_month} · Expires {emi.loan_expiry}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-3 pr-4 shrink-0">
                  <div className="text-right">
                    <div className="font-semibold text-red-400">{fmt(emi.monthly_emi)}<span className="text-xs font-normal text-[var(--text-secondary)]">/mo</span></div>
                    <div className="text-xs text-[var(--text-secondary)]">Outstanding {fmt(emi.total_outstanding)}</div>
                  </div>
                  <button onClick={e => openEdit(e, emi)}
                    className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                    title="Edit EMI">
                    <Pencil size={14} />
                  </button>
                  {confirmDeleteId === emi.id ? (
                    <>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); }}
                        className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                        title="Cancel">
                        <X size={14} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(emi.id); }}
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                        title="Confirm delete">
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDeleteId(emi.id); }}
                      className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete EMI">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded section */}
              {isOpen && (
                <div className="border-t border-[var(--border)]">
                  {/* Detail fields grid */}
                  <div className="px-4 grid grid-cols-2 md:grid-cols-4 gap-3 py-4 text-sm">
                    <div>
                      <div className="text-[var(--text-secondary)] text-xs">Monthly EMI</div>
                      <div className="font-medium">{fmt(emi.monthly_emi)}</div>
                    </div>
                    {emi.loan_amount != null && (
                      <div>
                        <div className="text-[var(--text-secondary)] text-xs">Loan Amount</div>
                        <div className="font-medium">{fmt(emi.loan_amount)}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-[var(--text-secondary)] text-xs">Principal</div>
                      <div className="font-medium">{emi.principal_component != null ? fmt(emi.principal_component) : '—'}</div>
                    </div>
                    <div>
                      <div className="text-[var(--text-secondary)] text-xs">Interest</div>
                      <div className="font-medium">{emi.interest_component != null ? fmt(emi.interest_component) : '—'}</div>
                    </div>
                    <div>
                      <div className="text-[var(--text-secondary)] text-xs">Total Outstanding</div>
                      <div className="font-medium">{fmt(emi.total_outstanding)}</div>
                    </div>
                    <div>
                      <div className="text-[var(--text-secondary)] text-xs">Duration</div>
                      <div className="font-medium">{emi.duration_months} months</div>
                    </div>
                    {emi.pending_installments != null && (
                      <div>
                        <div className="text-[var(--text-secondary)] text-xs">Pending Installments</div>
                        <div className="font-medium">{emi.pending_installments} of {emi.duration_months}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-[var(--text-secondary)] text-xs">Start Date</div>
                      <div className="font-medium">{emi.booking_month}</div>
                    </div>
                    <div>
                      <div className="text-[var(--text-secondary)] text-xs">End Date</div>
                      <div className="font-medium">{emi.loan_expiry}</div>
                    </div>
                    <div>
                      <div className="text-[var(--text-secondary)] text-xs">Source</div>
                      <div className="font-medium truncate" title={emi.source_file ?? ''}>
                        {emi.source_file?.split(/[\\/]/).pop() || '—'}
                      </div>
                    </div>
                  </div>

                  {/* ── Installment schedule table ──────────────────────── */}
                  {installments.length > 0 && (
                    <div className="border-t border-[var(--border)] px-4 pb-4">
                      <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide pt-3 pb-2">
                        Installment Schedule
                      </div>
                      <div className="rounded-lg border border-[var(--border)] overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-xs text-left">
                              <th className="px-4 py-2">#</th>
                              <th className="px-4 py-2">Period</th>
                              <th className="px-4 py-2">Amount</th>
                              <th className="px-4 py-2">Linked Txns</th>
                              <th className="px-4 py-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {installments.map(inst => {
                              const st = STATUS_STYLE[inst.status];
                              return (
                                <tr key={inst.index} className="border-t border-[var(--border)] hover:bg-[var(--bg-secondary)] transition-colors">
                                  <td className="px-4 py-2.5 text-[var(--text-secondary)] font-mono text-xs">EMI {inst.index}</td>
                                  <td className="px-4 py-2.5 font-medium">{inst.cycleStr}</td>
                                  <td className="px-4 py-2.5">{fmt(emi.monthly_emi)}</td>
                                  <td className="px-4 py-2.5">
                                    {inst.linked > 0
                                      ? <span className="text-xs bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full">{inst.linked} txn{inst.linked !== 1 ? 's' : ''}</span>
                                      : <span className="text-xs text-[var(--text-secondary)]">—</span>
                                    }
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${st.cls}`}>
                                      {st.label}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {installments.length === 0 && (
                    <div className="px-4 pb-4 border-t border-[var(--border)]">
                      <p className="text-xs text-[var(--text-secondary)] pt-3">
                        Could not generate installment schedule — check that Booking Month is set correctly (e.g. "Feb 2026").
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Edit EMI Modal ─────────────────────────────────────────────────── */}
      {editingEmi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditingEmi(null)}>
          <div className="bg-[var(--bg-card)] rounded-xl shadow-xl w-full max-w-xl mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-semibold text-base">Edit EMI</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{editingEmi.card}</p>
              </div>
              <button onClick={() => setEditingEmi(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Product Name</label>
                  <input type="text" value={editForm.product_name} onChange={e => field('product_name', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-primary)]"
                    placeholder="e.g. MERCHANT EMI" autoFocus />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Custom Description <span className="font-normal opacity-60">(shown instead of product name)</span></label>
                  <input type="text" value={editForm.custom_description} onChange={e => field('custom_description', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-primary)]"
                    placeholder="e.g. Apple iPhone 16 Pro EMI" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Duration (months)</label>
                  <input type="number" value={editForm.duration_months} onChange={e => field('duration_months', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-primary)]"
                    placeholder="e.g. 6" min={1} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Pending Installments</label>
                  <input type="number" value={editForm.pending_installments} onChange={e => field('pending_installments', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-primary)]"
                    placeholder="e.g. 4" min={0} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Booking Month</label>
                  <input type="text" value={editForm.booking_month} onChange={e => field('booking_month', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-primary)]"
                    placeholder="e.g. Feb 2026" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Expiry</label>
                  <input type="text" value={editForm.loan_expiry} onChange={e => field('loan_expiry', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-primary)]"
                    placeholder="e.g. Aug 2026" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Monthly EMI (₹)</label>
                  <input type="number" value={editForm.monthly_emi} onChange={e => field('monthly_emi', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-primary)]"
                    placeholder="0.00" min={0} step={0.01} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Total Outstanding (₹)</label>
                  <input type="number" value={editForm.total_outstanding} onChange={e => field('total_outstanding', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-primary)]"
                    placeholder="0.00" min={0} step={0.01} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Loan Amount (₹)</label>
                  <input type="number" value={editForm.loan_amount} onChange={e => field('loan_amount', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-primary)]"
                    placeholder="0.00" min={0} step={0.01} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Principal Component (₹)</label>
                  <input type="number" value={editForm.principal_component} onChange={e => field('principal_component', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-primary)]"
                    placeholder="0.00" min={0} step={0.01} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Interest Component (₹)</label>
                  <input type="number" value={editForm.interest_component} onChange={e => field('interest_component', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-primary)]"
                    placeholder="0.00" min={0} step={0.01} />
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-[var(--border)] flex justify-end gap-2 shrink-0">
              <button onClick={() => setEditingEmi(null)}
                className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors">
                Cancel
              </button>
              <button onClick={saveEdit} disabled={saving || !editForm.product_name.trim()}
                className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-[var(--bg-secondary)] ${color}`}><Icon size={20} /></div>
      <div>
        <div className="text-xs text-[var(--text-secondary)]">{label}</div>
        <div className="text-lg font-bold">{value}</div>
      </div>
    </div>
  );
}
