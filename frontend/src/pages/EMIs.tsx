import { useEffect, useState } from 'react';
import { getEmis } from '../api';
import { ChevronDown, ChevronRight, CreditCard, IndianRupee, Clock, Wallet } from 'lucide-react';

const fmt = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function EMIs() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    getEmis().then(setData).finally(() => setLoading(false));
  }, []);

  const toggle = (i: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
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
        {data.emis.map((emi: any, i: number) => {
          const isOpen = expanded.has(i);
          return (
            <div key={emi.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
              {/* Header row */}
              <button
                onClick={() => toggle(i)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <span className="text-[var(--text-secondary)]">
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{emi.product_name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                      {emi.duration_months} months
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {emi.card} · Booked {emi.booking_month} · Expires {emi.loan_expiry}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold text-red-400">{fmt(emi.monthly_emi)}<span className="text-xs font-normal text-[var(--text-secondary)]">/mo</span></div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    Outstanding {fmt(emi.total_outstanding)}
                  </div>
                </div>
              </button>

              {/* Expanded details */}
              {isOpen && (
                <div className="px-4 pb-4 border-t border-[var(--border)]">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-3 text-sm">
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
                      <div className="font-medium truncate" title={emi.source_file}>{emi.source_file?.split(/[\\/]/).pop() || '—'}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
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
